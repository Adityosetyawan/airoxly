import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/AuthContext";

export default function ProduksiProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Profil" />
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="hammer" size={30} color="#fff" />
          </View>
          <Text style={styles.name}>{user?.name || user?.username}</Text>
          <Text style={styles.role}>PRODUKSI</Text>
          <Text style={styles.username}>@{user?.username}</Text>
        </View>
        <TouchableOpacity style={styles.panduanBtn} onPress={() => router.push("/panduan")} testID="panduan-btn">
          <Ionicons name="book-outline" size={20} color={theme.color.brand} />
          <Text style={styles.panduanText}>Buku Panduan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  card: { backgroundColor: theme.color.surface, borderRadius: 16, padding: 20, alignItems: "center", gap: 6 },
  avatar: { width: 68, height: 68, borderRadius: 999, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  name: { fontSize: 18, fontWeight: "800", color: theme.color.onSurface },
  role: { fontSize: 11, fontWeight: "700", color: theme.color.brand, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  username: { fontSize: 12, color: theme.color.muted },
  panduanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.color.brandTertiary,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.brand,
  },
  panduanText: { color: theme.color.brand, fontWeight: "700", fontSize: 15 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.color.error, padding: 14, borderRadius: 12 },
  logoutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
