import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api } from "@/src/api";

export default function AdminReport() {
  const params = useLocalSearchParams<{ sales_code?: string }>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [salesCode, setSalesCode] = useState<string | undefined>(params.sales_code);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.dailyReport({ date, sales_code: salesCode });
      setData(r);
    } catch {}
  }, [date, salesCode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Laporan Sales</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateBtn} testID="prev-date-btn">
          <Ionicons name="chevron-back" size={20} color={theme.color.onSurface} />
        </TouchableOpacity>
        <TextInput
          value={date}
          onChangeText={setDate}
          onSubmitEditing={load}
          style={styles.dateInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.color.muted}
          testID="date-input"
        />
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateBtn} testID="next-date-btn">
          <Ionicons name="chevron-forward" size={20} color={theme.color.onSurface} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TextInput
          value={salesCode || ""}
          onChangeText={(v) => setSalesCode(v.toUpperCase() || undefined)}
          onSubmitEditing={load}
          placeholder="Filter kode sales (mis. A1)"
          placeholderTextColor={theme.color.muted}
          style={styles.dateInput}
          autoCapitalize="characters"
          testID="sales-code-filter"
        />
        {salesCode && (
          <TouchableOpacity onPress={() => setSalesCode(undefined)} style={styles.dateBtn} testID="clear-filter-btn">
            <Ionicons name="close" size={20} color={theme.color.onSurface} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total {date}</Text>
          <View style={styles.totalGrid}>
            <View style={styles.tCell}>
              <Text style={styles.tCellLabel}>Uang Diterima</Text>
              <Text style={styles.tCellValue}>Rp {rp(data?.totals?.total_bayar || 0)}</Text>
            </View>
            <View style={styles.tCell}>
              <Text style={styles.tCellLabel}>Nilai Jual</Text>
              <Text style={styles.tCellValue}>Rp {rp(data?.totals?.total_uang || 0)}</Text>
            </View>
            <View style={styles.tCell}>
              <Text style={styles.tCellLabel}>Galon Terjual</Text>
              <Text style={styles.tCellValue}>{data?.totals?.total_gln_terjual || 0}</Text>
            </View>
            <View style={styles.tCell}>
              <Text style={styles.tCellLabel}>Pinjam Galon</Text>
              <Text style={styles.tCellValue}>{data?.totals?.total_pinjam || 0}</Text>
            </View>
            <View style={styles.tCell}>
              <Text style={styles.tCellLabel}>Hutang Baru</Text>
              <Text style={[styles.tCellValue, { color: theme.color.error }]}>Rp {rp(data?.totals?.total_hutang || 0)}</Text>
            </View>
            <View style={styles.tCell}>
              <Text style={styles.tCellLabel}>Transaksi</Text>
              <Text style={styles.tCellValue}>{data?.totals?.count || 0}</Text>
            </View>
          </View>
        </View>

        {(data?.groups || []).map((g: any) => (
          <View key={g.sales_code} style={styles.gCard}>
            <View style={styles.gHeader}>
              <View style={styles.gBadge}>
                <Text style={styles.gBadgeText}>{g.sales_code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gCount}>{g.count} transaksi</Text>
                <Text style={styles.gGln}>{g.total_gln_terjual} galon terjual</Text>
              </View>
              <View>
                <Text style={styles.gTotal}>Rp {rp(g.total_bayar)}</Text>
                {g.total_hutang > 0 && <Text style={styles.gDebt}>+ hutang Rp {rp(g.total_hutang)}</Text>}
              </View>
            </View>
            <View style={styles.gDivider} />
            {g.transactions.map((t: any) => (
              <View key={t.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txCustomer}>{t.customer_name}</Text>
                  <Text style={styles.txMeta}>
                    {new Date(t.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} ·
                    {" "}{t.items?.reduce((a: number, b: any) => a + b.qty, 0) || 0} item
                    {" "}· pinjam {t.pinjam_galon}
                    {t.edited ? " · diedit" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.txPay}>Rp {rp(t.bayar)}</Text>
                  {t.hutang_transaksi > 0 && <Text style={styles.txDebt}>Hutang Rp {rp(t.hutang_transaksi)}</Text>}
                </View>
              </View>
            ))}
          </View>
        ))}

        {(!data?.groups || data.groups.length === 0) && (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={40} color={theme.color.muted} />
            <Text style={styles.emptyText}>Tidak ada laporan untuk tanggal ini</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  headerBar: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8, alignItems: "center" },
  dateBtn: { padding: 10, borderRadius: 10, backgroundColor: theme.color.surfaceSecondary },
  dateInput: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: theme.color.surfaceSecondary, fontSize: 14, color: theme.color.onSurface },
  totalCard: { padding: 16, borderRadius: 16, backgroundColor: theme.color.brandTertiary, marginBottom: 16 },
  totalLabel: { fontSize: 12, color: theme.color.onBrandTertiary, fontWeight: "500", marginBottom: 12 },
  totalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tCell: { width: "47%" },
  tCellLabel: { fontSize: 11, color: theme.color.onBrandTertiary },
  tCellValue: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface, marginTop: 2 },
  gCard: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 14, marginBottom: 12, overflow: "hidden" },
  gHeader: { flexDirection: "row", padding: 12, alignItems: "center", gap: 12, backgroundColor: theme.color.surfaceSecondary },
  gBadge: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  gBadgeText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  gCount: { fontSize: 13, color: theme.color.onSurface, fontWeight: "500" },
  gGln: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  gTotal: { fontSize: 15, fontWeight: "600", color: theme.color.brand, textAlign: "right" },
  gDebt: { fontSize: 11, color: theme.color.error, marginTop: 2 },
  gDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  txRow: { flexDirection: "row", padding: 10, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  txCustomer: { fontSize: 13, fontWeight: "500", color: theme.color.onSurface },
  txMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  txPay: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  txDebt: { fontSize: 10, color: theme.color.error, marginTop: 2 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.color.muted, marginTop: 12 },
});
