import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { PhotoCapture } from "@/src/components/PhotoCapture";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type SalesUser = { id: string; sales_code?: string; name?: string; group_letter?: string };
type Shift = { key: string; label: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Produksi Input — flow baru sesuai spec Aug 2026:
 *  1. Pilih Sales (search)
 *  2. Pilih Shift (dinamis, dari settings)
 *  3. Foto SEBELUM (galon kosong sebelum diisi) → AI hitung otomatis → readonly count
 *  4. Foto SESUDAH (galon isi setelah diisi)   → AI hitung otomatis → readonly count
 *  5. Manual +/- adjust  (kolom terpisah)
 *  6. Destinasi: Kirim Gudang | Langsung Jual
 *  7. Total produksi = ai_count_after + manual_adjust (auto-computed, ditampilkan)
 */
export default function ProduksiInput() {
  const toast = useToast();
  const [sales, setSales] = useState<SalesUser[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    date: todayStr(),
    shift: "pagi",
    sales_id: "",
    destination: "gudang" as "gudang" | "sales",
    manual_adjust: "0",         // +/- string agar user bisa ketik "-2"
    galon_ganti: "",
    sil_ganti: "",
    mur_ganti: "",
    kran_ganti: "",
    stiker_ganti: "",
    stoper_ganti: "",
    karet_kran_ganti: "",
    note: "",
  });

  const [photoBefore, setPhotoBefore] = useState<string | null>(null);
  const [photoAfter, setPhotoAfter] = useState<string | null>(null);
  const [aiBefore, setAiBefore] = useState<{ count: number; confidence: string; reasoning: string } | null>(null);
  const [aiAfter, setAiAfter] = useState<{ count: number; confidence: string; reasoning: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const users = await api.listUsers({ role: "sales" });
        const list = (users || []).filter((u: any) => !u.disabled).map((u: any) => ({
          id: u.id, sales_code: u.sales_code, name: u.name, group_letter: u.group_letter,
        }));
        list.sort((a: any, b: any) => (a.sales_code || "").localeCompare(b.sales_code || ""));
        setSales(list);
        if (list[0]) setForm((f) => ({ ...f, sales_id: list[0].id }));
      } catch {}
      try {
        const s = await api.getShifts();
        const list = s.shifts || [];
        setShifts(list);
        if (list[0]) setForm((f) => ({ ...f, shift: list[0].key }));
      } catch {}
    })();
  }, []);

  const setF = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as SalesUser[];
    return sales.filter((s) => (s.sales_code || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q));
  }, [sales, search]);

  const selectedSales = sales.find((s) => s.id === form.sales_id);

  // Total produksi = AI (setelah) + manual adjust
  const manualN = parseInt(form.manual_adjust || "0") || 0;
  const totalProduksi = (aiAfter?.count || 0) + manualN;

  const onSave = async () => {
    if (!form.sales_id) return toast.show("Pilih Sales dulu", "error");
    if (!aiAfter) return toast.show("Foto galon isi (setelah) wajib untuk hitung produksi", "error");
    setSaving(true);
    try {
      const body: any = {
        date: form.date,
        shift: form.shift,
        sales_id: form.sales_id,
        destination: form.destination,
        ai_count_before: aiBefore?.count ?? null,
        ai_count_after: aiAfter?.count ?? null,
        manual_adjust: manualN,
        produksi_galon: Math.max(0, totalProduksi),
        photo_before: photoBefore || null,
        photo_after: photoAfter || null,
        ai_confidence: aiAfter?.confidence || null,
        galon_ganti: parseInt(form.galon_ganti || "0") || 0,
        sil_ganti: parseInt(form.sil_ganti || "0") || 0,
        mur_ganti: parseInt(form.mur_ganti || "0") || 0,
        kran_ganti: parseInt(form.kran_ganti || "0") || 0,
        stiker_ganti: parseInt(form.stiker_ganti || "0") || 0,
        stoper_ganti: parseInt(form.stoper_ganti || "0") || 0,
        karet_kran_ganti: parseInt(form.karet_kran_ganti || "0") || 0,
        note: form.note || null,
      };
      await api.createProductionDaily(body);
      toast.show(
        `Produksi tersimpan: ${totalProduksi} galon (${form.destination === "gudang" ? "Kirim Gudang" : "Langsung Jual"})`,
        "success",
      );
      // Reset foto & AI supaya tidak accidental double-save
      setPhotoBefore(null);
      setPhotoAfter(null);
      setAiBefore(null);
      setAiAfter(null);
      setForm((f) => ({ ...f, manual_adjust: "0", galon_ganti: "", sil_ganti: "", mur_ganti: "", kran_ganti: "", stiker_ganti: "", stoper_ganti: "", karet_kran_ganti: "", note: "" }));
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const confidenceBadge = (c?: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      high: { bg: "#D1FAE5", text: "#065F46", label: "AI: yakin" },
      medium: { bg: "#FEF3C7", text: "#92400E", label: "AI: cek ulang" },
      low: { bg: "#FEE2E2", text: "#991B1B", label: "AI: kurang yakin" },
    };
    return map[c || "low"] || map.low;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Input Harian Produksi" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Row label="Tanggal">
            <TextInput value={form.date} onChangeText={(t) => setF("date", t)} placeholder="YYYY-MM-DD" style={styles.input} />
          </Row>

          <Row label="Shift">
            <View style={styles.shiftRow}>
              {shifts.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setF("shift", s.key)}
                  style={[styles.shiftBtn, form.shift === s.key && styles.shiftBtnOn]}
                  testID={`shift-${s.key}`}
                >
                  <Text style={[styles.shiftText, form.shift === s.key && { color: "#fff" }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>

          <Row label="Sales">
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={theme.color.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama atau kode sales… (contoh: A1)"
                placeholderTextColor={theme.color.muted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                testID="produksi-sales-search"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color={theme.color.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
            {selectedSales ? (
              <View style={styles.selectedBox}>
                <Ionicons name="checkmark-circle" size={16} color={theme.color.brandPrimary} />
                <Text style={styles.selectedText}>
                  Terpilih: <Text style={{ fontWeight: "800" }}>{selectedSales.sales_code || selectedSales.name}</Text>
                  {selectedSales.group_letter ? `  ·  Wilayah ${selectedSales.group_letter}` : ""}
                </Text>
              </View>
            ) : (
              <Text style={styles.emptyChip}>Ketik untuk mencari sales…</Text>
            )}
            {search.trim().length > 0 && filteredSales.length > 0 ? (
              <View style={styles.groupWrap}>
                {filteredSales.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => { setF("sales_id", s.id); setSearch(""); }}
                    style={[styles.chip, form.sales_id === s.id && styles.chipOn]}
                    testID={`prodsales-chip-${s.sales_code}`}
                  >
                    <Text style={[styles.chipText, form.sales_id === s.id && { color: "#fff" }]}>
                      {s.sales_code || s.name}
                      {s.group_letter ? <Text style={{ opacity: 0.6, fontSize: 10 }}> · {s.group_letter}</Text> : null}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </Row>

          <SectionTitle>1️⃣ Foto Galon Kosong (SEBELUM diisi)</SectionTitle>
          <PhotoCapture
            value={photoBefore}
            onChange={(v) => { setPhotoBefore(v); if (!v) setAiBefore(null); }}
            label="Foto galon kosong"
            watermark
            aiCount
            hintForAI="galon kosong sebelum diisi"
            onAICount={(count, confidence, reasoning) => setAiBefore({ count, confidence, reasoning })}
            testID="photo-produksi-before"
          />
          {aiBefore ? (
            <View style={[styles.aiBox, { backgroundColor: confidenceBadge(aiBefore.confidence).bg }]}>
              <Text style={[styles.aiTitle, { color: confidenceBadge(aiBefore.confidence).text }]}>
                🤖 AI hitung: <Text style={{ fontWeight: "900" }}>{aiBefore.count}</Text> galon · {confidenceBadge(aiBefore.confidence).label}
              </Text>
              <Text style={styles.aiDesc}>{aiBefore.reasoning}</Text>
            </View>
          ) : null}

          <SectionTitle>2️⃣ Foto Galon Isi (SETELAH diisi)</SectionTitle>
          <PhotoCapture
            value={photoAfter}
            onChange={(v) => { setPhotoAfter(v); if (!v) setAiAfter(null); }}
            label="Foto galon isi (produk jadi)"
            watermark
            aiCount
            hintForAI="galon air isi setelah diisi"
            onAICount={(count, confidence, reasoning) => setAiAfter({ count, confidence, reasoning })}
            testID="photo-produksi-after"
          />
          {aiAfter ? (
            <View style={[styles.aiBox, { backgroundColor: confidenceBadge(aiAfter.confidence).bg }]}>
              <Text style={[styles.aiTitle, { color: confidenceBadge(aiAfter.confidence).text }]}>
                🤖 AI hitung: <Text style={{ fontWeight: "900" }}>{aiAfter.count}</Text> galon · {confidenceBadge(aiAfter.confidence).label}
              </Text>
              <Text style={styles.aiDesc}>{aiAfter.reasoning}</Text>
            </View>
          ) : null}

          <SectionTitle>3️⃣ Penyesuaian Manual (+/−)</SectionTitle>
          <View style={styles.adjustRow}>
            <TouchableOpacity onPress={() => setF("manual_adjust", String((parseInt(form.manual_adjust || "0") || 0) - 1))} style={styles.adjBtn}>
              <Ionicons name="remove" size={20} color="#fff" />
            </TouchableOpacity>
            <TextInput
              value={form.manual_adjust}
              onChangeText={(v) => setF("manual_adjust", v.replace(/[^\-\d]/g, ""))}
              keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
              placeholder="0"
              style={styles.adjInput}
              testID="manual-adjust-input"
            />
            <TouchableOpacity onPress={() => setF("manual_adjust", String((parseInt(form.manual_adjust || "0") || 0) + 1))} style={[styles.adjBtn, { backgroundColor: theme.color.success }]}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.adjHint}>Sesuaikan jika jumlah kenyataan di mobil beda dari AI (contoh: -2 kalau 2 galon rusak)</Text>

          <View style={styles.totalBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.totalLabel}>TOTAL PRODUKSI</Text>
              <Text style={styles.totalSub}>AI ({aiAfter?.count || 0}) {manualN >= 0 ? "+" : ""}{manualN} penyesuaian</Text>
            </View>
            <Text style={styles.totalValue}>{Math.max(0, totalProduksi)}</Text>
            <Text style={styles.totalUnit}>gln</Text>
          </View>

          <SectionTitle>4️⃣ Destinasi</SectionTitle>
          <View style={styles.destRow}>
            <TouchableOpacity
              onPress={() => setF("destination", "gudang")}
              style={[styles.destBtn, form.destination === "gudang" && styles.destBtnOn]}
              testID="dest-gudang"
            >
              <Ionicons name="archive" size={20} color={form.destination === "gudang" ? "#fff" : theme.color.brand} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.destTitle, form.destination === "gudang" && { color: "#fff" }]}>Kirim Gudang</Text>
                <Text style={[styles.destDesc, form.destination === "gudang" && { color: "#fff", opacity: 0.85 }]}>+{Math.max(0, totalProduksi)} stok gudang</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setF("destination", "sales")}
              style={[styles.destBtn, form.destination === "sales" && styles.destBtnOnAlt]}
              testID="dest-sales"
            >
              <Ionicons name="cart" size={20} color={form.destination === "sales" ? "#fff" : "#F59E0B"} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.destTitle, form.destination === "sales" && { color: "#fff" }]}>Langsung Jual</Text>
                <Text style={[styles.destDesc, form.destination === "sales" && { color: "#fff", opacity: 0.85 }]}>tidak ke gudang, langsung ke sales</Text>
              </View>
            </TouchableOpacity>
          </View>

          <SectionTitle>Sparepart Ganti (opsional)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Galon Ganti" value={form.galon_ganti} onChange={(v) => setF("galon_ganti", v)} />
            <NumFieldSmall label="Kran Ganti" value={form.kran_ganti} onChange={(v) => setF("kran_ganti", v)} />
          </View>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Sil / Seal" value={form.sil_ganti} onChange={(v) => setF("sil_ganti", v)} />
            <NumFieldSmall label="Mur" value={form.mur_ganti} onChange={(v) => setF("mur_ganti", v)} />
          </View>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Stiker" value={form.stiker_ganti} onChange={(v) => setF("stiker_ganti", v)} />
            <NumFieldSmall label="Karet Kran" value={form.karet_kran_ganti} onChange={(v) => setF("karet_kran_ganti", v)} />
          </View>

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

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving || !aiAfter} testID="produksi-save-btn">
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.saveText}>
              {aiAfter ? "SIMPAN PRODUKSI" : "Foto galon ISI dulu"}
            </Text>
          )}
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
    borderWidth: 1, borderColor: theme.color.border, borderRadius: 10,
    padding: Platform.OS === "ios" ? 12 : 10, fontSize: 15,
    backgroundColor: "#fff", color: theme.color.onSurface,
  },
  shiftRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shiftBtn: { flex: 1, minWidth: "22%", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  shiftBtnOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  shiftText: { fontWeight: "700", color: theme.color.onSurface, fontSize: 13 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff", marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.color.onSurface },
  selectedBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: theme.color.brandTertiary, marginBottom: 6 },
  selectedText: { fontSize: 13, color: theme.color.onBrandTertiary, fontWeight: "600" },
  emptyChip: { fontSize: 12, color: theme.color.muted, fontStyle: "italic", textAlign: "center", padding: 8 },
  groupWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  aiBox: { padding: 10, borderRadius: 10, gap: 4 },
  aiTitle: { fontSize: 13, fontWeight: "700" },
  aiDesc: { fontSize: 11, color: theme.color.onSurfaceSecondary },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center" },
  adjBtn: { padding: 14, borderRadius: 999, backgroundColor: theme.color.error, alignItems: "center", justifyContent: "center" },
  adjInput: { minWidth: 100, borderWidth: 2, borderColor: theme.color.border, borderRadius: 12, padding: 12, textAlign: "center", fontSize: 24, fontWeight: "900", backgroundColor: "#fff" },
  adjHint: { fontSize: 10, color: theme.color.muted, textAlign: "center", fontStyle: "italic" },
  totalBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.color.brand, padding: 14, borderRadius: 12 },
  totalLabel: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  totalSub: { color: "#fff", fontSize: 10, opacity: 0.85, marginTop: 2 },
  totalValue: { color: "#fff", fontSize: 34, fontWeight: "900" },
  totalUnit: { color: "#fff", fontSize: 12, opacity: 0.75 },
  destRow: { flexDirection: "row", gap: 10 },
  destBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: theme.color.border, backgroundColor: "#fff" },
  destBtnOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  destBtnOnAlt: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  destTitle: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface },
  destDesc: { fontSize: 10, color: theme.color.muted, marginTop: 2 },
  smallLabel: { fontSize: 11, color: theme.color.muted, fontWeight: "600" },
  smallInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  saveBtn: { backgroundColor: theme.color.brand, padding: 16, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: 1 },
});
