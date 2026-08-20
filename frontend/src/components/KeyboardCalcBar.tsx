/**
 * KeyboardCalcBar — Floating "kalkulator" bar just above the mobile keyboard.
 *
 * Shows the numeric value that is currently being typed in a `TextInput`,
 * formatted as an Indonesian Rupiah (or plain number) with a big, bold font
 * — exactly like the display of a physical calculator.
 *
 * How to use:
 *   1. Mount `<KeyboardCalcBar />` once at the top of your app's layout.
 *   2. From any TextInput, call `bindCalcBar` to register/deregister its
 *      focus + value. The bar picks up focus events automatically.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { theme } from "@/src/theme";

// ─────────────────────────────────────────────
// Global registry (module-level pub/sub) — lets any input push its current
// value + a format function to a single mounted bar without a Context tree.
// ─────────────────────────────────────────────
type BarState = {
  visible: boolean;
  raw: string;
  formatted: string;
  hint?: string;
};
const listeners = new Set<(s: BarState) => void>();
let state: BarState = { visible: false, raw: "", formatted: "" };
function emit() { listeners.forEach((cb) => cb(state)); }

export function calcBarShow(raw: string, formatted: string, hint?: string) {
  state = { visible: true, raw, formatted, hint };
  emit();
}
export function calcBarHide() {
  state = { ...state, visible: false };
  emit();
}

const fmtRp = (n: number) =>
  new Intl.NumberFormat("id-ID").format(Number.isFinite(n) ? n : 0);

/**
 * Utility to bind a TextInput's value to the calc bar.
 * Call `onFocus={() => calcBarShow(raw, formatRp(raw))}` etc, OR use this hook
 * that returns handlers you can spread onto the TextInput.
 */
export function useCalcBar(
  value: string,
  opts?: { format?: (raw: string) => string; hint?: string; enabled?: boolean },
) {
  const enabled = opts?.enabled !== false;
  const focused = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (focused.current) {
      const raw = String(value || "");
      const n = parseInt(raw.replace(/[^\d-]/g, ""), 10) || 0;
      const formatted = opts?.format ? opts.format(raw) : `Rp ${fmtRp(n)}`;
      calcBarShow(raw, formatted, opts?.hint);
    }
  }, [value, enabled, opts]);

  return {
    onFocus: () => {
      focused.current = true;
      if (!enabled) return;
      const raw = String(value || "");
      const n = parseInt(raw.replace(/[^\d-]/g, ""), 10) || 0;
      const formatted = opts?.format ? opts.format(raw) : `Rp ${fmtRp(n)}`;
      calcBarShow(raw, formatted, opts?.hint);
    },
    onBlur: () => {
      focused.current = false;
      calcBarHide();
    },
  };
}

// ─────────────────────────────────────────────
// The floating bar UI
// ─────────────────────────────────────────────
export function KeyboardCalcBar() {
  const [s, setS] = useState<BarState>(state);
  const [kbHeight, setKbHeight] = useState(0);
  const [kbShown, setKbShown] = useState(false);

  useEffect(() => {
    const cb = (next: BarState) => setS(next);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKbHeight(e.endCoordinates?.height || 0);
      setKbShown(true);
    };
    const onHide = () => {
      setKbShown(false);
      setKbHeight(0);
    };
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const visible = s.visible && kbShown;
  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { bottom: kbHeight },
      ]}
    >
      <View style={styles.card}>
        <Text style={styles.label}>{s.hint || "Angka diketik"}</Text>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {s.formatted || "Rp 0"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    // pointerEvents:none so it doesn't steal touches on the keyboard.
  },
  card: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    minWidth: 200,
    maxWidth: "94%",
    borderTopWidth: 2,
    borderTopColor: theme.color.brand,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#94A3B8",
    textAlign: "right",
  },
  value: {
    fontSize: 30,
    fontWeight: "900",
    color: "#F1F5F9",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
});
