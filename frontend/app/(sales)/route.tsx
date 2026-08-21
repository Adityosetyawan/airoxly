import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { theme, rp } from "@/src/theme";
import { api, Customer } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import LeafletMap, { MapMarker, MapPolyline } from "@/src/components/LeafletMap";
import { getCachedCustomers } from "@/src/utils/offlineStore";

// Haversine distance (m)
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function computeNearest(origin: { lat: number; lng: number }, customers: Customer[]) {
  const withCoords = customers.filter((c) => typeof c.lat === "number" && typeof c.lng === "number");
  const remaining = [...withCoords];
  const ordered: (Customer & { _distFromPrev: number; _cum: number })[] = [];
  let cur = origin;
  let cum = 0;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let best = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const d = distanceMeters(cur, { lat: c.lat as number, lng: c.lng as number });
      if (d < best) { best = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    cum += best;
    ordered.push({ ...next, _distFromPrev: best, _cum: cum });
    cur = { lat: next.lat as number, lng: next.lng as number };
  }
  return ordered;
}

function fmt(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function SalesRoute() {
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const list = await api.listCustomers({ sort: "no" });
      setCustomers(list);
    } catch {
      const cached = await getCachedCustomers();
      setCustomers(cached);
    }
  }, []);

  const grabGps = useCallback(async () => {
    setLocating(true);
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      let ok = perm.status === "granted";
      if (!ok) {
        const req = await Location.requestForegroundPermissionsAsync();
        ok = req.status === "granted";
      }
      if (!ok) {
        toast.show("Izinkan lokasi untuk rute optimal", "error");
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setOrigin(pos);
      return pos;
    } catch (e: any) {
      toast.show(e?.message || "Gagal ambil lokasi", "error");
      return null;
    } finally {
      setLocating(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadCustomers();
      await grabGps();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ordered = useMemo(() => origin ? computeNearest(origin, customers) : [], [origin, customers]);
  const totalDist = ordered.length > 0 ? ordered[ordered.length - 1]._cum : 0;
  const withoutCoords = customers.filter((c) => !(typeof c.lat === "number" && typeof c.lng === "number")).length;

  const markers = useMemo<MapMarker[]>(() => {
    const arr: MapMarker[] = [];
    if (origin) {
      arr.push({
        lat: origin.lat,
        lng: origin.lng,
        label: "GO",
        color: "1E40AF",
        popup: `<b>Lokasi Anda</b>`,
        variant: "badge",
      });
    }
    ordered.forEach((c, i) => {
      arr.push({
        lat: c.lat as number,
        lng: c.lng as number,
        label: String(i + 1),
        color: "0891b2",
        popup: `<b>${i + 1}. #${c.customer_no} · ${escape(c.name || "")}</b><br>Jarak: ${fmt(c._distFromPrev)}`,
        variant: "badge",
      });
    });
    return arr;
  }, [origin, ordered]);

  const polylines = useMemo<MapPolyline[]>(() => {
    if (!origin || ordered.length === 0) return [];
    const points = [origin, ...ordered.map((c) => ({ lat: c.lat as number, lng: c.lng as number }))];
    return [{ points, color: "1E40AF", weight: 4 }];
  }, [origin, ordered]);

  const center = useMemo(() => {
    if (!origin && ordered.length === 0) return undefined;
    // Center on first stop or origin
    const pts = [origin, ...ordered.map((c) => ({ lat: c.lat as number, lng: c.lng as number }))]
      .filter(Boolean) as { lat: number; lng: number }[];
    if (pts.length === 0) return undefined;
    const avgLat = pts.reduce((a, b) => a + b.lat, 0) / pts.length;
    const avgLng = pts.reduce((a, b) => a + b.lng, 0) / pts.length;
    return { lat: avgLat, lng: avgLng };
  }, [origin, ordered]);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Peta Rute Optimal</Text>
          <Text style={styles.sub}>
            {ordered.length} pemberhentian · Total {fmt(totalDist)}
            {withoutCoords > 0 ? ` · ${withoutCoords} tanpa koordinat` : ""}
          </Text>
        </View>
        <TouchableOpacity
          onPress={async () => { await grabGps(); }}
          style={styles.reloadBtn}
          testID="reload-gps-btn"
        >
          {locating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="refresh" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.brandPrimary} />
          <Text style={styles.loadingText}>Menghitung rute…</Text>
        </View>
      ) : !origin ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={40} color={theme.color.muted} />
          <Text style={styles.emptyText}>Lokasi belum terdeteksi</Text>
          <TouchableOpacity onPress={grabGps} style={styles.primaryBtn}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={styles.primaryBtnText}>Ambil Lokasi Sekarang</Text>
          </TouchableOpacity>
        </View>
      ) : ordered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={40} color={theme.color.muted} />
          <Text style={styles.emptyText}>Belum ada pelanggan dengan koordinat GPS</Text>
          <Text style={[styles.emptyText, { fontSize: 11, marginTop: 4 }]}>
            Simpan koordinat pelanggan dari halaman profilnya dulu.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
            <LeafletMap
              markers={markers}
              polylines={polylines}
              center={center}
              zoom={14}
              style={{ flex: 1 }}
            />
          </View>
          <ScrollView style={styles.listWrap} contentContainerStyle={{ padding: 12, gap: 6 }}>
            <View style={styles.legend}>
              <View style={[styles.legendPill, { backgroundColor: "#1E40AF" }]}>
                <Text style={styles.legendPillText}>GO</Text>
              </View>
              <Text style={styles.legendText}>= Lokasi Anda</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.legendMeta}>{ordered.length} stop</Text>
            </View>
            {ordered.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => router.push({ pathname: "/(sales)/customer/[id]", params: { id: c.id } } as any)}
                style={styles.stop}
                testID={`route-stop-${i + 1}`}
              >
                <View style={styles.stopBadge}>
                  <Text style={styles.stopBadgeText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName} numberOfLines={1}>#{c.customer_no} · {c.name}</Text>
                  <Text style={styles.stopMeta}>
                    {fmt(c._distFromPrev)} dari sebelumnya · Total {fmt(c._cum)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.color.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

// Simple HTML escape for Leaflet popup content
function escape(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string));
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: theme.color.surface, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { fontSize: 17, fontWeight: "800", color: theme.color.onSurface },
  sub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  reloadBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.brand, alignItems: "center", justifyContent: "center" },
  mapWrap: { height: Platform.OS === "web" ? 380 : 360, backgroundColor: "#eef2f5" },
  listWrap: { flex: 1 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  legendPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  legendPillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  legendText: { fontSize: 12, color: theme.color.onSurfaceSecondary },
  legendMeta: { fontSize: 11, color: theme.color.muted, fontWeight: "700" },
  stop: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border },
  stopBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#0891b2", alignItems: "center", justifyContent: "center" },
  stopBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  stopName: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  stopMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  loadingText: { color: theme.color.muted, marginTop: 8 },
  emptyText: { color: theme.color.muted, textAlign: "center" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.color.brandPrimary, marginTop: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

// Silence unused import warning: rp used elsewhere in older versions
void rp;
