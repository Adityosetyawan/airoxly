import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

/**
 * NumStepper — kompak +/- untuk angka, cocok diletakkan tepat di bawah foto.
 * value = string (biar user bisa ketik "-" atau kosongin dulu).
 * allowNegative default true (untuk penyesuaian +/-).
 */
export function NumStepper({
  value,
  onChange,
  label,
  hint,
  allowNegative = true,
  testID,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hint?: string;
  allowNegative?: boolean;
  testID?: string;
  compact?: boolean;
}) {
  const n = parseInt(value || "0") || 0;
  const set = (nv: number) => onChange(String(allowNegative ? nv : Math.max(0, nv)));
  const rx = allowNegative ? /[^\-\d]/g : /[^\d]/g;
  const s = compact ? compactStyles : styles;
  return (
    <View style={s.wrap} testID={testID}>
      {label ? <Text style={s.label} numberOfLines={1}>{label}</Text> : null}
      <View style={s.row}>
        <TouchableOpacity onPress={() => set(n - 1)} style={[s.btn, { backgroundColor: theme.color.error }]} testID={testID ? `${testID}-minus` : undefined}>
          <Ionicons name="remove" size={compact ? 14 : 16} color="#fff" />
        </TouchableOpacity>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(rx, ""))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.color.muted}
          style={s.input}
        />
        <TouchableOpacity onPress={() => set(n + 1)} style={[s.btn, { backgroundColor: theme.color.success }]} testID={testID ? `${testID}-plus` : undefined}>
          <Ionicons name="add" size={compact ? 14 : 16} color="#fff" />
        </TouchableOpacity>
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, marginTop: 6 },
  label: { fontSize: 11, color: theme.color.onSurfaceSecondary, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { padding: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", minWidth: 40 },
  input: { flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: 10, padding: 10, textAlign: "center", fontSize: 18, fontWeight: "800", backgroundColor: "#fff", color: theme.color.onSurface, minWidth: 0 },
  hint: { fontSize: 10, color: theme.color.muted, fontStyle: "italic" },
});

// Kompak: khusus layout 2-kolom side-by-side agar tidak overflow di layar sempit
const compactStyles = StyleSheet.create({
  wrap: { gap: 3, marginTop: 4, flex: 1, minWidth: 0 },
  label: { fontSize: 10, color: theme.color.onSurfaceSecondary, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  btn: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 30, height: 36 },
  input: { flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 4, textAlign: "center", fontSize: 15, fontWeight: "800", backgroundColor: "#fff", color: theme.color.onSurface, minWidth: 0, height: 36 },
  hint: { fontSize: 10, color: theme.color.muted, fontStyle: "italic" },
});
