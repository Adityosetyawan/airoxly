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
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hint?: string;
  allowNegative?: boolean;
  testID?: string;
}) {
  const n = parseInt(value || "0") || 0;
  const set = (nv: number) => onChange(String(allowNegative ? nv : Math.max(0, nv)));
  const rx = allowNegative ? /[^\-\d]/g : /[^\d]/g;
  return (
    <View style={styles.wrap} testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TouchableOpacity onPress={() => set(n - 1)} style={[styles.btn, { backgroundColor: theme.color.error }]} testID={testID ? `${testID}-minus` : undefined}>
          <Ionicons name="remove" size={16} color="#fff" />
        </TouchableOpacity>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(rx, ""))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.color.muted}
          style={styles.input}
        />
        <TouchableOpacity onPress={() => set(n + 1)} style={[styles.btn, { backgroundColor: theme.color.success }]} testID={testID ? `${testID}-plus` : undefined}>
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, marginTop: 6 },
  label: { fontSize: 11, color: theme.color.onSurfaceSecondary, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { padding: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", minWidth: 40 },
  input: { flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: 10, padding: 10, textAlign: "center", fontSize: 18, fontWeight: "800", backgroundColor: "#fff", color: theme.color.onSurface },
  hint: { fontSize: 10, color: theme.color.muted, fontStyle: "italic" },
});
