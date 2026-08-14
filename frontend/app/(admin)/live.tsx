import React, { useCallback, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api, Customer } from "@/src/api";
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

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function LiveLocations() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomers, setShowCustomers] = useState(true);
  const [selectedSalesId, setSelectedSalesId] = useState<string | null>(null);

  const routeGroup = user?.role === "super_admin" ? "(superadmin)" : "(admin)";

  const load = useCallback(async () => {
    try {
      const [live, cs] = await Promise.all([
        api.liveLocations(),
        api.listCustomers({ sort: "no" }),
      ]);
      setItems(live);
      setCustomers(cs);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Map sales.id → color hex (without #) so customer pins share their sales' colour.
  const salesColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    items.forEach((s, idx) => {
      m[s.id] = PIN_COLORS[idx % PIN_COLORS.length];
    });
    return m;
  }, [items]);

  const salesMarkers = useMemo<MapMarker[]>(() => {
    return items
      .filter((s) => s.last_location && (!selectedSalesId || s.id === selectedSalesId))
      .map((s) => ({
        lat: s.last_location.lat,
        lng: s.last_location.lng,
        label: s.sales_code || "?",
        color: salesColorMap[s.id] || "16a34a",
        popup: `<b>${escapeHtml(s.sales_code || "?")}</b><br>${escapeHtml(s.name || "")}<br>${timeAgo(s.last_location.ts)}`,
        variant: "badge" as const,
      }));
  }, [items, salesColorMap, selectedSalesId]);

  const customerMarkers = useMemo<MapMarker[]>(() => {
    if (!showCustomers) return [];
    return customers
      .filter((c) => typeof c.lat === "number" && typeof c.lng === "number")
      .filter((c) => !selectedSalesId || c.created_by === selectedSalesId)
      .map((c) => ({
        lat: c.lat as number,
        lng: c.lng as number,
        label: `#${c.customer_no}`,
        color: salesColorMap[c.created_by || ""] || "2563eb",
        popup:
          `<b>#${c.customer_no} · ${escapeHtml(c.name)}</b>` +
          (c.sales_code ? `<br><i>Sales: ${escapeHtml(c.sales_code)}</i>` : "") +
          (c.address ? `<br>${escapeHtml(c.address)}` : "") +
          (c.wa_number ? `<br>WA: ${escapeHtml(c.wa_number)}` : ""),
        variant: "dot" as const,
      }));
  }, [customers, showCustomers, salesColorMap, selectedSalesId]);

  const allMarkers = useMemo(() => [...customerMarkers, ...salesMarkers], [customerMarkers, salesMarkers]);

  const onlineCount = salesMarkers.length;
  const customerOnMapCount = customerMarkers.length;
  const customersWithLoc = customers.filter((c) => typeof c.lat === "number" && typeof c.lng === "number").length;

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Lokasi Sales (Live)</Text>
          <Text style={styles.sub}>
            {onlineCount} sales online
            {showCustomers ? ` · ${customerOnMapCount} pelanggan` : ""}
            {" · Update tiap 60 dtk"}
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
        {/* Overlay toggle */}
        <View style={styles.overlayBar}>
          <TouchableOpacity
            style={[styles.toggleChip, showCustomers && styles.toggleChipActive]}
            onPress={() => setShowCustomers((v) => !v)}
            testID="toggle-customers-btn"
          >
            <Ionicons
              name={showCustomers ? "checkmark-circle" : "ellipse-outline"}
              size={16}
              color={showCustomers ? "#fff" : theme.color.muted}
            />
            <Text style={[styles.toggleText, showCustomers && styles.toggleTextActive]}>
              Tampilkan pelanggan ({customersWithLoc})
            </Text>
          </TouchableOpacity>
          {selectedSalesId ? (
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => setSelectedSalesId(null)}
              testID="clear-sales-filter-btn"
            >
              <Ionicons name="close-circle" size={14} color={theme.color.brand} />
              <Text style={styles.clearFilterText}>Reset filter</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <LeafletMap markers={allMarkers} height={340} />

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendPin} />
            <Text style={styles.legendText}>Sales</Text>
          </View>
          {showCustomers ? (
            <View style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Pelanggan</Text>
            </View>
          ) : null}
          {selectedSalesId ? (
            <Text style={styles.legendFilter}>
              · Difilter: 1 sales
            </Text>
          ) : null}
        </View>

        {onlineCount === 0 && customerOnMapCount === 0 && (
          <View style={styles.mapEmpty}>
            <Ionicons name="location-outline" size={20} color={theme.color.muted} />
            <Text style={styles.mapEmptyText}>Belum ada titik di peta</Text>
          </View>
        )}

        <Text style={styles.section}>Daftar Sales</Text>
        <Text style={styles.hint}>Tap sales untuk memfilter peta hanya wilayahnya.</Text>
        {items.map((s, idx) => {
          const l = s.last_location;
          const color = "#" + PIN_COLORS[idx % PIN_COLORS.length];
          const active = s.id === selectedSalesId;
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => setSelectedSalesId(active ? null : s.id)}
              onLongPress={() => router.push({ pathname: `/${routeGroup}/route-history` as any, params: { sales_id: s.id, sales_code: s.sales_code || "" } })}
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
                <Text style={styles.customerBadge}>
                  {customers.filter((c) => c.created_by === s.id && typeof c.lat === "number").length} pelanggan berlokasi
                </Text>
              </View>
              <View style={styles.right}>
                <View style={[styles.dot, { backgroundColor: l ? theme.color.success : theme.color.muted }]} />
                <Ionicons name={active ? "funnel" : "chevron-forward"} size={18} color={active ? theme.color.brand : theme.color.muted} />
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  overlayBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  toggleChipActive: {
    backgroundColor: theme.color.brand,
    borderColor: theme.color.brand,
  },
  toggleText: { fontSize: 12, color: theme.color.muted, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearFilterText: { fontSize: 11, color: theme.color.brand, fontWeight: "600" },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendPin: {
    width: 18, height: 12, borderRadius: 6,
    backgroundColor: "#16a34a", borderWidth: 1.5, borderColor: "#fff",
  },
  legendDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#2563eb", borderWidth: 1.5, borderColor: "#fff",
  },
  legendText: { fontSize: 11, color: theme.color.muted },
  legendFilter: { fontSize: 11, color: theme.color.brand, fontWeight: "600" },
  mapEmpty: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: -8, justifyContent: "center" },
  mapEmptyText: { fontSize: 11, color: theme.color.muted, fontStyle: "italic" },
  section: { fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 4, color: theme.color.onSurface },
  hint: { fontSize: 11, color: theme.color.muted, marginBottom: 10, fontStyle: "italic" },
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
  cardActive: {
    borderColor: theme.color.brand,
    backgroundColor: "rgba(15,118,110,0.06)",
  },
  badge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
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
  customerBadge: { fontSize: 10, color: theme.color.brand, fontWeight: "600", marginTop: 3 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.color.muted, marginTop: 12 },
});
