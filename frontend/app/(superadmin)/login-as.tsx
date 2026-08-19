import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api, User } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

/**
 * SuperAdmin — Login Sebagai (Quick Impersonate)
 *
 * Menampilkan semua akun (Admin/Sales/Gudang/Produksi) dalam satu halaman
 * dengan tab per-role, search, dan tombol "Masuk" satu-tap.
 *
 * Setelah tap Masuk → langsung navigate ke dashboard role tersebut.
 * Untuk kembali → banner orange di atas layar → tap "Kembali".
 */

const ROLE_TABS = [
  { key: "all", label: "Semua", icon: "grid-outline" },
  { key: "admin", label: "Admin", icon: "shield-checkmark-outline" },
  { key: "sales", label: "Sales", icon: "bicycle-outline" },
  { key: "gudang", label: "Gudang", icon: "cube-outline" },
  { key: "produksi", label: "Produksi", icon: "hammer-outline" },
] as const;

const ROLE_META: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  admin: { color: "#7C3AED", bg: "#EDE9FE", label: "Admin", icon: "shield-checkmark" },
  sales: { color: "#059669", bg: "#D1FAE5", label: "Sales", icon: "bicycle" },
  gudang: { color: "#D97706", bg: "#FEF3C7", label: "Gudang", icon: "cube" },
  produksi: { color: "#0EA5E9", bg: "#DBEAFE", label: "Produksi", icon: "hammer" },
  super_admin: { color: "#1F2937", bg: "#E5E7EB", label: "Super Admin", icon: "star" },
};

export default function LoginAsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { impersonate } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listUsers();
      setUsers(list);
    } catch (e: any) {
      toast.show(e?.message || "Gagal muat daftar user", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.role !== "super_admin") // Skip superadmin sendiri
      .filter((u) => activeRole === "all" || u.role === activeRole)
      .filter((u) => {
        if (!q) return true;
        return (
          (u.username || "").toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q) ||
          (u.sales_code || "").toLowerCase().includes(q) ||
          (u.group_letter || "").toLowerCase().includes(q)
        );
      });
  }, [users, activeRole, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, admin: 0, sales: 0, gudang: 0, produksi: 0 };
    users.forEach((u) => {
      if (u.role === "super_admin") return;
      c.all += 1;
      if (c[u.role] !== undefined) c[u.role] += 1;
    });
    return c;
  }, [users]);

  const handleImpersonate = async (u: User) => {
    if (busyId) return;
    setBusyId(u.id);
    try {
      await impersonate(u.id);
      toast.show(`Login sebagai ${u.name || u.username}`, "success");
      // Navigate ke dashboard role sesuai
      const target =
        u.role === "admin"
          ? "/(admin)/dashboard"
          : u.role === "sales"
          ? "/(sales)/dashboard"
          : u.role === "gudang"
          ? "/(gudang)/dashboard"
          : u.role === "produksi"
          ? "/(produksi)/dashboard"
          : "/";
      setTimeout(() => {
        try {
          // @ts-ignore dismissAll expo-router
          if (typeof (router as any).dismissAll === "function") {
            (router as any).dismissAll();
          }
        } catch {}
        router.replace(target as any);
      }, 250);
    } catch (e: any) {
      toast.show(e?.message || "Gagal impersonate", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Login Sebagai</Text>
          <Text style={styles.subtitle}>Akses cepat ke akun Admin / Sales / Gudang / Produksi</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={theme.color.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari nama / username / kode sales…"
          placeholderTextColor={theme.color.muted}
          style={styles.searchInput}
          testID="login-as-search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")} testID="clear-search">
            <Ionicons name="close-circle" size={18} color={theme.color.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Role tabs */}
      <View style={styles.tabRow}>
        {ROLE_TABS.map((t) => {
          const active = activeRole === t.key;
          const count = counts[t.key] || 0;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveRole(t.key)}
              style={[styles.tab, active && styles.tabActive]}
              testID={`role-tab-${t.key}`}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={active ? "#fff" : theme.color.onSurfaceSecondary}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label} · {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.color.brandPrimary} />
          <Text style={{ color: theme.color.muted, marginTop: 8 }}>Memuat…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
          style={{ flex: 1 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-outline" size={40} color={theme.color.muted} />
              <Text style={styles.emptyText}>
                {query ? "Tidak ada user sesuai pencarian" : "Belum ada user di kategori ini"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = ROLE_META[item.role] || ROLE_META.admin;
            return (
              <View style={styles.card}>
                <View style={[styles.avatar, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.name || item.username}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {item.sales_code ? (
                      <Text style={styles.metaText}>· {item.sales_code}</Text>
                    ) : null}
                    {item.group_letter ? (
                      <Text style={styles.metaText}>· Wilayah {item.group_letter}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.userSub} numberOfLines={1}>
                    @{item.username}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleImpersonate(item)}
                  disabled={busyId === item.id}
                  style={[styles.masukBtn, busyId === item.id && { opacity: 0.5 }]}
                  testID={`impersonate-${item.username}`}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={14} color="#fff" />
                      <Text style={styles.masukText}>Masuk</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: "row", alignItems: "center", padding: 12, gap: 4 },
  backBtn: { padding: 8, borderRadius: 8 },
  title: { fontSize: 18, fontWeight: "700", color: theme.color.onSurface },
  subtitle: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.color.onSurface, padding: 0 },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.color.surfaceSecondary,
  },
  tabActive: { backgroundColor: theme.color.brandPrimary },
  tabText: { fontSize: 12, fontWeight: "600", color: theme.color.onSurfaceSecondary },
  tabTextActive: { color: "#fff" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface },
  userSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: "700" },
  metaText: { fontSize: 10, color: theme.color.muted },
  masukBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.color.brandPrimary,
    minWidth: 78,
    justifyContent: "center",
  },
  masukText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { fontSize: 13, color: theme.color.muted, textAlign: "center" },
});
