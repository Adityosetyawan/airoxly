import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = React.useState(false);

  if (!isImpersonating || !user) return null;

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const orig = await stopImpersonation();
      toast.show(`Kembali ke ${orig?.name || orig?.username || "Super Admin"}`, "success");
      // Navigasi utama sudah dihandle di AuthContext.stopImpersonation()
      // Ini fallback tambahan kalau navigasi dari context gagal
    } catch (e: any) {
      toast.show(e?.message || "Gagal keluar impersonate", "error");
    } finally {
      setBusy(false);
    }
  };

  const topPad = Platform.OS === "web" ? 0 : Math.max(insets.top, 24);

  return (
    <View style={[styles.wrap, { paddingTop: topPad }]} pointerEvents="box-none">
      <TouchableOpacity
        onPress={handleStop}
        activeOpacity={0.85}
        style={styles.bar}
        testID="stop-impersonate-btn"
        disabled={busy}
      >
        <Ionicons name="arrow-back" size={16} color="#fff" />
        <Text style={styles.text} numberOfLines={1}>
          Login sebagai <Text style={styles.bold}>{user.username}</Text> — Tap untuk kembali
        </Text>
        <View style={styles.btn}>
          <Text style={styles.btnText}>{busy ? "..." : "Kembali"}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...(Platform.OS === "web"
      ? { position: "fixed" as any, top: 0, left: 0, right: 0, zIndex: 9999 }
      : { position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999, elevation: 20 }),
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#B45309",
    marginTop: 6,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    minHeight: 40,
  },
  text: { color: "#fff", fontSize: 12, flexShrink: 1 },
  bold: { fontWeight: "800" },
  btn: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  btnText: { fontSize: 12, fontWeight: "800", color: theme.color.brandPrimary },
});
