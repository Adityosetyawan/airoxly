import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, User } from "@/src/api";

export default function AdminSales() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await api.listUsers();
      setUsers(u);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales Wilayah</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(admin)/sales-form", params: {} })}
          style={styles.addBtn}
          testID="add-sales-btn"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: "/(admin)/sales-form", params: { id: item.id } })}
            testID={`sales-${item.id}`}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.sales_code || "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name || item.username}</Text>
              <Text style={styles.meta}>{item.username} · {item.wa_number || "-"}</Text>
              <Text style={styles.meta}>Gaji Rp {rp(item.salary || 0)} + Komisi Rp {rp(item.commission || 0)} + Bonus Rp {rp(item.bonus || 0)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.color.muted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada sales terdaftar</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.color.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  badge: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  badgeText: { color: theme.color.onBrandTertiary, fontWeight: "700", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "500", color: theme.color.onSurface },
  meta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  empty: { textAlign: "center", color: theme.color.muted, padding: 40 },
});
