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
type Shift = { key: string; label: string };
type PartPrice = { id: string; name: string; rp_per_pcs: number; order?: number };

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Produksi Input — flow spec Aug 2026 + part_qtys dinamis:
 *  1. Pilih Sales (search)
 *  2. Pilih Shift (dinamis, dari settings)
 *  3. Foto SEBELUM (galon kosong sebelum diisi) → AI hitung otomatis
 *  4. Foto SESUDAH (galon isi setelah diisi) → AI hitung otomatis
 *  5. Manual +/- adjust
 *  6. Destinasi: Kirim Gudang | Langsung Jual
 *  7. Penggantian Galon & Sparepart — DINAMIS dari SuperAdmin (part_prices).
 */
export default function ProduksiInput() {
  const toast = useToast();
  const [sales, setSales] = useState<SalesUser[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [parts, setParts] = useState<PartPrice[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    date: todayStr(),
    shift: "pagi",
    sales_id: "",
    destination: "gudang" as "gudang" | "sales",
    manual_adjust: "0",
    manual_adjust_before: "0",
    sisa_pagi: "",
    sisa_siang: "",
    note: "",
  });

  // Peta dinamis nama part → qty (string utk input)
  const [partQtys, setPartQtys] = useState<Record<string, string>>({});

  const [photoBefore, setPhotoBefore] = useState<string | null>(null);
  const [photoAfter, setPhotoAfter] = useState<string | null>(null);
  const [photoBeforeAt, setPhotoBeforeAt] = useState<Date | null>(null);
  const [photoAfterAt, setPhotoAfterAt] = useState<Date | null>(null);
  const [aiBefore, setAiBefore] = useState<{ count: number; confidence: string; reasoning: string } | null>(null);
  const [aiAfter, setAiAfter] = useState<{ count: number; confidence: string; reasoning: string } | null>(null);
  const [aiBeforeStatus, setAiBeforeStatus] = useState<"idle" | "processing" | "error">("idle");
  const [aiAfterStatus, setAiAfterStatus] = useState<"idle" | "processing" | "error">("idle");
  const [aiBeforeErr, setAiBeforeErr] = useState("");
  const [aiAfterErr, setAiAfterErr] = useState("");

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
      try {
        const p = await api.listPartPrices();
        const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        setParts(sorted);
      } catch {}
    })();
  }, []);

  const setF = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));
  const setPartQty = (name: string, v: string) => setPartQtys((s) => ({ ...s, [name]: v }));

  // Auto-load draft ketika sales/date/shift berubah
  useEffect(() => {
    if (!form.sales_id || !form.date || !form.shift) return;
    (async () => {
      try {
        const d = await api.getProductionDraft(form.sales_id, form.date, form.shift);
        if (d && d.id) {
          // Ada draft → prefill semua field
          setForm((f) => ({
            ...f,
            destination: d.destination || f.destination,
            manual_adjust: String(d.manual_adjust || 0),
            manual_adjust_before: String(d.manual_adjust_before || 0),
            note: d.note || "",
          }));
          setPhotoBefore(d.photo_before || null);
          setPhotoAfter(d.photo_after || null);
          if (d.ai_count_before != null) setAiBefore({ count: d.ai_count_before, confidence: d.ai_confidence || "medium", reasoning: "Draft tersimpan sebelumnya" });
          if (d.ai_count_after != null) setAiAfter({ count: d.ai_count_after, confidence: d.ai_confidence || "medium", reasoning: "Draft tersimpan sebelumnya" });
          if (d.part_qtys && typeof d.part_qtys === "object") {
            const pq: Record<string, string> = {};
            Object.entries(d.part_qtys).forEach(([k, v]) => { pq[k] = String(v); });
            setPartQtys(pq);
          }
          setForm((f) => ({
            ...f,
            sisa_pagi: d.sisa_pagi ? String(d.sisa_pagi) : f.sisa_pagi,
            sisa_siang: d.sisa_siang ? String(d.sisa_siang) : f.sisa_siang,
          }));
          toast.show("Draft dimuat — lanjutkan input", "success");
        } else {
          // Reset ke kosong
          setPhotoBefore(null);
          setPhotoAfter(null);
          setAiBefore(null);
          setAiAfter(null);
          setPartQtys({});
          setForm((f) => ({ ...f, manual_adjust: "0", manual_adjust_before: "0", note: "" }));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sales_id, form.date, form.shift]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as SalesUser[];
    return sales.filter((s) => (s.sales_code || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q));
  }, [sales, search]);

  const selectedSales = sales.find((s) => s.id === form.sales_id);

  const manualN = parseInt(form.manual_adjust || "0") || 0;
  const totalProduksi = (aiAfter?.count || 0) + manualN;

  const buildBody = (isDraft: boolean) => {
    const partQtysBody: Record<string, number> = {};
    for (const p of parts) {
      const n = parseInt(partQtys[p.name] || "0") || 0;
      if (n > 0) partQtysBody[p.name] = n;
    }
    return {
      date: form.date,
      shift: form.shift,
      sales_id: form.sales_id,
      destination: form.destination,
      ai_count_before: aiBefore?.count ?? null,
      ai_count_after: aiAfter?.count ?? null,
      manual_adjust: manualN,
      manual_adjust_before: parseInt(form.manual_adjust_before || "0") || 0,
      sisa_pagi: parseInt(form.sisa_pagi || "0") || 0,
      sisa_siang: parseInt(form.sisa_siang || "0") || 0,
      produksi_galon: Math.max(0, totalProduksi),
      photo_before: photoBefore || null,
      photo_after: photoAfter || null,
      ai_confidence: aiAfter?.confidence || null,
      part_qtys: partQtysBody,
      note: form.note || null,
      is_draft: isDraft,
    };
  };

  const resetForm = () => {
    setPhotoBefore(null);
    setPhotoAfter(null);
    setAiBefore(null);
    setAiAfter(null);
    setPartQtys({});
    setForm((f) => ({ ...f, manual_adjust: "0", manual_adjust_before: "0", sisa_pagi: "", sisa_siang: "", note: "" }));
  };

  const onSaveDraft = async () => {
    if (!form.sales_id) return toast.show("Pilih Sales dulu", "error");
    setSaving(true);
    try {
      await api.createProductionDaily(buildBody(true) as any);
      toast.show("💾 Draft tersimpan — bisa dilanjutkan nanti", "success");
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan draft", "error");
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!form.sales_id) return toast.show("Pilih Sales dulu", "error");
    if (totalProduksi <= 0) {
      return toast.show(
        "Foto galon isi atau masukkan koreksi manual dulu (produksi 0)",
        "error",
      );
    }
    setSaving(true);
    try {
      await api.createProductionDaily(buildBody(false) as any);
      toast.show(
        `✅ Produksi tersimpan: ${totalProduksi} galon (${form.destination === "gudang" ? "Kirim Gudang" : "Langsung Jual"})`,
        "success",
      );
      resetForm();
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
            onChange={(v) => {
              setPhotoBefore(v);
              setPhotoBeforeAt(v ? new Date() : null);
              if (!v) { setAiBefore(null); setAiBeforeStatus("idle"); }
              else if (!aiBefore) setAiBeforeStatus("processing");
            }}
            label="Foto galon kosong"
            watermark
            aiCount
            hintForAI="galon kosong sebelum diisi"
            onAICount={(count, confidence, reasoning) => { setAiBefore({ count, confidence, reasoning }); setAiBeforeStatus("idle"); }}
            onAIError={(m) => { setAiBeforeErr(m); setAiBeforeStatus("error"); }}
            caption={photoBefore ? (
              <PhotoMeta status={aiBeforeStatus} aiCount={aiBefore?.count} err={aiBeforeErr} at={photoBeforeAt} unit="galon" />
            ) : null}
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
          {photoBefore ? (
            <NumStepper
              label="Penyesuaian +/- (referensi)"
              value={form.manual_adjust_before}
              onChange={(v) => setF("manual_adjust_before", v)}
              hint="Sesuaikan jika jumlah kenyataan berbeda dari AI"
              testID="adjust-before"
            />
          ) : null}

          <SectionTitle>2️⃣ Foto Galon Isi (SETELAH diisi)</SectionTitle>
          <PhotoCapture
            value={photoAfter}
            onChange={(v) => {
              setPhotoAfter(v);
              setPhotoAfterAt(v ? new Date() : null);
              if (!v) { setAiAfter(null); setAiAfterStatus("idle"); }
              else if (!aiAfter) setAiAfterStatus("processing");
            }}
            label="Foto galon isi (produk jadi)"
            watermark
            aiCount
            hintForAI="galon air isi setelah diisi"
            onAICount={(count, confidence, reasoning) => { setAiAfter({ count, confidence, reasoning }); setAiAfterStatus("idle"); }}
            onAIError={(m) => { setAiAfterErr(m); setAiAfterStatus("error"); }}
            caption={photoAfter ? (
              <PhotoMeta status={aiAfterStatus} aiCount={aiAfter?.count} err={aiAfterErr} at={photoAfterAt} unit="galon" />
            ) : null}
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
          {photoAfter ? (
            <NumStepper
              label="Penyesuaian +/- (mempengaruhi TOTAL)"
              value={form.manual_adjust}
              onChange={(v) => setF("manual_adjust", v)}
              hint="Contoh: -2 kalau 2 galon rusak / bocor"
              testID="adjust-after"
            />
          ) : null}

          <View style={styles.totalBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.totalLabel}>TOTAL PRODUKSI</Text>
              <Text style={styles.totalSub}>AI ({aiAfter?.count || 0}) {manualN >= 0 ? "+" : ""}{manualN} penyesuaian</Text>
            </View>
            <Text style={styles.totalValue}>{Math.max(0, totalProduksi)}</Text>
            <Text style={styles.totalUnit}>gln</Text>
          </View>

          <SectionTitle>3️⃣ Destinasi</SectionTitle>
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

          {/* === Sisa Isi (belum terjual) === */}
          <SectionTitle>Sisa Isi (belum terjual)</SectionTitle>
          <View style={styles.rowTwo}>
            <NumFieldSmall label="Sisa Isi Pagi" value={form.sisa_pagi} onChange={(v) => setF("sisa_pagi", v)} testID="sisa-pagi" />
            <NumFieldSmall label="Sisa Isi Sore" value={form.sisa_siang} onChange={(v) => setF("sisa_siang", v)} testID="sisa-siang" />
          </View>
          {(() => {
            const sisa = (parseInt(form.sisa_pagi || "0") || 0) + (parseInt(form.sisa_siang || "0") || 0);
            const terjual = Math.max(0, totalProduksi - sisa);
            if (totalProduksi > 0 || sisa > 0) {
              return (
                <View style={styles.terjualBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.terjualLabel}>Galon Terjual (Produksi − Sisa)</Text>
                    <Text style={styles.terjualSub}>{totalProduksi} − {sisa} = galon terjual</Text>
                  </View>
                  <Text style={styles.terjualValue}>{terjual}</Text>
                </View>
              );
            }
            return null;
          })()}

          {/* === DINAMIS: Penggantian Galon & Sparepart (mengikuti daftar SuperAdmin) === */}
          <SectionTitle>Penggantian Galon & Sparepart (opsional)</SectionTitle>
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
            testID="produksi-save-draft-btn"
          >
            {saving ? <ActivityIndicator color={theme.color.brand} /> : (
              <>
                <Ionicons name="save-outline" size={18} color={theme.color.brand} />
                <Text style={styles.draftText}>SIMPAN SEMENTARA</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={onSave}
            disabled={saving}
            testID="produksi-save-btn"
          >
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

function PhotoMeta({ status, aiCount, err, at, unit }: {
  status: "idle" | "processing" | "error";
  aiCount?: number;
  err?: string;
  at: Date | null;
  unit: string;
}) {
  const dateStr = at ? at.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  return (
    <View style={{ gap: 4 }}>
      {status === "processing" ? (
        <View style={photoMetaStyles.rowCenter}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={photoMetaStyles.aiText}>AI sedang menghitung…</Text>
        </View>
      ) : aiCount != null ? (
        <View style={photoMetaStyles.rowCenter}>
          <Ionicons name="sparkles" size={13} color="#059669" />
          <Text style={photoMetaStyles.aiText}>AI: <Text style={{ fontWeight: "900" }}>{aiCount}</Text> {unit}</Text>
        </View>
      ) : status === "error" ? (
        <View style={photoMetaStyles.rowCenter}>
          <Ionicons name="alert-circle" size={13} color="#DC2626" />
          <Text style={photoMetaStyles.errText}>AI gagal: {err || "coba manual"}</Text>
        </View>
      ) : null}
      <View style={photoMetaStyles.rowCenter}>
        <Ionicons name="time-outline" size={12} color="#065F46" />
        <Text style={photoMetaStyles.dateText}>{dateStr}</Text>
      </View>
    </View>
  );
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

const photoMetaStyles = StyleSheet.create({
  rowCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  aiText: { fontSize: 12, color: "#065F46", fontWeight: "700" },
  errText: { fontSize: 11, color: "#DC2626", fontWeight: "600" },
  dateText: { fontSize: 10, color: "#065F46", fontWeight: "600" },
});

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
  partsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  partCol: { width: "48%" },
  smallLabel: { fontSize: 11, color: theme.color.muted, fontWeight: "600" },
  smallInput: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, padding: 10, fontSize: 15, textAlign: "center", backgroundColor: "#fff", fontWeight: "700" },
  terjualBox: {
    backgroundColor: theme.color.brandTertiary,
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  terjualLabel: { fontSize: 12, fontWeight: "700", color: theme.color.onBrandTertiary },
  terjualSub: { fontSize: 10, color: theme.color.onBrandTertiary, opacity: 0.7, marginTop: 2 },
  terjualValue: { fontSize: 22, fontWeight: "900", color: theme.color.onBrandTertiary },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.color.brand, padding: 16, borderRadius: 14 },
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
    borderColor: theme.color.brand,
    backgroundColor: theme.color.brandTertiary,
  },
  draftText: { color: theme.color.brand, fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
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
