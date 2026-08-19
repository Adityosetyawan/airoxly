import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Customer, User } from "@/src/api";
import ExportCustomerModal from "@/src/components/ExportCustomerModal";

export type SortId = "no" | "ranking" | "recent" | "last" | "loans" | "debt";

const SORTS: { id: SortId; label: string; icon: any }[] = [
  { id: "no", label: "No. Urut", icon: "list-outline" },
  { id: "ranking", label: "Ranking Belanja", icon: "trophy-outline" },
  { id: "recent", label: "Terbaru Beli", icon: "sparkles-outline" },
  { id: "last", label: "Terlama Beli", icon: "time-outline" },
  { id: "loans", label: "Pinjam Galon", icon: "cube-outline" },
  { id: "debt", label: "Hutang Terbesar", icon: "cash-outline" },
];

type Props = {
  /** Where to navigate on card tap. Should render a route that resolves the customer id. */
  onOpenCustomer: (id: string) => void;
  /** Show a sales-filter dropdown at the top (Admin & SuperAdmin). */
  showSalesFilter?: boolean;
  /** Restrict sales users list by group letter (Admin). */
  restrictGroupLetter?: string;
  title?: string;
};

export default function CustomersList({
  onOpenCustomer,
  showSalesFilter = false,
  restrictGroupLetter,
  title = "Pelanggan",
}: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<SortId>("no");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [salesList, setSalesList] = useState<User[]>([]);
  const [salesId, setSalesId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listCustomers({
        sort,
        q: q || undefined,
        sales_id: salesId || undefined,
      });
      setItems(r);
    } catch {}
  }, [sort, q, salesId]);

  // Load sales users for filter dropdown once
  useEffect(() => {
    if (!showSalesFilter) return;
    (async () => {
      try {
        const users = await api.listUsers({
          role: "sales",
          group_letter: restrictGroupLetter,
        });
        setSalesList(users.filter((u) => !u.disabled));
      } catch {}
    })();
  }, [showSalesFilter, restrictGroupLetter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalDebt = useMemo(() => items.reduce((a, c) => a + (c.total_debt || 0), 0), [items]);
  const totalLoans = useMemo(() => items.reduce((a, c) => a + (c.gallon_loans || 0), 0), [items]);

  const selectedSales = useMemo(
    () => salesList.find((u) => u.id === salesId),
    [salesList, salesId],
  );

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={styles.exportHeaderBtn}
          onPress={() => setExportOpen(true)}
          testID="export-pdf-btn"
        >
          <Ionicons name="document-text-outline" size={18} color={theme.color.brand} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.color.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          placeholder="Cari nama atau barcode…"
          placeholderTextColor={theme.color.muted}
          style={styles.search}
          testID="customer-search"
        />
      </View>

      {showSalesFilter && (
        <TouchableOpacity
          style={styles.salesFilter}
          onPress={() => setPickerOpen(true)}
          testID="sales-filter-btn"
        >
          <Ionicons name="funnel-outline" size={16} color={theme.color.onSurfaceSecondary} />
          <Text style={styles.salesFilterText}>
            {selectedSales
              ? `${selectedSales.sales_code || ""} · ${selectedSales.name || selectedSales.username}`
              : "Semua Sales"}
          </Text>
          {salesId ? (
            <TouchableOpacity onPress={() => setSalesId("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.color.muted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={16} color={theme.color.muted} />
          )}
        </TouchableOpacity>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setSort(s.id)}
            style={[styles.chip, sort === s.id && styles.chipActive]}
            testID={`sort-${s.id}`}
          >
            <Ionicons
              name={s.icon}
              size={14}
              color={sort === s.id ? "#fff" : theme.color.onSurfaceSecondary}
            />
            <Text style={[styles.chipText, sort === s.id && styles.chipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Total Hutang Pelanggan</Text>
          <Text style={[styles.sumValue, { color: theme.color.error }]}>Rp {rp(totalDebt)}</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Total Pinjam Galon</Text>
          <Text style={styles.sumValue}>{totalLoans} gln</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Jumlah Pelanggan</Text>
          <Text style={styles.sumValue}>{items.length}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onOpenCustomer(item.id)}
            testID={`customer-${item.id}`}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>
                {sort === "no" ? `#${item.customer_no}` : `#${index + 1}`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{item.name}</Text>
              <Text style={styles.cSub}>
                {item.barcode_id}
                {item.sales_code ? ` · ${item.sales_code}` : ""}
                {item.last_purchase_date
                  ? " · " + new Date(item.last_purchase_date).toLocaleDateString("id-ID")
                  : " · belum belanja"}
              </Text>
              <View style={styles.tagsRow}>
                {item.total_debt > 0 && (
                  <View style={[styles.tag, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.tagText, { color: theme.color.error }]}>
                      Hutang Rp {rp(item.total_debt)}
                    </Text>
                  </View>
                )}
                {item.gallon_loans > 0 && (
                  <View style={[styles.tag, { backgroundColor: theme.color.brandTertiary }]}>
                    <Text style={[styles.tagText, { color: theme.color.onBrandTertiary }]}>
                      {item.gallon_loans} gln
                    </Text>
                  </View>
                )}
                <View style={[styles.tag, { backgroundColor: theme.color.surfaceSecondary }]}>
                  <Text style={[styles.tagText, { color: theme.color.onSurfaceSecondary }]}>
                    {item.purchase_count || 0}× beli
                  </Text>
                </View>
                {item.has_photo && (
                  <View style={[styles.tag, { backgroundColor: theme.color.brandTertiary, flexDirection: "row", alignItems: "center", gap: 2 }]}>
                    <Ionicons name="camera" size={11} color={theme.color.onBrandTertiary} />
                  </View>
                )}
                {(sort === "ranking" || sort === "debt" || sort === "loans") &&
                  item.total_purchases > 0 && (
                    <View style={[styles.tag, { backgroundColor: theme.color.surfaceSecondary }]}>
                      <Text style={[styles.tagText, { color: theme.color.onSurfaceSecondary }]}>
                        Total Rp {rp(item.total_purchases)}
                      </Text>
                    </View>
                  )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada pelanggan</Text>
          </View>
        }
      />

      {/* Sales picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pilih Sales</Text>
            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setSalesId("");
                setPickerOpen(false);
              }}
            >
              <Ionicons name="people-outline" size={20} color={theme.color.onSurface} />
              <Text style={styles.sheetItemText}>Semua Sales</Text>
              {!salesId && <Ionicons name="checkmark" size={20} color={theme.color.brandPrimary} />}
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 360 }}>
              {salesList.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.sheetItem}
                  onPress={() => {
                    setSalesId(u.id);
                    setPickerOpen(false);
                  }}
                >
                  <View style={styles.salesCode}>
                    <Text style={styles.salesCodeText}>{u.sales_code || "?"}</Text>
                  </View>
                  <Text style={styles.sheetItemText}>{u.name || u.username}</Text>
                  {salesId === u.id && (
                    <Ionicons name="checkmark" size={20} color={theme.color.brandPrimary} />
                  )}
                </TouchableOpacity>
              ))}
              {salesList.length === 0 && (
                <Text style={styles.empty}>Belum ada sales</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ExportCustomerModal
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        fixedSalesId={salesId || undefined}
        salesOptions={salesList.map((u) => ({
          id: u.id,
          code: u.sales_code || u.username,
          name: u.name,
          group_letter: u.group_letter,
        }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  backBtn: { padding: 4, width: 32 },
  title: { fontSize: 18, fontWeight: "600", color: theme.color.onSurface },
  exportHeaderBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.color.brand,
    backgroundColor: theme.color.surface,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: 12,
    gap: 8,
  },
  search: { flex: 1, paddingVertical: 12, fontSize: 14, color: theme.color.onSurface },
  salesFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  salesFilterText: {
    flex: 1,
    fontSize: 13,
    color: theme.color.onSurface,
    fontWeight: "500",
  },
  chipRow: { height: 44, marginBottom: 12, flexGrow: 0 },
  chip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  summary: {
    flexDirection: "row",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.surfaceSecondary,
    marginBottom: 4,
  },
  sumItem: { flex: 1 },
  sumDivider: { width: 1, backgroundColor: theme.color.border, marginHorizontal: 12 },
  sumLabel: { fontSize: 11, color: theme.color.muted },
  sumValue: { fontSize: 15, fontWeight: "600", color: theme.color.onSurface, marginTop: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 8,
    gap: 12,
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: theme.color.onBrandTertiary, fontWeight: "600", fontSize: 12 },
  cName: { fontSize: 15, fontWeight: "500", color: theme.color.onSurface },
  cSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: "500" },
  empty: { alignItems: "center", padding: 48 },
  emptyText: { color: theme.color.muted, marginTop: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.color.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "600", color: theme.color.onSurface, marginBottom: 12 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  sheetItemText: { flex: 1, fontSize: 14, color: theme.color.onSurface },
  salesCode: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  salesCodeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
