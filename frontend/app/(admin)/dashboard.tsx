import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>{user?.name}</Text>
          <Text style={styles.role}>Admin Wilayah {user?.group_letter}</Text>
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
          <View style={[styles.kpi, { backgroundColor: theme.color.brandTertiary }]}>
            <Text style={styles.kpiLabel}>Setoran Bersih Hari Ini</Text>
            <Text style={styles.kpiValue}>Rp {rp(report?.totals?.total_setoran || 0)}</Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: theme.color.surfaceSecondary }]}>
            <Text style={styles.kpiLabel}>Galon Terjual</Text>
            <Text style={styles.kpiValue}>{report?.totals?.total_gln_terjual || 0}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <MiniCard label="Uang Diterima" value={"Rp " + rp(report?.totals?.total_bayar || 0)} icon="cash" />
          <MiniCard label="Pengeluaran Sales" value={"Rp " + rp(report?.totals?.total_pengeluaran || 0)} icon="remove-circle" color={theme.color.error} />
          <MiniCard label="Transaksi Hari Ini" value={String(report?.totals?.count || 0)} icon="receipt" />
          <MiniCard label="Hutang Terbentuk" value={"Rp " + rp(report?.totals?.total_hutang || 0)} icon="alert-circle" color={theme.color.error} />
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity onPress={() => router.push("/(admin)/customers")} style={styles.linkBtnAlt} testID="open-customers-btn">
            <Ionicons name="people" size={16} color={theme.color.brandPrimary} />
            <Text style={styles.linkTextAlt}>Kelola Pelanggan</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.color.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(admin)/winners")} style={styles.linkBtn} testID="open-winners-btn">
            <Ionicons name="trophy" size={16} color="#B45309" />
            <Text style={styles.linkText}>Riwayat Pemenang Undian</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.color.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(admin)/selisih")} style={styles.linkBtnAlt} testID="open-selisih-btn">
            <Ionicons name="git-compare" size={16} color={theme.color.brandPrimary} />
            <Text style={styles.linkTextAlt}>Selisih Galon (Merah/Hijau)</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.color.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Rangkuman Per Sales (Hari Ini)</Text>
        {(report?.groups || []).map((g: any) => (
          <TouchableOpacity
            key={g.sales_code}
            style={styles.gCard}
            onPress={() => router.push({ pathname: "/(admin)/report", params: { sales_code: g.sales_code } })}
            testID={`sales-group-${g.sales_code}`}
          >
            <View style={styles.gBadge}>
              <Text style={styles.gBadgeText}>{g.sales_code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gLabel}>{g.count} transaksi · {g.total_gln_terjual} gln</Text>
              <Text style={styles.gValue}>Setoran Rp {rp(g.total_setoran || 0)}</Text>
              <Text style={styles.gSub}>
                Terima Rp {rp(g.total_bayar)}
                {g.total_pengeluaran > 0 ? ` − BBM/dll Rp ${rp(g.total_pengeluaran)}` : ""}
              </Text>
              {g.total_hutang > 0 && <Text style={styles.gDebt}>Hutang baru: Rp {rp(g.total_hutang)}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
          </TouchableOpacity>
        ))}
        {(!report?.groups || report.groups.length === 0) && (
          <Text style={styles.empty}>Belum ada transaksi hari ini</Text>
        )}
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", padding: 16, alignItems: "center", justifyContent: "space-between" },
  hello: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  role: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpi: { flex: 1, borderRadius: 20, padding: 16 },
  kpiLabel: { fontSize: 11, color: theme.color.onBrandTertiary, fontWeight: "500" },
  kpiValue: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mini: { width: "48%", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, gap: 4 },
  miniValue: { fontSize: 16, fontWeight: "600", color: theme.color.onSurface, marginTop: 4 },
  miniLabel: { fontSize: 11, color: theme.color.muted },
  section: { fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 8, color: theme.color.onSurface },
  gCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8, gap: 12 },
  gBadge: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  gBadgeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  gLabel: { fontSize: 12, color: theme.color.muted },
  gValue: { fontSize: 14, fontWeight: "600", color: theme.color.brand, marginTop: 2 },
  gSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  gDebt: { fontSize: 11, color: theme.color.error, marginTop: 2 },
  empty: { textAlign: "center", color: theme.color.muted, padding: 24 },
  linkRow: { marginTop: 12 },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: "#FEF3C7",
  },
  linkText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#B45309" },
  linkBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.brandTertiary,
    marginBottom: 8,
  },
  linkTextAlt: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.color.brand },
});
