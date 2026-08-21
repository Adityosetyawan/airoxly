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

type Field = { key: string; label: string; color: string };

// Warehouse basic (galon) fields — sparepart moved to dynamic part_qtys.
const WH_FIELDS: Field[] = [
  { key: "bawa_pagi", label: "Bawa Isi Pagi", color: "#059669" },
  { key: "bawa_siang", label: "Bawa Isi Siang", color: "#059669" },
  { key: "sisa_pagi", label: "Sisa Isi Pagi", color: "#F59E0B" },
  { key: "sisa_siang", label: "Sisa Isi Sore", color: "#F59E0B" },
  { key: "kosong_kembali_siang", label: "Galon Kembali Siang", color: "#6B7280" },
  { key: "kosong_kembali_sore", label: "Galon Kembali Sore", color: "#6B7280" },
];

// Production basic fields (galon) — sparepart moved to dynamic part_qtys.
const PROD_FIELDS: Field[] = [
  { key: "manual_adjust_before", label: "Produksi Sebelum", color: "#94A3B8" },
  { key: "manual_adjust", label: "Produksi Galon (adjust)", color: "#1E3A8A" },
  { key: "sisa_pagi", label: "Sisa Galon Pagi", color: "#F59E0B" },
  { key: "sisa_siang", label: "Sisa Galon Siang", color: "#F59E0B" },
];

export function EditEntryModal({ visible, onClose, onSaved, entry, kind }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [partList, setPartList] = useState<{ id: string; name: string; order?: number }[]>([]);
  const [partQtys, setPartQtys] = useState<Record<string, string>>({});
  const [shift, setShift] = useState<string>("pagi");
  const [note, setNote] = useState("");
  const [shifts, setShifts] = useState<{ key: string; label: string }[]>([]);

  const fields = kind === "production" ? PROD_FIELDS : WH_FIELDS;

  // Load part prices + shifts when opening.
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const p = await api.listPartPrices();
        const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        setPartList(sorted);
      } catch { /* ignore */ }
      try {
        const s = await api.getShifts();
        setShifts(s?.shifts || [{ key: "pagi", label: "PAGI" }, { key: "siang", label: "SIANG" }]);
      } catch {
        setShifts([{ key: "pagi", label: "PAGI" }, { key: "siang", label: "SIANG" }]);
      }
    })();
  }, [visible]);

  // Pre-fill from entry on open / when parts arrive.
  useEffect(() => {
    if (!entry) return;
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const val = entry[f.key];
      initial[f.key] = val === undefined || val === null ? "" : String(val);
    }
    setForm(initial);
    setShift(entry.shift || "pagi");
    setNote(entry.note || "");
    // Prefill part qtys from entry.part_qtys dict. Fallback to legacy top-level
    // fields (kran_ganti, seal_ganti, etc.) if a part with the same name exists.
    const legacyMap: Record<string, string[]> = {
      "Kran Ganti": ["kran_ganti"],
      "Seal Ganti": ["seal_ganti", "sil_ganti"],
      "Sil Ganti": ["sil_ganti", "seal_ganti"],
      "Mur Ganti": ["mur_ganti"],
      "Stiker Ganti": ["stiker_ganti"],
      "Karet Kran Ganti": ["karet_kran_ganti"],
      "Stoper Ganti": ["stoper_ganti"],
    };
    const pq: Record<string, string> = {};
    const src = entry.part_qtys && typeof entry.part_qtys === "object" ? entry.part_qtys : {};
    for (const p of partList) {
      const key = p.name;
      let v = src[key];
      if (v === undefined || v === null) {
        // Try legacy fallback fields.
        const legacyKeys = legacyMap[key] || [];
        for (const lk of legacyKeys) {
          if (entry[lk] !== undefined && entry[lk] !== null && entry[lk] !== 0) {
            v = entry[lk];
            break;
          }
        }
      }
      pq[key] = v === undefined || v === null ? "" : String(v);
    }
    setPartQtys(pq);
  }, [entry, fields, partList]);

  if (!entry) return null;

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const setPart = (name: string, v: string) => setPartQtys((s) => ({ ...s, [name]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      const body: any = { shift, note: note || null };
      for (const f of fields) body[f.key] = parseInt(form[f.key] || "0") || 0;
      // Pack part_qtys — only include parts with qty > 0.
      const pqBody: Record<string, number> = {};
      for (const p of partList) {
        const n = parseInt(partQtys[p.name] || "0") || 0;
        if (n > 0) pqBody[p.name] = n;
      }
      body.part_qtys = pqBody;
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

  const shiftOptions = shifts.length > 0 ? shifts : [{ key: "pagi", label: "PAGI" }, { key: "siang", label: "SIANG" }];

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
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {shiftOptions.map((s) => (
                <TouchableOpacity key={s.key} onPress={() => setShift(s.key)} style={[styles.shiftBtn, shift === s.key && styles.shiftBtnOn]}>
                  <Text style={[styles.shiftText, shift === s.key && { color: "#fff" }]}>{s.label.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle]}>Galon</Text>
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
                  testID={`edit-${f.key}`}
                />
              </View>
            ))}

            <Text style={[styles.sectionTitle]}>Penggantian Part / Sparepart</Text>
            {partList.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada daftar part. Cek menu Superadmin.</Text>
            ) : (
              partList.map((p) => (
                <View key={p.id} style={styles.numRow}>
                  <View style={[styles.numLabelBox, { backgroundColor: "#EC489922" }]}>
                    <View style={[styles.dot, { backgroundColor: "#EC4899" }]} />
                    <Text style={styles.numLabel}>{p.name}</Text>
                  </View>
                  <TextInput
                    value={partQtys[p.name] || ""}
                    onChangeText={(v) => setPart(p.name, v)}
                    keyboardType="number-pad"
                    placeholder="0"
                    style={styles.numInput}
                    testID={`edit-part-${p.name}`}
                  />
                </View>
              ))
            )}

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
  sectionTitle: { marginTop: 10, fontSize: 12, fontWeight: "800", color: theme.color.brand, textTransform: "uppercase", letterSpacing: 0.5, borderTopWidth: 1, borderTopColor: theme.color.divider, paddingTop: 8 },
  shiftBtn: { flexGrow: 1, minWidth: 80, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  shiftBtnOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  shiftText: { fontWeight: "700", color: theme.color.onSurface },
  numRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  numLabelBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  numLabel: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface, flexShrink: 1 },
  numInput: { width: 90, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: "#fff", color: theme.color.onSurface },
  emptyText: { fontSize: 12, color: theme.color.muted, fontStyle: "italic", padding: 8, textAlign: "center" },
  saveBtn: { backgroundColor: "#F59E0B", padding: 16, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
});
