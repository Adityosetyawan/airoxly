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
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function GudangInput() {
  const toast = useToast();
  const [sales, setSales] = useState<SalesUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [discrepancy, setDiscrepancy] = useState<{ merah: number; hijau: number; kosong_pulang: number; galon_ganti_produksi: number; hijau_cleared: boolean } | null>(null);
  const [search, setSearch] = useState("");
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
    kosong_kembali_siang: "",
    kosong_kembali_sore: "",
    sisa_pagi: "",
    sisa_siang: "",
    note: "",
  });
  const [photoIsiPagi, setPhotoIsiPagi] = useState<string | null>(null);
  const [photoIsiSiang, setPhotoIsiSiang] = useState<string | null>(null);
  const [photoKosongSiang, setPhotoKosongSiang] = useState<string | null>(null);
  const [photoKosongSore, setPhotoKosongSore] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const users = await api.listUsers({ role: "sales" });
        const list = (users || []).filter((u: any) => !u.disabled).map((u: any) => ({
          id: u.id, sales_code: u.sales_code, name: u.name, group_letter: u.group_letter,
        }));
        // Sort by group + code so pemakai tetap terarah
        list.sort((a: any, b: any) => (a.sales_code || "").localeCompare(b.sales_code || ""));
        setSales(list);
        if (list[0]) setForm((f) => ({ ...f, sales_id: list[0].id }));
      } catch {}
    })();
  }, []);

  const setF = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  // Filter sales by search (nama atau kode)
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        (s.sales_code || "").toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q),
    );
  }, [sales, search]);

  const doValidate = async (sid: string, date: string) => {
    try {
      const v = await api.validateSalesBawaSisa(sid, date);
      setValidation(v);
    } catch {}
    try {
      const d = await api.warehouseDiscrepancy({ date_from: date, date_to: date, sales_id: sid });
      const first = d.entries?.[0];
      if (first) {
        setDiscrepancy({
          merah: first.merah,
          hijau: first.hijau,
          kosong_pulang: first.kosong_pulang,
          galon_ganti_produksi: first.galon_ganti_produksi,
          hijau_cleared: first.hijau_cleared,
        });
      } else {
        setDiscrepancy(null);
      }
    } catch {}
  };

  // Real-time preview selisih (client-side, sebelum simpan) — banding dengan input Produksi hari itu
  useEffect(() => {
    if (!form.sales_id) return;
    doValidate(form.sales_id, form.date);
  }, [form.sales_id, form.date]);

  const onSave = async () => {
    if (!form.sales_id) return toast.show("Pilih Sales dulu", "error");
    setSaving(true);
    try {
      const body: any = {
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
        kosong_kembali_siang: parseInt(form.kosong_kembali_siang || "0") || 0,
        kosong_kembali_sore: parseInt(form.kosong_kembali_sore || "0") || 0,
        sisa_pagi: parseInt(form.sisa_pagi || "0") || 0,
        sisa_siang: parseInt(form.sisa_siang || "0") || 0,
        note: form.note || null,
      };
      if (photoIsiPagi) body.photo_isi_pagi = photoIsiPagi;
      if (photoIsiSiang) body.photo_isi_siang = photoIsiSiang;
      if (photoKosongSiang) body.photo_kosong_siang = photoKosongSiang;
      if (photoKosongSore) body.photo_kosong_sore = photoKosongSore;
      await api.createWarehouseDaily(body);
      toast.show("Input Gudang tersimpan", "success");
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
  const kosongPulang =
    (parseInt(form.kosong_kembali_siang || "0") || 0) + (parseInt(form.kosong_kembali_sore || "0") || 0);
  const selectedSales = sales.find((s) => s.id === form.sales_id);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Input Harian Gudang" />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Discrepancy indicator (merah / hijau vs input Produksi) */}
        {discrepancy && (discrepancy.merah > 0 || discrepancy.hijau > 0) ? (
          <View style={[styles.discrepancyBox, discrepancy.merah > 0 ? styles.discrepancyRed : styles.discrepancyGreen]}>
            <Ionicons name={discrepancy.merah > 0 ? "alert-circle" : "checkmark-circle"} size={22} color={discrepancy.merah > 0 ? theme.color.error : theme.color.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.discrepancyTitle}>
                {discrepancy.merah > 0 ? `Kurang ${discrepancy.merah} galon kosong` : `Lebih ${discrepancy.hijau} galon kosong`}
              </Text>
              <Text style={styles.discrepancyDesc}>
                Kosongan pulang: {discrepancy.kosong_pulang} · Galon diganti Produksi: {discrepancy.galon_ganti_produksi}
              </Text>
            </View>
          </View>
        ) : null}
        {discrepancy && discrepancy.merah === 0 && discrepancy.hijau === 0 && (discrepancy.kosong_pulang > 0 || discrepancy.galon_ganti_produksi > 0) ? (
          <View style={[styles.discrepancyBox, styles.discrepancyOK]}>
            <Ionicons name="shield-checkmark" size={22} color={theme.color.success} />
            <Text style={styles.discrepancyTitle}>Kosongan cocok dengan input Produksi ✓</Text>
          </View>
        ) : null}
        {validation && !validation.match && validation.terjual_by_transaksi > 0 ? (
          <View style={styles.alertRed}>
            <Text style={styles.alertTitle}>⚠️ Selisih dengan Transaksi Sales</Text>
            <Text style={styles.alertText}>
              Terjual (Bawa−Sisa) = {validation.terjual_by_gudang} · Transaksi App = {validation.terjual_by_transaksi} · Selisih {validation.diff > 0 ? "+" : ""}{validation.diff}
            </Text>
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

          <Row label={`Sales ${sales.length ? `(pilih 1 dari ${sales.length})` : ""}`}>
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
                testID="gudang-sales-search"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color={theme.color.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
            {/* Selected sales indicator — selalu tampil kalau ada */}
            {selectedSales ? (
              <View style={styles.selectedBox}>
                <Ionicons name="checkmark-circle" size={16} color={theme.color.brandPrimary} />
                <Text style={styles.selectedText}>
                  Terpilih: <Text style={{ fontWeight: "800" }}>{selectedSales.sales_code || selectedSales.name}</Text>
                  {selectedSales.group_letter ? `  ·  Wilayah ${selectedSales.group_letter}` : ""}
                </Text>
                {selectedSales.name && selectedSales.sales_code ? (
                  <Text style={styles.selectedSub} numberOfLines={1}>{selectedSales.name}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.emptyChip}>Ketik untuk mencari sales…</Text>
            )}
            {/* Chips hanya muncul saat search aktif — supaya layar rapi. */}
            {search.trim().length > 0 ? (
              filteredSales.length === 0 ? (
                <Text style={styles.emptyChip}>Tidak ada sales yang cocok</Text>
              ) : (
                <View style={styles.groupWrap}>
                  {filteredSales.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        setF("sales_id", s.id);
                        setSearch("");
                      }}
                      style={[styles.chip, form.sales_id === s.id && styles.chipOn]}
                      testID={`sales-chip-${s.sales_code}`}
                    >
                      <Text style={[styles.chipText, form.sales_id === s.id && { color: "#fff" }]}>
                        {s.sales_code || s.name}
                        {s.group_letter ? <Text style={{ opacity: 0.6, fontSize: 10 }}> · {s.group_letter}</Text> : null}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : null}
          </Row>

          <SectionTitle>1️⃣ Bawa Isi (dari foto real)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Bawa Isi Pagi" value={form.bawa_pagi} onChange={(v) => setF("bawa_pagi", v)} />
            <NumFieldSmall label="Bawa Isi Siang" value={form.bawa_siang} onChange={(v) => setF("bawa_siang", v)} />
          </View>
          <View style={styles.photoGrid}>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoIsiPagi} onChange={setPhotoIsiPagi} label="Isi Pagi" testID="photo-isi-pagi" />
            </View>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoIsiSiang} onChange={setPhotoIsiSiang} label="Isi Siang" testID="photo-isi-siang" />
            </View>
          </View>

          <SectionTitle>2️⃣ Sisa Isi (belum terjual — diisi Gudang)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Sisa Isi Pagi" value={form.sisa_pagi} onChange={(v) => setF("sisa_pagi", v)} />
            <NumFieldSmall label="Sisa Isi Sore" value={form.sisa_siang} onChange={(v) => setF("sisa_siang", v)} />
          </View>

          <View style={styles.terjualBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.terjualLabel}>Terjual (Bawa Isi − Sisa Isi)</Text>
              <Text style={styles.terjualSub}>({bawa} − {sisa} = galon terjual ke konsumen)</Text>
            </View>
            <Text style={styles.terjualValue}>{terjual}</Text>
          </View>

          <SectionTitle>3️⃣ Kosong Kembali (dari foto real)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Kosong Kembali Siang" value={form.kosong_kembali_siang} onChange={(v) => setF("kosong_kembali_siang", v)} />
            <NumFieldSmall label="Kosong Kembali Sore" value={form.kosong_kembali_sore} onChange={(v) => setF("kosong_kembali_sore", v)} />
          </View>
          <View style={styles.photoGrid}>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoKosongSiang} onChange={setPhotoKosongSiang} label="Kosong Siang" testID="photo-kosong-siang" />
            </View>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoKosongSore} onChange={setPhotoKosongSore} label="Kosong Sore" testID="photo-kosong-sore" />
            </View>
          </View>
          {kosongPulang > 0 || form.sales_id ? (
            <View style={styles.kosongInfoBox}>
              <Ionicons name="information-circle" size={14} color={theme.color.brand} />
              <Text style={styles.kosongInfoText}>
                Total kosong pulang: <Text style={{ fontWeight: "800" }}>{kosongPulang}</Text> galon — akan dibandingkan dengan galon diganti Produksi
              </Text>
            </View>
          ) : null}

          <SectionTitle>Kosong Berangkat (opsional — legacy)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Kosong Awal Pagi" value={form.kosong_pagi} onChange={(v) => setF("kosong_pagi", v)} />
            <NumFieldSmall label="Kosong Awal Siang" value={form.kosong_siang} onChange={(v) => setF("kosong_siang", v)} />
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

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving} testID="gudang-save-btn">
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.color.onSurface },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.color.brandTertiary,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  selectedText: { fontSize: 13, color: theme.color.onBrandTertiary, fontWeight: "600" },
  selectedSub: { fontSize: 11, color: theme.color.onBrandTertiary, opacity: 0.75, flexBasis: "100%" },
  emptyChip: { fontSize: 12, color: theme.color.muted, fontStyle: "italic", textAlign: "center", padding: 8 },
  groupWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, maxHeight: 200, marginTop: 4 },
  terjualSub: { fontSize: 10, color: theme.color.onBrandTertiary, opacity: 0.7, marginTop: 2 },
  kosongInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    backgroundColor: theme.color.brandTertiary,
    borderRadius: 8,
    marginTop: 4,
  },
  kosongInfoText: { fontSize: 11, color: theme.color.onBrandTertiary, flex: 1, lineHeight: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  numRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  numLabelBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  numLabel: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  numInput: { width: 90, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  smallLabel: { fontSize: 11, color: theme.color.muted, fontWeight: "600" },
  smallInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  terjualBox: { backgroundColor: theme.color.brandTertiary, padding: 12, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  terjualLabel: { fontSize: 12, fontWeight: "700", color: theme.color.onBrandTertiary },
  terjualValue: { fontSize: 22, fontWeight: "900", color: theme.color.onBrandTertiary },
  photoGrid: { flexDirection: "row", gap: 10, marginBottom: 6 },
  discrepancyBox: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12, borderLeftWidth: 4 },
  discrepancyRed: { backgroundColor: "#FEE2E2", borderLeftColor: theme.color.error },
  discrepancyGreen: { backgroundColor: "#D1FAE5", borderLeftColor: theme.color.success },
  discrepancyOK: { backgroundColor: "#ECFDF5", borderLeftColor: theme.color.success },
  discrepancyTitle: { fontSize: 14, fontWeight: "800", color: theme.color.onSurface },
  discrepancyDesc: { fontSize: 11, color: theme.color.onSurfaceSecondary, marginTop: 2 },
  alertRed: { backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: theme.color.error, gap: 4 },
  alertTitle: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface },
  alertText: { fontSize: 12, color: theme.color.onSurface },
  saveBtn: { backgroundColor: "#F59E0B", padding: 16, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: 1 },
});
