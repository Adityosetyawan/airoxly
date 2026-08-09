import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

type Entry = {
  sales_id: string;
  sales_code?: string;
  sales_name?: string;
  group_letter?: string;
  date: string;
  bawa_total?: number;
  galon_kembali?: number;
  kosong_pulang: number;
  galon_ganti_produksi: number;
  selisih: number;
  merah: number;
  hijau: number;
  hijau_raw: number;
  hijau_cleared: boolean;
  warehouse_entry_ids: string[];
};

type Summary = {
  sales_id: string;
  sales_code?: string;
  sales_name?: string;
  group_letter?: string;
  total_merah: number;
  total_hijau: number;
  total_hijau_raw: number;
  days_merah: number;
  days_hijau: number;
};

const monthRange = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { from, to };
};

/**
 * Shared Selisih Galon screen — used by Gudang, Admin, dan Super Admin.
 * - Menampilkan akumulasi merah / hijau per sales
 * - Menampilkan entries harian sebagai detail
 * - Admin/Super Admin bisa "nolkan hijau" untuk entry tertentu
 */
export function DiscrepancyScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const initial = monthRange();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedSales, setSelectedSales] = useState<string | null>(null);
  const canClearHijau = !readOnly && (user?.role === "admin" || user?.role === "super_admin");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.warehouseDiscrepancy({ date_from: dateFrom, date_to: dateTo });
      setSummary(d.summary || []);
      setEntries(d.entries || []);
    } catch (e: any) {
      toast.show(e?.message || "Gagal memuat selisih", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, toast]);

  useEffect(() => { load(); }, [load]);

  const filteredEntries = useMemo(
    () => (selectedSales ? entries.filter((e) => e.sales_id === selectedSales) : entries),
    [entries, selectedSales],
  );

  const totalMerah = summary.reduce((s, x) => s + x.total_merah, 0);
  const totalHijau = summary.reduce((s, x) => s + x.total_hijau, 0);

  const doClear = (e: Entry) => {
    const wid = e.warehouse_entry_ids?.[0];
    if (!wid) return;
    Alert.alert(
      "Nolkan tanda hijau?",
      `Sales ${e.sales_code} · ${e.date}\nLebih ${e.hijau} galon → akan di-nolkan (bisa di-restore lagi).`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Nolkan",
          onPress: async () => {
            try {
              await api.clearHijau(wid);
              toast.show("Tanda hijau dinolkan", "success");
              load();
            } catch (er: any) {
              toast.show(er?.message || "Gagal", "error");
            }
          },
        },
      ],
    );
  };

  const doRestore = (e: Entry) => {
    const wid = e.warehouse_entry_ids?.[0];
    if (!wid) return;
    Alert.alert("Munculkan lagi hijau?", `Sales ${e.sales_code} · ${e.date}`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Munculkan",
        onPress: async () => {
          try {
            await api.restoreHijau(wid);
            toast.show("Tanda hijau dipulihkan", "success");
            load();
          } catch (er: any) {
            toast.show(er?.message || "Gagal", "error");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Selisih Galon</Text>
        <Text style={styles.headerSub}>Bawa Isi vs Galon Kembali</Text>
      </View>

      <View style={styles.filterRow}>
        <View style={styles.dateBox}>
          <Text style={styles.dateLabel}>Dari</Text>
          <TextInput
            value={dateFrom}
            onChangeText={setDateFrom}
            onBlur={load}
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            testID="disc-from"
          />
        </View>
        <View style={styles.dateBox}>
          <Text style={styles.dateLabel}>Sampai</Text>
          <TextInput
            value={dateTo}
            onChangeText={setDateTo}
            onBlur={load}
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            testID="disc-to"
          />
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn} testID="disc-reload">
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.totalsRow}>
        <View style={[styles.totalBox, { backgroundColor: "#FEE2E2" }]}>
          <Ionicons name="alert-circle" size={20} color={theme.color.error} />
          <Text style={styles.totalLabel}>Total Kurang</Text>
          <Text style={[styles.totalValue, { color: theme.color.error }]}>{totalMerah}</Text>
          <Text style={styles.totalUnit}>galon</Text>
        </View>
        <View style={[styles.totalBox, { backgroundColor: "#D1FAE5" }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.color.success} />
          <Text style={styles.totalLabel}>Total Lebih</Text>
          <Text style={[styles.totalValue, { color: theme.color.success }]}>{totalHijau}</Text>
          <Text style={styles.totalUnit}>galon</Text>
        </View>
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(e) => `${e.sales_id}-${e.date}`}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View>
            {summary.length === 0 ? null : (
              <>
                <Text style={styles.section}>Akumulasi per Sales</Text>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedSales(null)}
                    style={[styles.summaryRow, !selectedSales && styles.summaryRowActive]}
                    testID="filter-all-sales"
                  >
                    <Text style={styles.summaryName}>Semua Sales</Text>
                    <View style={{ flex: 1 }} />
                    <Badge value={totalMerah} kind="red" />
                    <Badge value={totalHijau} kind="green" />
                  </TouchableOpacity>
                  {summary.map((s) => (
                    <TouchableOpacity
                      key={s.sales_id}
                      onPress={() => setSelectedSales(s.sales_id === selectedSales ? null : s.sales_id)}
                      style={[styles.summaryRow, selectedSales === s.sales_id && styles.summaryRowActive]}
                      testID={`sum-${s.sales_code}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.summaryName}>
                          {s.sales_code || s.sales_name}
                          {s.group_letter ? <Text style={styles.summarySub}>  · Wilayah {s.group_letter}</Text> : null}
                        </Text>
                        <Text style={styles.summaryMeta}>
                          {s.days_merah}h merah · {s.days_hijau}h hijau
                          {s.total_hijau_raw > s.total_hijau ? `  · disimpan ${s.total_hijau_raw - s.total_hijau} hijau (di-nol-kan)` : ""}
                        </Text>
                      </View>
                      <Badge value={s.total_merah} kind="red" />
                      <Badge value={s.total_hijau} kind="green" />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={[styles.section, { marginTop: 16 }]}>
              Detail Harian {selectedSales ? `(${summary.find((x) => x.sales_id === selectedSales)?.sales_code})` : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.color.brandPrimary} />
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle" size={48} color={theme.color.success} />
              <Text style={styles.emptyText}>Tidak ada selisih pada periode ini 🎉</Text>
              <Text style={styles.emptySub}>Semua data Gudang & Produksi cocok.</Text>
            </View>
          )
        }
        renderItem={({ item: e }) => (
          <View style={styles.entryCard} testID={`entry-${e.sales_code}-${e.date}`}>
            <View style={styles.entryHead}>
              <View>
                <Text style={styles.entrySales}>{e.sales_code || e.sales_name}</Text>
                <Text style={styles.entryDate}>{e.date}</Text>
              </View>
              <View style={{ flex: 1 }} />
              {e.merah > 0 ? <Badge value={e.merah} kind="red" big /> : null}
              {e.hijau > 0 ? <Badge value={e.hijau} kind="green" big /> : null}
              {e.hijau_raw > 0 && e.hijau_cleared ? <Badge value={0} kind="gray" big label={`hijau ${e.hijau_raw} · dinolkan`} /> : null}
            </View>
            <Text style={styles.entryFormula}>
              Bawa Isi {e.bawa_total ?? e.galon_ganti_produksi} − Galon Kembali {e.galon_kembali ?? e.kosong_pulang} = {e.selisih > 0 ? "+" : ""}
              {e.selisih}
            </Text>
            {canClearHijau && (e.hijau > 0 || (e.hijau_raw > 0 && e.hijau_cleared)) ? (
              <View style={styles.entryActions}>
                {e.hijau > 0 ? (
                  <TouchableOpacity onPress={() => doClear(e)} style={styles.clearBtn} testID={`clear-${e.sales_code}-${e.date}`}>
                    <Ionicons name="remove-circle" size={14} color="#fff" />
                    <Text style={styles.clearText}>Nolkan Hijau</Text>
                  </TouchableOpacity>
                ) : null}
                {e.hijau_cleared ? (
                  <TouchableOpacity onPress={() => doRestore(e)} style={styles.restoreBtn} testID={`restore-${e.sales_code}-${e.date}`}>
                    <Ionicons name="refresh-circle" size={14} color="#fff" />
                    <Text style={styles.clearText}>Munculkan Hijau</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Badge({ value, kind, big = false, label }: { value: number; kind: "red" | "green" | "gray"; big?: boolean; label?: string }) {
  const bg = kind === "red" ? "#FEE2E2" : kind === "green" ? "#D1FAE5" : "#E5E7EB";
  const fg = kind === "red" ? theme.color.error : kind === "green" ? theme.color.success : theme.color.muted;
  if (value === 0 && !label) return null;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, big && styles.badgeBig]}>
      <Text style={[styles.badgeText, { color: fg }, big && { fontSize: 15 }]}>{label || value}</Text>
    </View>
  );
}

export default DiscrepancyScreen;

const styles = StyleSheet.create({
  header: { padding: 16, backgroundColor: theme.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  headerTitle: { fontSize: 18, fontWeight: "800", color: theme.color.onSurface },
  headerSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  filterRow: { flexDirection: "row", padding: 12, gap: 8, alignItems: "flex-end", backgroundColor: theme.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  dateBox: { flex: 1, gap: 4 },
  dateLabel: { fontSize: 10, fontWeight: "700", color: theme.color.onSurfaceSecondary },
  dateInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 8, fontSize: 12, color: theme.color.onSurface, backgroundColor: "#fff" },
  refreshBtn: { padding: 10, backgroundColor: theme.color.brandPrimary, borderRadius: 8 },
  totalsRow: { flexDirection: "row", gap: 8, padding: 12 },
  totalBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4 },
  totalLabel: { fontSize: 11, fontWeight: "700", color: theme.color.onSurface },
  totalValue: { fontSize: 24, fontWeight: "900" },
  totalUnit: { fontSize: 10, color: theme.color.muted },
  section: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface, marginBottom: 8 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: theme.color.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border },
  summaryRowActive: { borderColor: theme.color.brandPrimary, backgroundColor: theme.color.brandTertiary },
  summaryName: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface },
  summarySub: { fontSize: 11, color: theme.color.muted, fontWeight: "500" },
  summaryMeta: { fontSize: 10, color: theme.color.muted, marginTop: 2 },
  badge: { minWidth: 32, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignItems: "center" },
  badgeBig: { minWidth: 44, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  entryCard: { backgroundColor: theme.color.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.color.border },
  entryHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  entrySales: { fontSize: 15, fontWeight: "800", color: theme.color.onSurface },
  entryDate: { fontSize: 11, color: theme.color.muted },
  entryFormula: { marginTop: 8, fontSize: 12, color: theme.color.onSurfaceSecondary, fontWeight: "500" },
  entryActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.color.muted, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  restoreBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.color.success, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  clearText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptyBox: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface },
  emptySub: { fontSize: 12, color: theme.color.muted },
});
