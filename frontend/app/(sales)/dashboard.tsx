import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Transaction } from "@/src/api";
import { useAuth } from "@/src/AuthContext";

export default function SalesDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        api.overview(),
        api.listTransactions({ date_from: today, date_to: today }),
      ]);
      setStats(s);
      setTxns(t);
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
          <Text style={styles.hello}>Halo, {user?.name || user?.username}</Text>
          <Text style={styles.code}>Sales • {user?.sales_code || user?.username}</Text>
        </View>
        <TouchableOpacity onPress={logout} testID="logout-button" style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        ListHeaderComponent={
          <View>
            <View style={styles.kpiRow}>
              <View style={[styles.kpi, { backgroundColor: theme.color.brandTertiary }]} testID="kpi-uang">
                <Text style={styles.kpiLabel}>Total Uang Diterima</Text>
                <Text style={styles.kpiValue}>Rp {rp(stats?.today_revenue || 0)}</Text>
              </View>
              <View style={[styles.kpi, { backgroundColor: theme.color.surfaceSecondary }]} testID="kpi-galon">
                <Text style={styles.kpiLabel}>Galon Terjual</Text>
                <Text style={styles.kpiValue}>{stats?.today_gln_sold || 0} <Text style={styles.kpiUnit}>gln</Text></Text>
              </View>
            </View>
            <View style={styles.miniRow}>
              <MiniStat label="Transaksi" value={String(stats?.today_count || 0)} />
              <MiniStat label="Nilai Jual" value={"Rp " + rp(stats?.today_total || 0)} />
              <MiniStat label="Total Pelanggan" value={String(stats?.total_customers || 0)} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.act} onPress={() => router.push("/(sales)/scan")} testID="action-scan">
                <Ionicons name="scan" size={20} color={theme.color.brand} />
                <Text style={styles.actText}>Scan / Baru</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.act} onPress={() => router.push("/(sales)/customers")} testID="action-customers">
                <Ionicons name="people" size={20} color={theme.color.brand} />
                <Text style={styles.actText}>Pelanggan</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.section}>Transaksi Hari Ini</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tx}
            onPress={() => router.push({ pathname: "/(sales)/transaction/[id]", params: { id: item.id } })}
            testID={`tx-${item.id}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.txName}>{item.customer_name}</Text>
              <Text style={styles.txSub}>
                {new Date(item.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {item.items.reduce((a, b) => a + b.qty, 0)} item
                {item.edited ? " · diedit" : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.txTotal}>Rp {rp(item.total)}</Text>
              {item.hutang_transaksi > 0 && (
                <Text style={styles.txDebt}>Hutang Rp {rp(item.hutang_transaksi)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={48} color={theme.color.brandSecondary} />
            <Text style={styles.emptyTitle}>Belum ada transaksi hari ini</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/(sales)/scan")} testID="empty-start-btn">
              <Text style={styles.emptyBtnText}>Mulai Transaksi</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", padding: 16, justifyContent: "space-between" },
  hello: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  code: { fontSize: 13, color: theme.color.muted, marginTop: 2 },
  iconBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpi: { flex: 1, borderRadius: 20, padding: 16 },
  kpiLabel: { fontSize: 12, color: theme.color.onBrandTertiary, fontWeight: "500" },
  kpiValue: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface, marginTop: 6, letterSpacing: -0.5 },
  kpiUnit: { fontSize: 13, color: theme.color.muted, fontWeight: "400" },
  miniRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  mini: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  miniLabel: { fontSize: 11, color: theme.color.muted },
  miniValue: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  act: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.color.brandTertiary,
  },
  actText: { color: theme.color.onBrandTertiary, fontWeight: "600" },
  section: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface, marginBottom: 8, marginTop: 4 },
  tx: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: theme.color.surface,
  },
  txName: { fontSize: 15, fontWeight: "500", color: theme.color.onSurface },
  txSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  txTotal: { fontSize: 15, fontWeight: "600", color: theme.color.brand },
  txDebt: { fontSize: 11, color: theme.color.error, marginTop: 2 },
  empty: { alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 14, color: theme.color.muted, marginTop: 12, marginBottom: 16 },
  emptyBtn: { backgroundColor: theme.color.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "600" },
});
