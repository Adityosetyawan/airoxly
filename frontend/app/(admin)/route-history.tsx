import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import LeafletMap, { MapMarker, MapPolyline } from "@/src/components/LeafletMap";
import { useToast } from "@/src/components/Toast";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export default function RouteHistory() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ sales_id?: string; sales_code?: string }>();
  const [salesId, setSalesId] = useState<string>(params.sales_id || "");
  const [salesList, setSalesList] = useState<any[]>([]);
  const [date, setDate] = useState<string>(todayISO());
  const [points, setPoints] = useState<{ lat: number; lng: number; ts: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.liveLocations();
        setSalesList(r);
        if (!salesId && r.length > 0) setSalesId(r[0].id);
      } catch (e: any) {
        toast.show(e?.message || "Gagal ambil daftar sales", "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!salesId) return;
    setLoading(true);
    try {
      const items = await api.locationHistory(salesId, date);
      setPoints(items.map((p) => ({ lat: p.lat, lng: p.lng, ts: p.ts })));
    } catch (e: any) {
      toast.show(e?.message || "Gagal ambil riwayat", "error");
    } finally {
      setLoading(false);
    }
  }, [salesId, date, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalKm = useMemo(() => {
    let km = 0;
    for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
    return km;
  }, [points]);

  const firstTs = points[0]?.ts;
  const lastTs = points[points.length - 1]?.ts;

  const polylines = useMemo<MapPolyline[]>(
    () => (points.length >= 2 ? [{ points, color: "16a34a", weight: 4 }] : []),
    [points],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (points.length > 0) {
      m.push({ lat: points[0].lat, lng: points[0].lng, label: "START", color: "2563eb" });
    }
    if (points.length > 1) {
      const last = points[points.length - 1];
      m.push({ lat: last.lat, lng: last.lng, label: "END", color: "dc2626" });
    }
    return m;
  }, [points]);

  const selectedSales = salesList.find((s) => s.id === salesId);

  const changeDate = (delta: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    const y2 = dt.getFullYear();
    const m2 = String(dt.getMonth() + 1).padStart(2, "0");
    const d2 = String(dt.getDate()).padStart(2, "0");
    setDate(`${y2}-${m2}-${d2}`);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Riwayat Rute Sales</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.fieldLabel}>Sales</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
          {salesList.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSalesId(s.id)}
              style={[styles.chip, salesId === s.id && styles.chipActive]}
              testID={`pick-sales-${s.id}`}
            >
              <Text style={[styles.chipText, salesId === s.id && styles.chipTextActive]}>
                {s.sales_code || s.username || s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 12 }} />
        <Text style={styles.fieldLabel}>Tanggal</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateBtn} testID="prev-day-btn">
            <Ionicons name="chevron-back" size={18} color={theme.color.brand} />
          </TouchableOpacity>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.muted}
            style={styles.dateInput}
            testID="date-input"
          />
          <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateBtn} testID="next-day-btn">
            <Ionicons name="chevron-forward" size={18} color={theme.color.brand} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDate(todayISO())} style={styles.todayBtn} testID="today-btn">
            <Text style={styles.todayText}>Hari Ini</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />
        <LeafletMap markers={markers} polylines={polylines} height={340} />

        <View style={styles.statsRow}>
          <StatBox label="Titik" value={String(points.length)} icon="location" />
          <StatBox label="Jarak" value={`${totalKm.toFixed(2)} km`} icon="walk" />
          <StatBox
            label="Durasi"
            value={
              firstTs && lastTs && firstTs !== lastTs
                ? formatDuration(new Date(firstTs), new Date(lastTs))
                : "-"
            }
            icon="time"
          />
        </View>

        {selectedSales && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{selectedSales.name}</Text>
            <Text style={styles.infoSub}>
              {selectedSales.sales_code} · Group {selectedSales.group_letter || "-"}
            </Text>
            {firstTs && (
              <Text style={styles.infoLine}>
                Mulai: {new Date(firstTs).toLocaleTimeString("id-ID")}
                {lastTs && lastTs !== firstTs
                  ? ` · Selesai: ${new Date(lastTs).toLocaleTimeString("id-ID")}`
                  : ""}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.section}>Detail Titik ({points.length})</Text>
        {loading && <ActivityIndicator size="small" color={theme.color.brandPrimary} style={{ marginTop: 12 }} />}
        {!loading &&
          points.map((p, idx) => (
            <View key={`${p.ts}-${idx}`} style={styles.pointRow}>
              <View style={styles.pointDot}>
                <Text style={styles.pointDotText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pointTs}>{new Date(p.ts).toLocaleString("id-ID")}</Text>
                <Text style={styles.pointCoord}>
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </Text>
              </View>
            </View>
          ))}
        {!loading && points.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={40} color={theme.color.muted} />
            <Text style={styles.emptyText}>Tidak ada data lokasi untuk tanggal ini</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={theme.color.brand} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(a: Date, b: Date): string {
  const s = Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  fieldLabel: { fontSize: 12, color: theme.color.muted, marginBottom: 6, fontWeight: "500" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
  },
  chipActive: { backgroundColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  dateInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: theme.color.onSurface,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  todayBtn: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  todayText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  stat: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.surfaceSecondary,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "700", color: theme.color.onSurface },
  statLabel: { fontSize: 11, color: theme.color.muted },
  infoCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  infoTitle: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface },
  infoSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  infoLine: { fontSize: 12, color: theme.color.onSurfaceSecondary, marginTop: 6 },
  section: { fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 10, color: theme.color.onSurface },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 6,
    gap: 10,
  },
  pointDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  pointDotText: { color: theme.color.onBrandTertiary, fontSize: 11, fontWeight: "700" },
  pointTs: { fontSize: 12, color: theme.color.onSurface, fontWeight: "500" },
  pointCoord: {
    fontSize: 11,
    color: theme.color.muted,
    marginTop: 2,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.color.muted, marginTop: 12, textAlign: "center" },
});
