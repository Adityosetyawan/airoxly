import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type Kind = "production" | "warehouse";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  entry: any | null;
  kind: Kind;
}

const PROD_FIELDS: { key: string; label: string; color: string }[] = [
  { key: "galon_ganti", label: "Galon Ganti", color: "#94A3B8" },
  { key: "sil_ganti", label: "Sil / Seal Ganti", color: "#EF4444" },
  { key: "mur_ganti", label: "Mur Ganti", color: "#0EA5E9" },
  { key: "kran_ganti", label: "Kran Ganti", color: "#F59E0B" },
  { key: "stiker_ganti", label: "Stiker Ganti", color: "#84CC16" },
  { key: "stoper_ganti", label: "Stoper Ganti", color: "#8B5CF6" },
  { key: "karet_kran_ganti", label: "Karet Kran Ganti", color: "#EC4899" },
  { key: "produksi_galon", label: "Produksi Galon", color: "#1E3A8A" },
];

const WH_FIELDS: { key: string; label: string; color: string }[] = [
  { key: "galon_kran", label: "Galon Kran", color: "#0284C7" },
  { key: "galon_polos", label: "Galon Polos", color: "#64748B" },
  { key: "kran_ganti", label: "Kran Ganti", color: "#F59E0B" },
  { key: "seal_ganti", label: "Seal Ganti", color: "#EF4444" },
  { key: "mur_ganti", label: "Mur Ganti", color: "#0EA5E9" },
  { key: "stiker_ganti", label: "Stiker Ganti", color: "#84CC16" },
  { key: "karet_kran_ganti", label: "Karet Kran Ganti", color: "#EC4899" },
  { key: "stoper_ganti", label: "Stoper Ganti", color: "#8B5CF6" },
  { key: "bawa_pagi", label: "Bawa Pagi", color: "#059669" },
  { key: "bawa_siang", label: "Bawa Siang", color: "#059669" },
  { key: "sisa_pagi", label: "Sisa Pagi", color: "#F59E0B" },
  { key: "sisa_siang", label: "Sisa Siang", color: "#F59E0B" },
  { key: "kosong_pagi", label: "Kosong Pagi", color: "#6B7280" },
  { key: "kosong_siang", label: "Kosong Siang", color: "#6B7280" },
];

export function EditEntryModal({ visible, onClose, onSaved, entry, kind }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [shift, setShift] = useState<"pagi" | "siang">("pagi");
  const [note, setNote] = useState("");

  const fields = kind === "production" ? PROD_FIELDS : WH_FIELDS;

  useEffect(() => {
    if (!entry) return;
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = String(entry[f.key] ?? "");
    setForm(initial);
    setShift(entry.shift || "pagi");
    setNote(entry.note || "");
  }, [entry, fields]);

  if (!entry) return null;

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      const body: any = { shift, note: note || null };
      for (const f of fields) body[f.key] = parseInt(form[f.key] || "0") || 0;
      if (kind === "production") {
        await api.updateProductionDaily(entry.id, body);
      } else {
        await api.updateWarehouseDaily(entry.id, body);
      }
      toast.show("Entry berhasil diupdate", "success");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.show(e?.message || "Gagal update", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color={theme.color.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit {kind === "production" ? "Produksi" : "Gudang"}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <View style={styles.info}>
            <Text style={styles.infoText}>{entry.date} • {entry.sales_code}{entry.kelompok ? ` • ${entry.kelompok}` : ""}</Text>
            {entry.edit_count > 0 ? (
              <Text style={styles.warn}>⚠️ Entry sudah pernah diedit ({entry.edit_count}x). Hanya Super Admin yang bisa edit ulang.</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Shift</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["pagi", "siang"] as const).map((s) => (
                <TouchableOpacity key={s} onPress={() => setShift(s)} style={[styles.shiftBtn, shift === s && styles.shiftBtnOn]}>
                  <Text style={[styles.shiftText, shift === s && { color: "#fff" }]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {fields.map((f) => (
              <View key={f.key} style={styles.numRow}>
                <View style={[styles.numLabelBox, { backgroundColor: f.color + "22" }]}>
                  <View style={[styles.dot, { backgroundColor: f.color }]} />
                  <Text style={styles.numLabel}>{f.label}</Text>
                </View>
                <TextInput
                  value={form[f.key]}
                  onChangeText={(v) => set(f.key, v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  style={styles.numInput}
                />
              </View>
            ))}

            <Text style={[styles.label, { marginTop: 8 }]}>Catatan</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Catatan..."
              style={[styles.input, { height: 60 }]}
              multiline
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>SIMPAN PERUBAHAN</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.divider,
    backgroundColor: theme.color.surface,
  },
  title: { fontSize: 17, fontWeight: "800", color: theme.color.onSurface },
  info: { backgroundColor: theme.color.brandTertiary, padding: 10, borderRadius: 10, gap: 4 },
  infoText: { fontSize: 13, fontWeight: "700", color: theme.color.brand },
  warn: { fontSize: 12, color: theme.color.error, fontWeight: "600" },
  card: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 14, gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: theme.color.onSurfaceSecondary },
  shiftBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  shiftBtnOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  shiftText: { fontWeight: "700", color: theme.color.onSurface },
  numRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  numLabelBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  numLabel: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  numInput: { width: 90, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: "#fff", color: theme.color.onSurface },
  saveBtn: { backgroundColor: "#F59E0B", padding: 16, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
});
