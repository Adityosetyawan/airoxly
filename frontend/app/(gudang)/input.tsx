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
import { NumStepper } from "@/src/components/NumStepper";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type SalesUser = { id: string; sales_code?: string; name?: string; group_letter?: string };
type PartPrice = { id: string; name: string; rp_per_pcs: number; order?: number };

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function GudangInput() {
  const toast = useToast();
  const [sales, setSales] = useState<SalesUser[]>([]);
  const [parts, setParts] = useState<PartPrice[]>([]);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [discrepancy, setDiscrepancy] = useState<{ merah: number; hijau: number; kosong_pulang: number; galon_ganti_produksi: number; hijau_cleared: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    date: todayStr(),
    shift: "pagi" as "pagi" | "siang",
    sales_id: "",
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
  // Peta dinamis nama part → qty
  const [partQtys, setPartQtys] = useState<Record<string, string>>({});
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
        list.sort((a: any, b: any) => (a.sales_code || "").localeCompare(b.sales_code || ""));
        setSales(list);
        if (list[0]) setForm((f) => ({ ...f, sales_id: list[0].id }));
      } catch {}
      try {
        const p = await api.listPartPrices();
        const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        setParts(sorted);
      } catch {}
    })();
  }, []);

  const setF = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));
  const setPartQty = (name: string, v: string) => setPartQtys((s) => ({ ...s, [name]: v }));

  // Filter sales by search
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

  useEffect(() => {
    if (!form.sales_id) return;
    doValidate(form.sales_id, form.date);
  }, [form.sales_id, form.date]);

  // Auto-load draft
  useEffect(() => {
    if (!form.sales_id || !form.date || !form.shift) return;
    (async () => {
      try {
        const d = await api.getWarehouseDraft(form.sales_id, form.date, form.shift);
        if (d && d.id) {
          setForm((f) => ({
            ...f,
            bawa_pagi: String(d.bawa_pagi || ""),
            bawa_siang: String(d.bawa_siang || ""),
            kosong_pagi: String(d.kosong_pagi || ""),
            kosong_siang: String(d.kosong_siang || ""),
            kosong_kembali_siang: String(d.kosong_kembali_siang || ""),
            kosong_kembali_sore: String(d.kosong_kembali_sore || ""),
            sisa_pagi: String(d.sisa_pagi || ""),
            sisa_siang: String(d.sisa_siang || ""),
            note: d.note || "",
          }));
          setPhotoIsiPagi(d.photo_isi_pagi || null);
          setPhotoIsiSiang(d.photo_isi_siang || null);
          setPhotoKosongSiang(d.photo_kosong_siang || null);
          setPhotoKosongSore(d.photo_kosong_sore || null);
          if (d.part_qtys && typeof d.part_qtys === "object") {
            const pq: Record<string, string> = {};
            Object.entries(d.part_qtys).forEach(([k, v]) => { pq[k] = String(v); });
            setPartQtys(pq);
          }
          toast.show("Draft dimuat — lanjutkan input", "success");
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sales_id, form.date, form.shift]);

  const buildBody = (isDraft: boolean) => {
    const partQtysBody: Record<string, number> = {};
    for (const p of parts) {
      const n = parseInt(partQtys[p.name] || "0") || 0;
      if (n > 0) partQtysBody[p.name] = n;
    }
    const body: any = {
      date: form.date,
      shift: form.shift,
      sales_id: form.sales_id,
      bawa_pagi: parseInt(form.bawa_pagi || "0") || 0,
      bawa_siang: parseInt(form.bawa_siang || "0") || 0,
      kosong_pagi: parseInt(form.kosong_pagi || "0") || 0,
      kosong_siang: parseInt(form.kosong_siang || "0") || 0,
      kosong_kembali_siang: parseInt(form.kosong_kembali_siang || "0") || 0,
      kosong_kembali_sore: parseInt(form.kosong_kembali_sore || "0") || 0,
      sisa_pagi: parseInt(form.sisa_pagi || "0") || 0,
      sisa_siang: parseInt(form.sisa_siang || "0") || 0,
      part_qtys: partQtysBody,
      note: form.note || null,
      is_draft: isDraft,
    };
    if (photoIsiPagi) body.photo_isi_pagi = photoIsiPagi;
    if (photoIsiSiang) body.photo_isi_siang = photoIsiSiang;
    if (photoKosongSiang) body.photo_kosong_siang = photoKosongSiang;
    if (photoKosongSore) body.photo_kosong_sore = photoKosongSore;
    return body;
  };

  const onSaveDraft = async () => {
    if (!form.sales_id) return toast.show("Pilih Sales dulu", "error");
    setSaving(true);
    try {
      await api.createWarehouseDaily(buildBody(true));
      toast.show("💾 Draft tersimpan — bisa dilanjutkan nanti", "success");
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan draft", "error");
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!form.sales_id) return toast.show("Pilih Sales dulu", "error");
    setSaving(true);
    try {
      await api.createWarehouseDaily(buildBody(false));
      toast.show("✅ Input Gudang tersimpan (FINAL)", "success");
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
        {discrepancy && (discrepancy.merah > 0 || discrepancy.hijau > 0) ? (
          <View style={[styles.discrepancyBox, discrepancy.merah > 0 ? styles.discrepancyRed : styles.discrepancyGreen]}>
            <Ionicons name={discrepancy.merah > 0 ? "alert-circle" : "checkmark-circle"} size={22} color={discrepancy.merah > 0 ? theme.color.error : theme.color.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.discrepancyTitle}>
                {discrepancy.merah > 0 ? `KURANG ${discrepancy.merah} galon` : `LEBIH ${discrepancy.hijau} galon`}
              </Text>
              <Text style={styles.discrepancyDesc}>
                Bawa Isi: {(discrepancy as any).bawa_total ?? discrepancy.galon_ganti_produksi} · Galon Kembali: {(discrepancy as any).galon_kembali ?? discrepancy.kosong_pulang}
                {" "}·{" "}
                {discrepancy.merah > 0 ? "Kembali < Bawa" : "Kembali > Bawa"}
              </Text>
            </View>
          </View>
        ) : null}
        {discrepancy && discrepancy.merah === 0 && discrepancy.hijau === 0 &&
          (((discrepancy as any).bawa_total ?? discrepancy.galon_ganti_produksi) > 0 ||
            ((discrepancy as any).galon_kembali ?? discrepancy.kosong_pulang) > 0) ? (
          <View style={[styles.discrepancyBox, styles.discrepancyOK]}>
            <Ionicons name="shield-checkmark" size={22} color={theme.color.success} />
            <Text style={styles.discrepancyTitle}>Bawa Isi = Galon Kembali ✓</Text>
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

          <SectionTitle>1️⃣ Bawa Isi (dari foto real + penyesuaian)</SectionTitle>
          <View style={styles.photoGrid}>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoIsiPagi} onChange={setPhotoIsiPagi} label="Isi Pagi" watermark testID="photo-isi-pagi" />
              <NumStepper value={form.bawa_pagi} onChange={(v) => setF("bawa_pagi", v)} label="Bawa Isi Pagi" allowNegative={false} testID="stepper-bawa-pagi" />
            </View>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoIsiSiang} onChange={setPhotoIsiSiang} label="Isi Siang" watermark testID="photo-isi-siang" />
              <NumStepper value={form.bawa_siang} onChange={(v) => setF("bawa_siang", v)} label="Bawa Isi Siang" allowNegative={false} testID="stepper-bawa-siang" />
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

          <SectionTitle>3️⃣ Galon Kembali (dari foto real + penyesuaian)</SectionTitle>
          <View style={styles.photoGrid}>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoKosongSiang} onChange={setPhotoKosongSiang} label="Galon Siang" watermark testID="photo-galon-siang" />
              <NumStepper value={form.kosong_kembali_siang} onChange={(v) => setF("kosong_kembali_siang", v)} label="Galon Kembali Siang" allowNegative={false} testID="stepper-kembali-siang" />
            </View>
            <View style={{ flex: 1 }}>
              <PhotoCapture value={photoKosongSore} onChange={setPhotoKosongSore} label="Galon Sore" watermark testID="photo-galon-sore" />
              <NumStepper value={form.kosong_kembali_sore} onChange={(v) => setF("kosong_kembali_sore", v)} label="Galon Kembali Sore" allowNegative={false} testID="stepper-kembali-sore" />
            </View>
          </View>
          {kosongPulang > 0 || form.sales_id ? (
            <View style={styles.kosongInfoBox}>
              <Ionicons name="information-circle" size={14} color={theme.color.brand} />
              <Text style={styles.kosongInfoText}>
                Total galon kembali: <Text style={{ fontWeight: "800" }}>{kosongPulang}</Text> galon — dibandingkan dengan Bawa Isi ({bawa}) untuk menentukan LEBIH/KURANG
              </Text>
            </View>
          ) : null}

          {/* === DINAMIS: Penggantian Galon & Sparepart (mengikuti daftar SuperAdmin) === */}
          <SectionTitle>Penggantian Galon & Sparepart</SectionTitle>
          {parts.length === 0 ? (
            <Text style={styles.emptyChip}>
              Belum ada daftar Part. Minta SuperAdmin menambah item di menu
              &quot;Kelola Part / Biaya Penggantian Part&quot;.
            </Text>
          ) : (
            <View style={styles.partsGrid}>
              {parts.map((p) => (
                <View key={p.id} style={styles.partCol}>
                  <NumFieldSmall
                    label={p.name}
                    value={partQtys[p.name] || ""}
                    onChange={(v) => setPartQty(p.name, v)}
                    testID={`part-${p.name}`}
                  />
                </View>
              ))}
            </View>
          )}

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

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.draftBtn, saving && { opacity: 0.6 }]}
            onPress={onSaveDraft}
            disabled={saving || !form.sales_id}
            testID="gudang-save-draft-btn"
          >
            {saving ? <ActivityIndicator color="#F59E0B" /> : (
              <>
                <Ionicons name="save-outline" size={18} color="#F59E0B" />
                <Text style={styles.draftText}>SIMPAN SEMENTARA</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving} testID="gudang-save-btn">
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.saveText}>SIMPAN FINAL</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.hintFooter}>
          💡 Kalau input belum lengkap (mis. sales lain datang), tap &quot;SIMPAN SEMENTARA&quot;.
          Nanti pilih Sales & Shift yang sama untuk lanjutkan.
        </Text>
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
function NumFieldSmall({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="0"
        style={styles.smallInput}
        testID={testID}
      />
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
  partsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  partCol: { width: "48%" },
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
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F59E0B", padding: 16, borderRadius: 14 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  draftBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#F59E0B",
    backgroundColor: "#FEF3C7",
  },
  draftText: { color: "#F59E0B", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  btnRow: { flexDirection: "row", gap: 10 },
  hintFooter: {
    fontSize: 11,
    color: theme.color.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
    paddingHorizontal: 8,
    fontStyle: "italic",
  },
});
