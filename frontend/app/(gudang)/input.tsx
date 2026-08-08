import React, { useEffect, useState } from "react";
import {
  ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from "react-native";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type SalesUser = { id: string; sales_code?: string; name?: string; group_letter?: string };
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function GudangInput() {
  const toast = useToast();
  const [sales, setSales] = useState<SalesUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [form, setForm] = useState({
    date: todayStr(),
    shift: "pagi" as "pagi" | "siang",
    sales_id: "",
    galon_kran: "",
    galon_polos: "",
    kran_ganti: "",
    seal_ganti: "",
    mur_ganti: "",
    stiker_ganti: "",
    karet_kran_ganti: "",
    stoper_ganti: "",
    bawa_pagi: "",
    bawa_siang: "",
    kosong_pagi: "",
    kosong_siang: "",
    sisa_pagi: "",
    sisa_siang: "",
    note: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const users = await api.listUsers({ role: "sales" });
        const list = (users || []).filter((u: any) => !u.disabled).map((u: any) => ({
          id: u.id, sales_code: u.sales_code, name: u.name, group_letter: u.group_letter,
        }));
        setSales(list);
        if (list[0]) setForm((f) => ({ ...f, sales_id: list[0].id }));
      } catch {}
    })();
  }, []);

  const setF = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const doValidate = async (sid: string, date: string) => {
    try {
      const v = await api.validateSalesBawaSisa(sid, date);
      setValidation(v);
    } catch {}
  };

  const onSave = async () => {
    if (!form.sales_id) return toast.show("Pilih Group (Sales)", "error");
    setSaving(true);
    try {
      const body = {
        date: form.date,
        shift: form.shift,
        sales_id: form.sales_id,
        galon_kran: parseInt(form.galon_kran || "0") || 0,
        galon_polos: parseInt(form.galon_polos || "0") || 0,
        kran_ganti: parseInt(form.kran_ganti || "0") || 0,
        seal_ganti: parseInt(form.seal_ganti || "0") || 0,
        mur_ganti: parseInt(form.mur_ganti || "0") || 0,
        stiker_ganti: parseInt(form.stiker_ganti || "0") || 0,
        karet_kran_ganti: parseInt(form.karet_kran_ganti || "0") || 0,
        stoper_ganti: parseInt(form.stoper_ganti || "0") || 0,
        bawa_pagi: parseInt(form.bawa_pagi || "0") || 0,
        bawa_siang: parseInt(form.bawa_siang || "0") || 0,
        kosong_pagi: parseInt(form.kosong_pagi || "0") || 0,
        kosong_siang: parseInt(form.kosong_siang || "0") || 0,
        sisa_pagi: parseInt(form.sisa_pagi || "0") || 0,
        sisa_siang: parseInt(form.sisa_siang || "0") || 0,
        note: form.note || null,
      };
      await api.createWarehouseDaily(body);
      toast.show("Input gudang berhasil disimpan", "success");
      // Auto validate after save
      await doValidate(form.sales_id, form.date);
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const bawa = (parseInt(form.bawa_pagi || "0") || 0) + (parseInt(form.bawa_siang || "0") || 0);
  const sisa = (parseInt(form.sisa_pagi || "0") || 0) + (parseInt(form.sisa_siang || "0") || 0);
  const terjual = bawa - sisa;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Input Harian Gudang" />
      <ScrollView contentContainerStyle={styles.body}>
        {validation && !validation.match ? (
          <View style={styles.alertRed}>
            <Text style={styles.alertTitle}>⚠️ Selisih dengan Transaksi Sales!</Text>
            <Text style={styles.alertText}>
              Terjual (Bawa−Sisa) = {validation.terjual_by_gudang} galon{"\n"}
              Terjual di Transaksi App = {validation.terjual_by_transaksi} galon{"\n"}
              Selisih: {validation.diff > 0 ? "+" : ""}{validation.diff}
            </Text>
          </View>
        ) : null}
        {validation && validation.match ? (
          <View style={styles.alertGreen}>
            <Text style={styles.alertTitle}>✅ Data cocok dengan transaksi Sales</Text>
            <Text style={styles.alertText}>Terjual: {validation.terjual_by_gudang} galon</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Row label="Tanggal">
            <TextInput value={form.date} onChangeText={(t) => setF("date", t)} placeholder="YYYY-MM-DD" style={styles.input} />
          </Row>

          <Row label="Shift">
            <View style={styles.shiftRow}>
              {(["pagi", "siang"] as const).map((s) => (
                <TouchableOpacity key={s} onPress={() => setF("shift", s)} style={[styles.shiftBtn, form.shift === s && styles.shiftBtnOn]}>
                  <Text style={[styles.shiftText, form.shift === s && { color: "#fff" }]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>

          <Row label="Group (Sales)">
            <View style={styles.groupWrap}>
              {sales.map((s) => (
                <TouchableOpacity key={s.id} onPress={() => setF("sales_id", s.id)} style={[styles.chip, form.sales_id === s.id && styles.chipOn]}>
                  <Text style={[styles.chipText, form.sales_id === s.id && { color: "#fff" }]}>{s.sales_code || s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>

          <SectionTitle>Aktivitas Sales (Bawa / Sisa)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Bawa Pagi" value={form.bawa_pagi} onChange={(v) => setF("bawa_pagi", v)} />
            <NumFieldSmall label="Sisa Pagi" value={form.sisa_pagi} onChange={(v) => setF("sisa_pagi", v)} />
          </View>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Bawa Siang" value={form.bawa_siang} onChange={(v) => setF("bawa_siang", v)} />
            <NumFieldSmall label="Sisa Siang" value={form.sisa_siang} onChange={(v) => setF("sisa_siang", v)} />
          </View>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Kosong Pagi" value={form.kosong_pagi} onChange={(v) => setF("kosong_pagi", v)} />
            <NumFieldSmall label="Kosong Siang" value={form.kosong_siang} onChange={(v) => setF("kosong_siang", v)} />
          </View>

          <View style={styles.terjualBox}>
            <Text style={styles.terjualLabel}>Terjual (Bawa − Sisa)</Text>
            <Text style={styles.terjualValue}>{terjual}</Text>
          </View>

          <SectionTitle>Penggantian Galon</SectionTitle>
          <NumField label="Galon Kran (➖ Stok Galon Kran)" value={form.galon_kran} onChange={(v) => setF("galon_kran", v)} color="#0284C7" />
          <NumField label="Galon Polos (➖ Stok Galon Polos)" value={form.galon_polos} onChange={(v) => setF("galon_polos", v)} color="#64748B" />

          <SectionTitle>Sparepart Ganti</SectionTitle>
          <NumField label="Kran Ganti" value={form.kran_ganti} onChange={(v) => setF("kran_ganti", v)} color="#F59E0B" />
          <NumField label="Seal Ganti" value={form.seal_ganti} onChange={(v) => setF("seal_ganti", v)} color="#EF4444" />
          <NumField label="Mur Ganti" value={form.mur_ganti} onChange={(v) => setF("mur_ganti", v)} color="#0EA5E9" />
          <NumField label="Stiker Ganti" value={form.stiker_ganti} onChange={(v) => setF("stiker_ganti", v)} color="#84CC16" />
          <NumField label="Karet Kran Ganti" value={form.karet_kran_ganti} onChange={(v) => setF("karet_kran_ganti", v)} color="#EC4899" />
          <NumField label="Stoper Ganti" value={form.stoper_ganti} onChange={(v) => setF("stoper_ganti", v)} color="#8B5CF6" />

          <Row label="Catatan (opsional)">
            <TextInput
              value={form.note}
              onChangeText={(t) => setF("note", t)}
              placeholder="Keterangan..."
              style={[styles.input, { height: 60 }]}
              multiline
            />
          </Row>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>SIMPAN</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}
function NumField({ label, value, onChange, color }: { label: string; value: string; onChange: (v: string) => void; color: string }) {
  return (
    <View style={styles.numRow}>
      <View style={[styles.numLabelBox, { backgroundColor: color + "22" }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.numLabel}>{label}</Text>
      </View>
      <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="0" style={styles.numInput} />
    </View>
  );
}
function NumFieldSmall({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="0" style={styles.smallInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  card: { backgroundColor: theme.color.surface, borderRadius: 14, padding: 14, gap: 10 },
  row: { gap: 6 },
  rowTwo: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, fontWeight: "600", color: theme.color.onSurfaceSecondary },
  sectionTitle: { marginTop: 8, fontSize: 13, fontWeight: "800", color: theme.color.brand, borderTopWidth: 1, borderTopColor: theme.color.divider, paddingTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    padding: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    backgroundColor: "#fff",
    color: theme.color.onSurface,
  },
  shiftRow: { flexDirection: "row", gap: 8 },
  shiftBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  shiftBtnOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  shiftText: { fontWeight: "700", color: theme.color.onSurface },
  groupWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  numRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  numLabelBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  numLabel: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  numInput: {
    width: 90,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    textAlign: "center",
    backgroundColor: "#fff",
    fontWeight: "700",
  },
  smallLabel: { fontSize: 11, color: theme.color.muted, fontWeight: "600" },
  smallInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  terjualBox: { backgroundColor: theme.color.brandTertiary, padding: 12, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  terjualLabel: { fontSize: 12, fontWeight: "700", color: theme.color.onBrandTertiary },
  terjualValue: { fontSize: 22, fontWeight: "900", color: theme.color.onBrandTertiary },
  alertRed: { backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: theme.color.error, gap: 4 },
  alertGreen: { backgroundColor: "#D1FAE5", borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: theme.color.success, gap: 4 },
  alertTitle: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface },
  alertText: { fontSize: 12, color: theme.color.onSurface },
  saveBtn: {
    backgroundColor: "#F59E0B",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: 1 },
});
