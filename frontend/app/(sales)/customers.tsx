import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Customer } from "@/src/api";

const SORTS = [
  { id: "no", label: "No. Urut", icon: "list-outline" },
  { id: "ranking", label: "Ranking Belanja", icon: "trophy-outline" },
  { id: "last", label: "Terlama Beli", icon: "time-outline" },
  { id: "loans", label: "Pinjam Galon", icon: "cube-outline" },
] as const;

export default function Customers() {
  const router = useRouter();
  const [sort, setSort] = useState<string>("no");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listCustomers({ sort, q: q || undefined });
      setItems(r);
    } catch {}
  }, [sort, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalDebt = useMemo(() => items.reduce((a, c) => a + (c.total_debt || 0), 0), [items]);
  const totalLoans = useMemo(() => items.reduce((a, c) => a + (c.gallon_loans || 0), 0), [items]);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Pelanggan</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/(sales)/customer/new")}
          testID="add-customer-btn"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Baru</Text>
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
              name={s.icon as any}
              size={14}
              color={sort === s.id ? theme.color.onBrandPrimary : theme.color.onSurfaceSecondary}
            />
            <Text style={[styles.chipText, sort === s.id && styles.chipTextActive]}>{s.label}</Text>
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
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: "/(sales)/customer/[id]", params: { id: item.id } })}
            testID={`customer-${item.id}`}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{sort === "ranking" ? `#${index + 1}` : `#${item.customer_no}`}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{item.name}</Text>
              <Text style={styles.cSub}>
                {item.barcode_id}
                {item.last_purchase_date
                  ? " · " + new Date(item.last_purchase_date).toLocaleDateString("id-ID")
                  : " · belum belanja"}
              </Text>
              <View style={styles.tagsRow}>
                {item.total_debt > 0 && (
                  <View style={[styles.tag, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.tagText, { color: theme.color.error }]}>Hutang Rp {rp(item.total_debt)}</Text>
                  </View>
                )}
                {item.gallon_loans > 0 && (
                  <View style={[styles.tag, { backgroundColor: theme.color.brandTertiary }]}>
                    <Text style={[styles.tagText, { color: theme.color.onBrandTertiary }]}>{item.gallon_loans} gln</Text>
                  </View>
                )}
                <View style={[styles.tag, { backgroundColor: theme.color.surfaceSecondary }]}>
                  <Text style={[styles.tagText, { color: theme.color.onSurfaceSecondary }]}>
                    {item.purchase_count || 0}× beli
                  </Text>
                </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.color.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
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
});
