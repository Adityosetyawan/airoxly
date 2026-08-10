import React, { useCallback, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

export default function SuperDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<any>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.overview(), api.dailyReport({ date: today })]);
      setStats(s);
      setReport(r);
    } catch {}
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSecretTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2500);
    if (tapCount.current >= 3 && tapCount.current < 7) {
      const left = 7 - tapCount.current;
      toast.show(`${left} ketukan lagi untuk membuka pengaturan sistem`, "info");
    }
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      router.push("/(superadmin)/settings");
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Super Admin</Text>
          <Text style={styles.sub}>{user?.name || user?.username}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.iconBtn} testID="logout-btn">
          <Ionicons name="log-out-outline" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: theme.color.brandPrimary }]}>
            <Text style={[styles.kpiLabel, { color: "#D1FAE5" }]}>Setoran Bersih Hari Ini</Text>
            <Text style={[styles.kpiValue, { color: "#fff" }]}>Rp {rp(report?.totals?.total_setoran || 0)}</Text>
            <Text style={{ color: "#A7F3D0", fontSize: 11, marginTop: 6 }}>
              Diterima Rp {rp(report?.totals?.total_bayar || 0)} − Pengeluaran Rp {rp(report?.totals?.total_pengeluaran || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <MiniCard label="Uang Diterima" value={"Rp " + rp(report?.totals?.total_bayar || 0)} icon="cash" />
          <MiniCard label="Pengeluaran Sales" value={"Rp " + rp(report?.totals?.total_pengeluaran || 0)} icon="remove-circle" color={theme.color.error} />
          <MiniCard label="Galon Terjual" value={String(report?.totals?.total_gln_terjual || 0)} icon="cube" />
          <MiniCard label="Transaksi Hari Ini" value={String(report?.totals?.count || 0)} icon="receipt" />
          <MiniCard label="Hutang Baru" value={"Rp " + rp(report?.totals?.total_hutang || 0)} icon="alert-circle" color={theme.color.error} />
          <MiniCard label="Total Pelanggan" value={String(stats?.total_customers || 0)} icon="people" />
        </View>

        <Text style={styles.section}>Quick Access</Text>
        <View style={styles.actions}>
          <ActBtn icon="people" label="Kelola User" onPress={() => router.push("/(superadmin)/users")} />
          <ActBtn icon="person" label="Data Pelanggan" onPress={() => router.push("/(superadmin)/customers")} />
          <ActBtn icon="cube" label="Produk & Harga" onPress={() => router.push("/(superadmin)/products")} />
          <ActBtn icon="bar-chart" label="Laporan Global" onPress={() => router.push("/(superadmin)/report")} />
          <ActBtn icon="location" label="Live GPS" onPress={() => router.push("/(superadmin)/live")} />
          <ActBtn icon="gift" label="Undian Berhadiah" onPress={() => router.push("/(superadmin)/lottery")} />
          <ActBtn icon="trophy" label="Riwayat Pemenang" onPress={() => router.push("/(superadmin)/winners")} />
          <ActBtn icon="hammer" label="Data Produksi & Gudang" onPress={() => router.push("/(superadmin)/produksi-data")} />
          <ActBtn icon="git-compare" label="Selisih Galon" onPress={() => router.push("/(superadmin)/selisih")} />
          <ActBtn icon="book" label="Buku Panduan" onPress={() => router.push("/panduan")} />
        </View>

        <Text style={styles.section}>Sales Hari Ini</Text>
        {(report?.groups || []).map((g: any) => (
          <TouchableOpacity
            key={g.sales_code}
            style={styles.gCard}
            onPress={() => router.push({ pathname: "/(superadmin)/report", params: { sales_code: g.sales_code } })}
            testID={`group-${g.sales_code}`}
          >
            <View style={styles.gBadge}>
              <Text style={styles.gBadgeText}>{g.sales_code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gLabel}>{g.count} tx · {g.total_gln_terjual} gln</Text>
              <Text style={styles.gValue}>Setoran Rp {rp(g.total_setoran || 0)}</Text>
              {g.total_pengeluaran > 0 && (
                <Text style={{ fontSize: 11, color: theme.color.error, marginTop: 2 }}>
                  Pengeluaran: Rp {rp(g.total_pengeluaran)}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
          </TouchableOpacity>
        ))}
        {(!report?.groups || report.groups.length === 0) && (
          <Text style={styles.empty}>Belum ada transaksi hari ini</Text>
        )}

        {/* Hidden trigger — tap 7× to open Settings & Reset panel */}
        <TouchableOpacity onPress={handleSecretTap} activeOpacity={1} style={styles.versionBox} testID="secret-version-tap">
          <Text style={styles.versionText}>Air OXLY · v1.0.0</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniCard({ label, value, icon, color }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <View style={styles.mini}>
      <Ionicons name={icon} size={18} color={color || theme.color.brand} />
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function ActBtn({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.act} testID={`quick-${label}`}>
      <Ionicons name={icon} size={22} color={theme.color.brand} />
      <Text style={styles.actText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", padding: 16, alignItems: "center", justifyContent: "space-between" },
  hello: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  sub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary },
  kpiRow: { marginBottom: 12 },
  kpi: { borderRadius: 20, padding: 20 },
  kpiLabel: { fontSize: 13, fontWeight: "500" },
  kpiValue: { fontSize: 32, fontWeight: "700", marginTop: 8, letterSpacing: -0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mini: { width: "48%", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, gap: 4 },
  miniValue: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface, marginTop: 4 },
  miniLabel: { fontSize: 11, color: theme.color.muted },
  section: { fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 8, color: theme.color.onSurface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  act: { width: "48%", padding: 14, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: "center", gap: 6 },
  actText: { color: theme.color.onBrandTertiary, fontWeight: "600", fontSize: 13 },
  gCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8, gap: 12 },
  gBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  gBadgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  gLabel: { fontSize: 12, color: theme.color.muted },
  gValue: { fontSize: 14, fontWeight: "600", color: theme.color.brand, marginTop: 2 },
  empty: { textAlign: "center", color: theme.color.muted, padding: 20 },
  versionBox: { alignItems: "center", paddingVertical: 20, marginTop: 20 },
  versionText: { fontSize: 11, color: theme.color.muted, opacity: 0.6 },
});
