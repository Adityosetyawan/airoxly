import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const DISMISS_KEY = "pwa_install_hint_dismissed";

/**
 * Bottom-of-screen banner shown ONLY on web on a mobile-shaped viewport when
 * the site is NOT already installed as a PWA. Dismissible & remembers.
 *
 * On Android Chrome we can trigger a native install via `beforeinstallprompt`.
 * On iOS Safari there is no programmatic prompt — we show a short "Bagikan →
 * Add to Home Screen" instruction instead.
 */
export default function PwaInstallHint() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // Skip if already installed / display-mode standalone
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      // @ts-ignore iOS
      window.navigator.standalone === true;
    if (standalone) return;

    // Only nag on mobile-shaped viewports
    if (window.innerWidth > 640) return;

    // Detect platform
    const ua = window.navigator.userAgent || "";
    let p: "android" | "ios" | "other" = "other";
    if (/android/i.test(ua)) p = "android";
    else if (/iPad|iPhone|iPod/.test(ua)) p = "ios";
    setPlatform(p);

    (async () => {
      const dismissed = await storage.getItem<string>(DISMISS_KEY, "");
      if (dismissed === "1") return;
      setVisible(true);
    })();

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = async () => {
    await storage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (deferred?.prompt) {
      try {
        deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice?.outcome === "accepted") {
          setVisible(false);
        }
      } catch {}
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Ionicons name="phone-portrait-outline" size={22} color={theme.color.brand} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pasang Air OXLY ke Home Screen</Text>
          <Text style={styles.body}>
            {platform === "ios"
              ? "Tap tombol Bagikan ⎙ di Safari lalu pilih “Ke Home Screen”."
              : platform === "android"
              ? deferred
                ? "Tap Pasang untuk simpan sebagai app di HP Anda."
                : "Buka menu ⋮ Chrome → “Pasang aplikasi” untuk simpan sebagai app."
              : "Simpan halaman ini sebagai bookmark home screen untuk akses cepat."}
          </Text>
        </View>
        <View style={styles.actions}>
          {platform === "android" && deferred ? (
            <Pressable onPress={install} style={styles.installBtn}>
              <Text style={styles.installText}>Pasang</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={dismiss} hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={18} color={theme.color.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    zIndex: 1000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  body: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  installBtn: {
    backgroundColor: theme.color.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  installText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  close: { padding: 4 },
});
