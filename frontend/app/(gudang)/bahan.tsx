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

type Item = { id: string; name: string; category: string; unit: string; order: number };
type StockRow = { name: string; unit: string; gudang: number; produksi: number };
type Movement = {
  id: string;
  date: string;
  item_name: string;
  qty: number;
  notes?: string;
  created_by_name?: string;
};

/**
 * Halaman "Bahan" untuk Gudang:
 *   • Card pantau stok Bahan (Gudang & Produksi)
 *   • Tombol "+ Barang Masuk" → tambah stok Bahan di Gudang
 *   • Tombol "Kirim ke Produksi" → transfer Bahan Gudang → Produksi
 *   • List riwayat barang masuk & transfer
 */
export default function GudangBahan() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [incomings, setIncomings] = useState<Movement[]>([]);
  const [transfers, setTransfers] = useState<Movement[]>([]);
  const [refresh, setRefresh] = useState(false);
  const [modal, setModal] = useState<"incoming" | "transfer" | null>(null);
  // Map bahan name → qty string (multi-input mode)
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [its, stk, inc, trf] = await Promise.all([
        api.listInventoryItems("bahan"),
        api.getInventoryStock("bahan"),
        api.listBahanIncoming({}).catch(() => []),
        api.listBahanTransfers({}).catch(() => []),
      ]);
      setItems(its || []);
      setRows(stk?.bahan || []);
      setIncomings(inc || []);
      setTransfers(trf || []);
    } catch (e: any) {
      toast.show(e?.message || "Gagal muat data", "error");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const stokFor = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.name] = r.gudang; });
    return m;
  }, [rows]);

  const openModal = (mode: "incoming" | "transfer") => {
    setModal(mode);
    setQtys({});
    setNotes("");
  };

  const setQty = (name: string, v: string) => setQtys((s) => ({ ...s, [name]: v.replace(/[^\d]/g, "") }));

  const filledCount = Object.values(qtys).filter((v) => (parseInt(v, 10) || 0) > 0).length;
  const filledTotal = Object.entries(qtys).reduce((sum, [, v]) => sum + (parseInt(v, 10) || 0), 0);

  const doAction = async () => {
    // Collect all rows with qty > 0
    const entries = Object.entries(qtys)
      .map(([name, v]) => ({ name, qty: parseInt(v, 10) || 0 }))
      .filter((r) => r.qty > 0);
    if (entries.length === 0) return toast.show("Isi qty minimal 1 bahan", "error");
    // Validate stok for transfer
    if (modal === "transfer") {
      const over = entries.find((e) => e.qty > (stokFor[e.name] || 0));
      if (over) return toast.show(`Stok ${over.name} hanya ${stokFor[over.name] || 0}`, "error");
    }
    setSending(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const notesTrim = notes.trim() || undefined;
      const results = await Promise.allSettled(entries.map((e) => (
        modal === "incoming"
          ? api.bahanIncoming({ date: today, item_name: e.name, qty: e.qty, notes: notesTrim })
          : api.bahanTransfer({ date: today, item_name: e.name, qty: e.qty, notes: notesTrim })
      )));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.show(
          modal === "incoming"
            ? `✅ ${ok} bahan masuk Gudang (total ${filledTotal})`
            : `✅ ${ok} bahan dikirim ke Produksi (total ${filledTotal})`,
          "success",
        );
        setModal(null);
      } else {
        toast.show(`${ok} berhasil, ${fail} gagal — coba lagi item yang gagal`, "error");
      }
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Bahan" />
      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => openModal("incoming")} style={[styles.cta, { backgroundColor: theme.color.success }]} testID="open-incoming-btn">
            <Ionicons name="download" size={16} color="#fff" />
            <Text style={styles.ctaText}>Barang Masuk</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openModal("transfer")} style={[styles.cta, { backgroundColor: theme.color.brand }]} testID="open-transfer-btn">
            <Ionicons name="paper-plane" size={16} color="#fff" />
            <Text style={styles.ctaText}>Kirim ke Produksi</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Kotak Pantau Stok Bahan</Text>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={24} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada Bahan. Minta Super Admin tambah lewat menu Pengaturan → Inventory.</Text>
          </View>
        ) : (
          <View style={styles.stockCard}>
            <View style={styles.stockHeader}>
              <Text style={[styles.stockHeaderText, { flex: 1 }]}>Bahan</Text>
              <Text style={[styles.stockHeaderText, styles.stockCol, { color: "#fff", backgroundColor: theme.color.brand }]}>Gudang</Text>
              <Text style={[styles.stockHeaderText, styles.stockCol]}>Produksi</Text>
            </View>
            {rows.map((r) => (
              <View key={r.name} style={styles.stockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stockName}>{r.name}</Text>
                  <Text style={styles.stockUnit}>{r.unit}</Text>
                </View>
                <Text style={[styles.stockVal, r.gudang < 10 && { color: theme.color.error }]}>{r.gudang}</Text>
                <Text style={styles.stockVal}>{r.produksi}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.section}>Riwayat Barang Masuk</Text>
        <View style={styles.historyCard}>
          {incomings.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada</Text>
          ) : (
            incomings.slice(0, 20).map((m) => (
              <View key={m.id} style={styles.hRow}>
                <View style={[styles.hIcon, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
                  <Ionicons name="download" size={14} color={theme.color.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hName}>{m.item_name} · <Text style={{ color: theme.color.success, fontWeight: "800" }}>+{m.qty}</Text></Text>
                  <Text style={styles.hSub}>{m.date}{m.notes ? " · " + m.notes : ""} · {m.created_by_name || "-"}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.section}>Riwayat Kirim ke Produksi</Text>
        <View style={styles.historyCard}>
          {transfers.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada</Text>
          ) : (
            transfers.slice(0, 20).map((m) => (
              <View key={m.id} style={styles.hRow}>
                <View style={styles.hIcon}>
                  <Ionicons name="paper-plane" size={14} color={theme.color.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hName}>{m.item_name} · <Text style={{ color: theme.color.brand, fontWeight: "800" }}>{m.qty}</Text></Text>
                  <Text style={styles.hSub}>{m.date}{m.notes ? " · " + m.notes : ""} · {m.created_by_name || "-"}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal */}
      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.mHeader}>
              <View style={styles.mIcon}>
                <Ionicons name={modal === "incoming" ? "download" : "paper-plane"} size={22} color={theme.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mTitle}>{modal === "incoming" ? "Barang Masuk" : "Kirim ke Produksi"}</Text>
                <Text style={styles.mSub}>{modal === "incoming" ? "Tambah stok Bahan di Gudang" : "Gudang → Produksi"}</Text>
              </View>
              <TouchableOpacity onPress={() => setModal(null)}>
                <Ionicons name="close" size={22} color={theme.color.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
              <View style={styles.hintBox}>
                <Ionicons name="information-circle" size={16} color={theme.color.brand} />
                <Text style={styles.hintText}>
                  Isi qty untuk bahan yang mau {modal === "incoming" ? "dimasukkan" : "dikirim"}. Baris qty 0/kosong akan diabaikan.
                </Text>
              </View>

              {items.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada Bahan terdaftar</Text>
              ) : (
                <View style={{ gap: 6, marginTop: 8 }}>
                  {items.map((it) => {
                    const stok = stokFor[it.name] || 0;
                    const val = qtys[it.name] || "";
                    const q = parseInt(val, 10) || 0;
                    const overStock = modal === "transfer" && q > stok;
                    const disabled = modal === "transfer" && stok <= 0;
                    return (
                      <View key={it.id} style={[styles.bahanRow, q > 0 && styles.bahanRowActive, overStock && styles.bahanRowError, disabled && styles.bahanRowDisabled]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.bahanName, disabled && { color: theme.color.muted }]} numberOfLines={2}>{it.name}</Text>
                          <Text style={styles.bahanMeta}>
                            <Text style={{ fontWeight: "700" }}>{it.unit}</Text>
                            {modal === "transfer" ? ` · stok ${stok}` : ""}
                          </Text>
                        </View>
                        <View style={styles.qtyGroup}>
                          <TouchableOpacity
                            onPress={() => setQty(it.name, String(Math.max(0, q - 1)))}
                            style={styles.qtyStep}
                            disabled={disabled}
                            testID={`bahan-minus-${it.name}`}
                          >
                            <Ionicons name="remove" size={16} color={disabled ? theme.color.muted : theme.color.brand} />
                          </TouchableOpacity>
                          <TextInput
                            value={val}
                            onChangeText={(v) => setQty(it.name, v)}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={theme.color.muted}
                            style={[styles.bahanQtyInput, overStock && { color: theme.color.error }]}
                            editable={!disabled}
                            testID={`bahan-qty-${it.name}`}
                          />
                          <TouchableOpacity
                            onPress={() => setQty(it.name, String(q + 1))}
                            style={styles.qtyStep}
                            disabled={disabled}
                            testID={`bahan-plus-${it.name}`}
                          >
                            <Ionicons name="add" size={16} color={disabled ? theme.color.muted : theme.color.brand} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.label}>Catatan (opsional, berlaku untuk semua baris)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={modal === "incoming" ? "Contoh: kiriman supplier ABC" : "Contoh: shift pagi"}
                placeholderTextColor={theme.color.muted}
                style={styles.input}
              />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setModal(null)} style={styles.cancelBtn} disabled={sending}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doAction}
                disabled={sending || filledCount === 0}
                style={[styles.doBtn, (sending || filledCount === 0) && { opacity: 0.55 }]}
                testID="do-bahan-btn"
              >
                {sending ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name={modal === "incoming" ? "download" : "paper-plane"} size={14} color="#fff" />
                    <Text style={styles.doBtnText}>
                      {modal === "incoming" ? "Simpan" : "Kirim"}
                      {filledCount > 0 ? ` (${filledCount} bahan · ${filledTotal})` : ""}
                    </Text>
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
  cta: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 12, borderRadius: 12 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  section: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface, marginTop: 4 },
  emptyBox: { padding: 24, alignItems: "center", gap: 8, backgroundColor: theme.color.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border },
  emptyText: { fontSize: 12, color: theme.color.muted, textAlign: "center" },
  stockCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.color.border },
  stockHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.color.border, marginBottom: 4 },
  stockHeaderText: { fontSize: 10, fontWeight: "800", color: theme.color.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  stockCol: { minWidth: 64, textAlign: "center", padding: 4, borderRadius: 6 },
  stockRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border,
  },
  stockName: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  stockUnit: { fontSize: 10, color: theme.color.muted },
  stockVal: { minWidth: 64, fontSize: 16, fontWeight: "700", color: theme.color.onSurface, textAlign: "center", fontVariant: ["tabular-nums"] },
  historyCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.color.border, gap: 4 },
  hRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  hIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  hName: { fontSize: 13, color: theme.color.onSurface, fontWeight: "600" },
  hSub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 16 },
  card: { backgroundColor: theme.color.surface, borderRadius: 20, maxWidth: 500, alignSelf: "center", width: "100%", overflow: "hidden" },
  mHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  mIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  mTitle: { fontSize: 16, fontWeight: "800", color: theme.color.onSurface },
  mSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  label: { fontSize: 11, fontWeight: "800", color: theme.color.onSurface, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, marginTop: 8 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary,
    minWidth: 96, alignItems: "center",
  },
  chipActive: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface },
  chipUnit: { fontSize: 10, color: theme.color.muted, marginTop: 1 },
  chipStok: { fontSize: 10, color: theme.color.muted, marginTop: 1 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  qtyInput: {
    flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, padding: 12,
    fontSize: 22, fontWeight: "800", textAlign: "center", color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary, fontVariant: ["tabular-nums"],
  },
  presetsRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  presetBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary },
  presetText: { fontSize: 11, fontWeight: "700", color: theme.color.brand },
  input: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 12, padding: 12, fontSize: 14, color: theme.color.onSurface, backgroundColor: theme.color.surfaceSecondary },
  footer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: theme.color.border },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  cancelBtnText: { color: theme.color.onSurface, fontWeight: "600" },
  doBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, backgroundColor: theme.color.brandPrimary },
  doBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hintBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: theme.color.brandTertiary, marginBottom: 4 },
  hintText: { flex: 1, fontSize: 11, color: theme.color.onBrandTertiary, lineHeight: 15 },
  bahanRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  bahanRowActive: { borderColor: theme.color.brandPrimary, backgroundColor: theme.color.brandTertiary },
  bahanRowError: { borderColor: theme.color.error, backgroundColor: "#FEE2E2" },
  bahanRowDisabled: { opacity: 0.5, backgroundColor: theme.color.surfaceSecondary },
  bahanName: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  bahanMeta: { fontSize: 10, color: theme.color.muted, marginTop: 2 },
  qtyGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyStep: { width: 30, height: 34, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  bahanQtyInput: { width: 62, height: 34, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, textAlign: "center", fontSize: 15, fontWeight: "700", color: theme.color.onSurface, backgroundColor: "#fff", fontVariant: ["tabular-nums"], paddingVertical: 0 },
});
