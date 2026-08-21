import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Distinct colors per wilayah bar
const WILAYAH_COLORS = ["#0891b2", "#8B5CF6", "#F59E0B", "#DC2626", "#059669", "#DB2777", "#3B82F6", "#65A30D"];

export default function WilayahSummary() {
  const router = useRouter();
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.monthlyByWilayah({ year, month });
      setData(r);
    } catch (e: any) {
      toast.show(e?.message || "Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => { load(); }, [load]);

  const rows: any[] = useMemo(() => data?.rows || [], [data]);
  const totals = data?.totals || {};

  const maxOmzet = useMemo(() => {
    return Math.max(1, ...rows.map((r: any) => r.omzet || 0));
  }, [rows]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rangkuman Wilayah</Text>
          <Text style={styles.sub}>Bandingkan performa per Wilayah dalam sebulan</Text>
        </View>
      </View>

      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.mBtn} testID="prev-month-btn">
          <Ionicons name="chevron-back" size={18} color={theme.color.brand} />
        </TouchableOpacity>
        <Text style={styles.mLabel}>{MONTHS_ID[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.mBtn} testID="next-month-btn">
          <Ionicons name="chevron-forward" size={18} color={theme.color.brand} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        {/* Totals card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Omzet Bulan Ini</Text>
          <Text style={styles.totalValue}>Rp {rp(totals.omzet || 0)}</Text>
          <View style={styles.totalRow}>
            <Stat label="Bayar" value={`Rp ${rp(totals.bayar || 0)}`} color={theme.color.success} />
            <Stat label="Hutang" value={`Rp ${rp(totals.hutang || 0)}`} color={theme.color.error} />
          </View>
          <View style={styles.totalRow}>
            <Stat label="Transaksi" value={String(totals.trx_count || 0)} />
            <Stat label="Galon" value={`${totals.gln_terjual || 0} gln`} />
            <Stat label="Pelanggan" value={`${totals.customer_active || 0}/${totals.customer_count || 0}`} />
          </View>
        </View>

        {/* Per-wilayah cards */}
        {loading && rows.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.color.brandPrimary} />
            <Text style={styles.loadingText}>Memuat rangkuman wilayah…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={40} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada data untuk periode ini</Text>
          </View>
        ) : (
          rows.map((r: any, idx: number) => {
            const color = WILAYAH_COLORS[idx % WILAYAH_COLORS.length];
            const pct = (r.omzet || 0) / maxOmzet;
            const share = totals.omzet > 0 ? (r.omzet / totals.omzet) * 100 : 0;
            return (
              <View key={r.wilayah} style={styles.wCard}>
                <View style={styles.wHeader}>
                  <View style={[styles.wBadge, { backgroundColor: color }]}>
                    <Text style={styles.wBadgeText}>{r.wilayah}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wName}>Wilayah {r.wilayah}</Text>
                    <Text style={styles.wSub}>
                      {r.sales_count} sales · {r.customer_active}/{r.customer_count} pelanggan aktif
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.wOmzet, { color }]}>Rp {rp(r.omzet)}</Text>
                    <Text style={styles.wShare}>{share.toFixed(1)}% total</Text>
                  </View>
                </View>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { backgroundColor: color, width: `${Math.max(4, pct * 100)}%` }]} />
                </View>

                <View style={styles.wStats}>
                  <View style={styles.wStat}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.color.success} />
                    <Text style={styles.wStatLabel}>Bayar</Text>
                    <Text style={styles.wStatValue}>Rp {rp(r.bayar)}</Text>
                  </View>
                  <View style={styles.wStat}>
                    <Ionicons name="alert-circle" size={12} color={theme.color.error} />
                    <Text style={styles.wStatLabel}>Hutang</Text>
                    <Text style={styles.wStatValue}>Rp {rp(r.hutang)}</Text>
                  </View>
                  <View style={styles.wStat}>
                    <Ionicons name="cube" size={12} color={theme.color.brand} />
                    <Text style={styles.wStatLabel}>Galon</Text>
                    <Text style={styles.wStatValue}>{r.gln_terjual}</Text>
                  </View>
                  <View style={styles.wStat}>
                    <Ionicons name="receipt" size={12} color={theme.color.muted} />
                    <Text style={styles.wStatLabel}>Trx</Text>
                    <Text style={styles.wStatValue}>{r.trx_count}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, backgroundColor: theme.color.surface, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { fontSize: 18, fontWeight: "800", color: theme.color.onSurface },
  sub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, backgroundColor: theme.color.surface, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  mBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  mLabel: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  totalCard: { backgroundColor: theme.color.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.color.border },
  totalLabel: { fontSize: 12, color: theme.color.muted, fontWeight: "600" },
  totalValue: { fontSize: 22, fontWeight: "800", color: theme.color.brand, marginTop: 2, marginBottom: 8 },
  totalRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  statLabel: { fontSize: 10, color: theme.color.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface, marginTop: 2 },
  wCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.color.border },
  wHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  wBadge: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  wBadgeText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  wName: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  wSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  wOmzet: { fontSize: 15, fontWeight: "800" },
  wShare: { fontSize: 10, color: theme.color.muted, marginTop: 2 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.color.surfaceSecondary, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  wStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  wStat: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: "40%" },
  wStatLabel: { fontSize: 11, color: theme.color.muted },
  wStatValue: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface, marginLeft: "auto" },
  loading: { alignItems: "center", padding: 40 },
  loadingText: { color: theme.color.muted, marginTop: 8 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.color.muted, marginTop: 12 },
});
