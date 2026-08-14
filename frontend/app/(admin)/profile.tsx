import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/AuthContext";

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.username || "?")[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name || user?.username}</Text>
        <Text style={styles.role}>Admin · Wilayah {user?.group_letter || "-"}</Text>

        <View style={styles.card}>
          <Row label="Username" value={user?.username || "-"} />
          <Row label="Wilayah" value={user?.group_letter || "-"} />
          <Row label="No. WA" value={user?.wa_number || "-"} />
        </View>

        <TouchableOpacity onPress={logout} style={styles.logout} testID="logout-btn">
          <Ionicons name="log-out-outline" size={20} color={theme.color.error} />
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8 },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface, textAlign: "center", marginTop: 12 },
  role: { fontSize: 13, color: theme.color.muted, textAlign: "center", marginBottom: 20 },
  card: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  rowLabel: { fontSize: 13, color: theme.color.muted },
  rowValue: { fontSize: 14, color: theme.color.onSurface, fontWeight: "500" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.color.error, marginTop: 12 },
  logoutText: { color: theme.color.error, fontWeight: "600" },
  panduanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.brand,
    backgroundColor: theme.color.brandTertiary,
    marginTop: 20,
  },
  panduanText: { color: theme.color.brand, fontWeight: "700" },
});
