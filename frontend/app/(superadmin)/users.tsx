import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api, User } from "@/src/api";

const TABS = [
  { id: "all", label: "Semua", role: undefined },
  { id: "super_admin", label: "Super Admin", role: "super_admin" },
  { id: "admin", label: "Admin", role: "admin" },
  { id: "sales", label: "Sales", role: "sales" },
] as const;

export default function SuperUsers() {
  const router = useRouter();
  const [tab, setTab] = useState<string>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const role = TABS.find((t) => t.id === tab)?.role;
      const r = await api.listUsers({ role });
      setUsers(r);
    } catch {}
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Kelola User</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(superadmin)/user-form", params: {} })}
          style={styles.addBtn}
          testID="add-user-btn"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[styles.chip, tab === t.id && styles.chipActive]} testID={`tab-${t.id}`}>
            <Text style={[styles.chipText, tab === t.id && styles.chipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: "/(superadmin)/user-form", params: { id: item.id } })}
            testID={`user-${item.username}`}
          >
            <View style={[styles.badge, item.role === "super_admin" ? { backgroundColor: theme.color.brandPrimary } : item.role === "admin" ? { backgroundColor: theme.color.brandSecondary } : { backgroundColor: theme.color.brandTertiary }]}>
              <Text style={[styles.badgeText, item.role === "sales" && { color: theme.color.onBrandTertiary }]}>
                {item.sales_code || item.group_letter || item.role[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name || item.username}</Text>
              <Text style={styles.meta}>{item.username} · {item.role.replace("_", " ")}</Text>
              {item.disabled && <Text style={styles.disabled}>Nonaktif</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Tidak ada user</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", padding: 16, alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.color.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  chipRow: { height: 48, flexGrow: 0, marginBottom: 4 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: theme.color.surfaceSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, color: theme.color.onSurfaceSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  badge: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  name: { fontSize: 15, fontWeight: "500", color: theme.color.onSurface },
  meta: { fontSize: 11, color: theme.color.muted, marginTop: 2, textTransform: "capitalize" },
  disabled: { fontSize: 10, color: theme.color.error, marginTop: 2, fontWeight: "600" },
  empty: { textAlign: "center", color: theme.color.muted, padding: 40 },
});
