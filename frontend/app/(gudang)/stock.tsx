import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { StockSplitPanel } from "@/src/components/StockSplitPanel";
import { useCalcBar } from "@/src/components/KeyboardCalcBar";

type PartPrice = { id: string; name: string; rp_per_pcs: number; order?: number };
type Transfer = {
  id: string;
  date: string;
  part_name: string;
  qty: number;
  notes?: string;
  created_by_name?: string;
  created_at?: string;
};

export default function GudangStock() {
  const toast = useToast();
  const [split, setSplit] = useState<{ gudang: Record<string, number>; produksi: Record<string, number> } | null>(null);
  const [parts, setParts] = useState<PartPrice[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [refresh, setRefresh] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string>("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const qtyBar = useCalcBar(qty, {
    hint: `Kirim ${selectedPart || "part"}`,
    format: (r) => `${parseInt(r, 10) || 0} unit`,
  });

  const load = useCallback(async () => {
    try {
      const [s, p, t] = await Promise.all([
        api.getStockSplit(),
        api.listPartPrices().catch(() => []),
        api.listSparepartTransfers({}).catch(() => []),
      ]);
      setSplit(s as any);
      const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setParts(sorted);
      setTransfers(t || []);
    } catch (e: any) {
      toast.show(e?.message || "Gagal muat stok", "error");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!split) return [];
    const names = parts.map((p) => p.name);
    const extra = Object.keys(split.gudang || {}).filter((k) => !names.includes(k));
    return [...names, ...extra].map((n) => ({
      name: n,
      gudang: Number(split.gudang?.[n] || 0),
      produksi: Number(split.produksi?.[n] || 0),
    }));
  }, [split, parts]);

  const openModal = (partName?: string) => {
    setSelectedPart(partName || parts[0]?.name || "");
    setQty("");
    setNotes("");
    setModalOpen(true);
  };

  const doTransfer = async () => {
    const q = parseInt(qty, 10);
    if (!selectedPart) return toast.show("Pilih part dulu", "error");
    if (!q || q <= 0) return toast.show("Qty harus > 0", "error");
    const stok = Number(split?.gudang?.[selectedPart] || 0);
    if (q > stok) return toast.show(`Stok Gudang untuk ${selectedPart} cuma ${stok}`, "error");
    setSending(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.createSparepartTransfer({
        date: today,
        part_name: selectedPart,
        qty: q,
        notes: notes.trim() || undefined,
      });
      toast.show(`Kirim ${q} ${selectedPart} ke Produksi ✅`, "success");
      setModalOpen(false);
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal kirim", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Stok Sparepart" />
      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      >
        <TouchableOpacity onPress={() => openModal()} style={styles.cta} testID="open-transfer-btn">
          <Ionicons name="paper-plane" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Kirim Sparepart ke Produksi</Text>
            <Text style={styles.ctaSub}>Kurangi stok Gudang, tambah stok Produksi</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.section}>Kotak Pantau Stok</Text>
        <StockSplitPanel rows={rows} highlight="gudang" />

        <Text style={styles.section}>Riwayat Kirim ke Produksi</Text>
        <View style={styles.historyBox}>
          {transfers.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada transfer</Text>
          ) : (
            transfers.slice(0, 30).map((t) => (
              <View key={t.id} style={styles.hRow}>
                <View style={styles.hIcon}>
                  <Ionicons name="paper-plane" size={14} color={theme.color.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hName}>{t.part_name} · <Text style={{ color: theme.color.brand, fontWeight: "800" }}>{t.qty}</Text></Text>
                  <Text style={styles.hSub}>
                    {t.date}{t.notes ? " · " + t.notes : ""} · oleh {t.created_by_name || "-"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.mHeader}>
              <View style={styles.mIcon}>
                <Ionicons name="paper-plane" size={22} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mTitle}>Kirim Sparepart</Text>
                <Text style={styles.mSub}>Gudang → Produksi</Text>
              </View>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color={theme.color.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 14 }}>
              <Text style={styles.label}>Pilih Sparepart</Text>
              <View style={styles.chipsWrap}>
                {parts.map((p) => {
                  const stok = Number(split?.gudang?.[p.name] || 0);
                  const active = selectedPart === p.name;
                  const disabled = stok <= 0;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => !disabled && setSelectedPart(p.name)}
                      disabled={disabled}
                      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                      testID={`part-chip-${p.name}`}
                    >
                      <Text style={[styles.chipText, active && { color: "#fff" }, disabled && { color: theme.color.muted }]}>
                        {p.name}
                      </Text>
                      <Text style={[styles.chipStok, active && { color: "#D1FAE5" }, disabled && { color: theme.color.muted }]}>
                        stok {stok}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Qty Dikirim</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => setQty((q) => String(Math.max(0, (parseInt(q, 10) || 0) - 1)))}
                  style={styles.stepperBtn}
                >
                  <Ionicons name="remove" size={18} color={theme.color.brand} />
                </TouchableOpacity>
                <TextInput
                  value={qty}
                  onChangeText={(v) => setQty(v.replace(/[^\d]/g, ""))}
                  onFocus={qtyBar.onFocus}
                  onBlur={qtyBar.onBlur}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.color.muted}
                  style={styles.qtyInput}
                  testID="transfer-qty-input"
                />
                <TouchableOpacity
                  onPress={() => setQty((q) => String((parseInt(q, 10) || 0) + 1))}
                  style={styles.stepperBtn}
                >
                  <Ionicons name="add" size={18} color={theme.color.brand} />
                </TouchableOpacity>
              </View>
              <View style={styles.presetsRow}>
                {[5, 10, 25, 50, 100].map((v) => (
                  <TouchableOpacity key={v} onPress={() => setQty(String(v))} style={styles.presetBtn}>
                    <Text style={styles.presetText}>+{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Catatan (opsional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Contoh: Kirim harian, extra untuk shift malam"
                placeholderTextColor={theme.color.muted}
                style={styles.input}
                testID="transfer-notes-input"
              />

              {selectedPart ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryText}>
                    Stok Gudang akan jadi{" "}
                    <Text style={{ fontWeight: "800", color: theme.color.error }}>
                      {Math.max(0, Number(split?.gudang?.[selectedPart] || 0) - (parseInt(qty, 10) || 0))}
                    </Text>
                    {"  ·  "}
                    Stok Produksi jadi{" "}
                    <Text style={{ fontWeight: "800", color: theme.color.success }}>
                      {Number(split?.produksi?.[selectedPart] || 0) + (parseInt(qty, 10) || 0)}
                    </Text>
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.cancelBtn} disabled={sending}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doTransfer}
                disabled={sending || !qty || !selectedPart}
                style={[styles.sendBtn, (sending || !qty || !selectedPart) && { opacity: 0.55 }]}
                testID="do-transfer-btn"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={14} color="#fff" />
                    <Text style={styles.sendBtnText}>Kirim Sekarang</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.color.brandPrimary,
  },
  ctaTitle: { fontSize: 14, fontWeight: "800", color: "#fff" },
  ctaSub: { fontSize: 11, color: "#D1FAE5", marginTop: 2 },
  section: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface, marginTop: 6 },
  historyBox: {
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 10,
    gap: 6,
  },
  hRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  hIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  hName: { fontSize: 13, color: theme.color.onSurface, fontWeight: "600" },
  hSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  emptyText: { fontSize: 12, color: theme.color.muted, textAlign: "center", padding: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 16 },
  card: { backgroundColor: theme.color.surface, borderRadius: 20, maxWidth: 500, alignSelf: "center", width: "100%", overflow: "hidden" },
  mHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  mIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  mTitle: { fontSize: 16, fontWeight: "800", color: theme.color.onSurface },
  mSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  label: {
    fontSize: 11, fontWeight: "800", color: theme.color.onSurface, textTransform: "uppercase",
    letterSpacing: 0.4, marginBottom: 6, marginTop: 8,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary,
    minWidth: 88, alignItems: "center",
  },
  chipActive: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface },
  chipStok: { fontSize: 10, color: theme.color.muted, marginTop: 2 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: theme.color.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  qtyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
    fontVariant: ["tabular-nums"],
  },
  presetsRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  presetBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  presetText: { fontSize: 11, fontWeight: "700", color: theme.color.brand },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  summaryBox: {
    marginTop: 10, padding: 10, borderRadius: 10,
    backgroundColor: "rgba(15,118,110,0.06)",
    borderWidth: 1, borderColor: "rgba(15,118,110,0.15)",
  },
  summaryText: { fontSize: 12, color: theme.color.onSurface, lineHeight: 18 },
  footer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: theme.color.border },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  cancelBtnText: { color: theme.color.onSurface, fontWeight: "600" },
  sendBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, backgroundColor: theme.color.brandPrimary },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
