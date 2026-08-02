import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { theme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { show: (message: string, kind?: ToastKind) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; kind: ToastKind } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    setMsg({ text, kind });
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setMsg(null));
  }, [opacity]);

  const bg =
    msg?.kind === "success"
      ? theme.color.success
      : msg?.kind === "error"
        ? theme.color.error
        : theme.color.surfaceInverse;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { opacity, backgroundColor: bg }]}
          testID="toast"
        >
          <Text style={styles.text}>{msg.text}</Text>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { color: "#fff", fontSize: 14, textAlign: "center", fontWeight: "500" },
});
