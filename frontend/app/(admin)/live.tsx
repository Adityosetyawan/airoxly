import React, { useCallback, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import LeafletMap, { MapMarker } from "@/src/components/LeafletMap";

// Pool of pin colours (hex without '#') — cycled per sales
const PIN_COLORS = ["16a34a", "2563eb", "f59e0b", "dc2626", "9333ea", "0891b2", "db2777", "65a30d"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const d = Math.floor(hr / 24);
  return `${d} hari lalu`;
}

export default function LiveLocations() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const routeGroup = user?.role === "super_admin" ? "(superadmin)" : "(admin)";

  const load = useCallback(async () => {
    try {
      const r = await api.liveLocations();
      setItems(r);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markers = useMemo<MapMarker[]>(() => {
    return items
      .filter((s) => s.last_location)
      .map((s, idx) => ({
        lat: s.last_location.lat,
        lng: s.last_location.lng,
        label: s.sales_code || "?",
        color: PIN_COLORS[idx % PIN_COLORS.length],
        popup: `<b>${s.sales_code || "?"}</b><br>${s.name || ""}<br>${timeAgo(s.last_location.ts)}`,
      }));
  }, [items]);

  const onlineCount = markers.length;

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Lokasi Sales (Live)</Text>
          <Text style={styles.sub}>
            {onlineCount} sales online · Auto update tiap 60 detik
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} testID="refresh-live-btn">
          <Ionicons name="refresh" size={18} color={theme.color.brand} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        <LeafletMap markers={markers} height={320} />

        {onlineCount === 0 && (
          <View style={styles.mapEmpty}>
            <Ionicons name="location-outline" size={20} color={theme.color.muted} />
            <Text style={styles.mapEmptyText}>Belum ada sales yang mengirim lokasi</Text>
          </View>
        )}

        <Text style={styles.section}>Daftar Sales</Text>
        {items.map((s, idx) => {
          const l = s.last_location;
          const color = "#" + PIN_COLORS[idx % PIN_COLORS.length];
          return (
            <TouchableOpacity
              key={s.id}
              style={styles.card}
              onPress={() => router.push({ pathname: `/${routeGroup}/route-history` as any, params: { sales_id: s.id, sales_code: s.sales_code || "" } })}
              testID={`live-card-${s.id}`}
            >
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeText}>{s.sales_code || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                {l ? (
                  <>
                    <Text style={styles.coords}>{l.lat.toFixed(5)}, {l.lng.toFixed(5)}</Text>
                    <Text style={styles.time}>{timeAgo(l.ts)} · {new Date(l.ts).toLocaleString("id-ID")}</Text>
                  </>
                ) : (
                  <Text style={styles.offline}>Belum ada lokasi</Text>
                )}
              </View>
              <View style={styles.right}>
                <View style={[styles.dot, { backgroundColor: l ? theme.color.success : theme.color.muted }]} />
                <Ionicons name="chevron-forward" size={18} color={theme.color.muted} />
              </View>
            </TouchableOpacity>
          );
        })}
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada sales</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  sub: { fontSize: 12, color: theme.color.muted, marginTop: 4 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  mapEmpty: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: -8, justifyContent: "center" },
  mapEmptyText: { fontSize: 11, color: theme.color.muted, fontStyle: "italic" },
  section: { fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 10, color: theme.color.onSurface },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 8,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  name: { fontSize: 14, fontWeight: "500", color: theme.color.onSurface },
  coords: {
    fontSize: 12,
    color: theme.color.muted,
    marginTop: 2,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  time: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  offline: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.color.muted, marginTop: 12 },
});
