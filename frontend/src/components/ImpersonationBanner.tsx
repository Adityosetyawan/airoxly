import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

/**
 * Global sticky banner shown when the current session is a Super Admin
 * impersonation. Provides a one-tap "Kembali ke Super Admin" action.
 *
 * Rendered by the root layout so it's visible on every screen (login, error
 * pages, etc.).
 */
export default function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  if (!isImpersonating || !user) return null;

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const orig = await stopImpersonation();
      toast.show(`Kembali ke ${orig?.name || orig?.username || "Super Admin"}`, "success");
      setTimeout(() => router.replace("/"), 200);
    } catch (e: any) {
      toast.show(e?.message || "Gagal keluar impersonate", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Ionicons name="person-circle" size={18} color="#fff" />
        <Text style={styles.text} numberOfLines={1}>
          Login sebagai <Text style={styles.bold}>{user.username}</Text>
          {" "}({(user.role || "").replace("_", " ")})
        </Text>
        <TouchableOpacity onPress={handleStop} style={styles.btn} testID="stop-impersonate-btn" disabled={busy}>
          <Ionicons name="arrow-back" size={14} color={theme.color.brandPrimary} />
          <Text style={styles.btnText}>{busy ? "..." : "Kembali"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...(Platform.OS === "web"
      ? { position: "fixed" as any, top: 0, left: 0, right: 0, zIndex: 9999 }
      : { position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999 }),
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 0 : 30,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#B45309",
    marginTop: 4,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: { color: "#fff", fontSize: 12, flexShrink: 1 },
  bold: { fontWeight: "800" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  btnText: { fontSize: 11, fontWeight: "700", color: theme.color.brandPrimary },
});
