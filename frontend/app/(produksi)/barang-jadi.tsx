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
import { useCalcBar } from "@/src/components/KeyboardCalcBar";

type Item = { id: string; name: string; category: string; unit: string; order: number };
type StockRow = { name: string; unit: string; produksi: number; gudang: number; sold: number; repair: number; rusak: number; transferred_in: number };
type Movement = {
  id: string;
  date: string;
  item_name: string;
  qty: number;
  kind?: string;
  source?: string;
  notes?: string;
  created_by_name?: string;
};

export default function ProduksiBarangJadi() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [productions, setProductions] = useState<Movement[]>([]);
  const [transfers, setTransfers] = useState<Movement[]>([]);
  const [damages, setDamages] = useState<Movement[]>([]);
  const [refresh, setRefresh] = useState(false);
  const [modal, setModal] = useState<"produce" | "transfer" | "repair_done" | "write_off" | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [writeOffSource, setWriteOffSource] = useState<"repair" | "produksi">("repair");
  const [sending, setSending] = useState(false);

  const qtyBar = useCalcBar(qty, {
    hint: modal === "produce" ? `Produksi ${selectedItem || "barang"}` : `Kirim ${selectedItem || "barang"} ke Gudang`,
    format: (r) => `${parseInt(r, 10) || 0} ${items.find((i) => i.name === selectedItem)?.unit || "pcs"}`,
  });

  const load = useCallback(async () => {
    try {
      const [its, stk, pr, trf, dmg] = await Promise.all([
        api.listInventoryItems("barang_jadi"),
        api.getInventoryStock("barang_jadi"),
        api.listFinishedProduction({}).catch(() => []),
        api.listFinishedTransfers({}).catch(() => []),
        api.listDamage({}).catch(() => []),
      ]);
      setItems(its || []);
      setRows(stk?.barang_jadi || []);
      setProductions(pr || []);
      setTransfers(trf || []);
      setDamages(dmg || []);
    } catch (e: any) {
      toast.show(e?.message || "Gagal muat data", "error");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const stokProduksiFor = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.name] = r.produksi; });
    return m;
  }, [rows]);
  const repairFor = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.name] = r.repair || 0; });
    return m;
  }, [rows]);

  const openModal = (mode: "produce" | "transfer" | "repair_done" | "write_off") => {
    setModal(mode);
    setSelectedItem(items[0]?.name || "");
    setQty("");
    setNotes("");
    setWriteOffSource("repair");
  };

  const doAction = async () => {
    const q = parseInt(qty, 10);
    if (!selectedItem) return toast.show("Pilih barang", "error");
    if (!q || q <= 0) return toast.show("Qty harus > 0", "error");
    if (modal === "transfer" && q > (stokProduksiFor[selectedItem] || 0)) {
      return toast.show(`Stok Produksi utk ${selectedItem} cuma ${stokProduksiFor[selectedItem] || 0}`, "error");
    }
    if (modal === "repair_done" && q > (repairFor[selectedItem] || 0)) {
      return toast.show(`Antrian repair untuk ${selectedItem} cuma ${repairFor[selectedItem] || 0}`, "error");
    }
    if (modal === "write_off") {
      const avail = writeOffSource === "repair" ? (repairFor[selectedItem] || 0) : (stokProduksiFor[selectedItem] || 0);
      if (q > avail) return toast.show(`Sumber ${writeOffSource} untuk ${selectedItem} hanya ${avail}`, "error");
    }
    setSending(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (modal === "produce") {
        await api.finishedProduce({ date: today, item_name: selectedItem, qty: q, notes: notes.trim() || undefined });
        toast.show(`+${q} ${selectedItem} diproduksi ✅`, "success");
      } else if (modal === "transfer") {
        await api.finishedTransfer({ date: today, item_name: selectedItem, qty: q, notes: notes.trim() || undefined });
        toast.show(`Kirim ${q} ${selectedItem} ke Gudang ✅`, "success");
      } else if (modal === "repair_done") {
        await api.damageRepairDone({ date: today, item_name: selectedItem, qty: q, notes: notes.trim() || undefined });
        toast.show(`Repair ${q} ${selectedItem} selesai — kembali ke stok Produksi ✅`, "success");
      } else if (modal === "write_off") {
        await api.damageWriteOff({ date: today, item_name: selectedItem, qty: q, source: writeOffSource, notes: notes.trim() || undefined });
        toast.show(`${q} ${selectedItem} di-write off (Rusak permanen)`, "success");
      }
      setModal(null);
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Barang Jadi" />
      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      >
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity onPress={() => openModal("produce")} style={[styles.cta, { backgroundColor: "#8B5CF6" }]} testID="open-produce-btn">
            <Ionicons name="hammer" size={16} color="#fff" />
            <Text style={styles.ctaText}>Catat Produksi</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openModal("transfer")} style={[styles.cta, { backgroundColor: theme.color.brand }]} testID="open-transfer-jadi-btn">
            <Ionicons name="paper-plane" size={16} color="#fff" />
            <Text style={styles.ctaText}>Kirim ke Gudang</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openModal("repair_done")} style={[styles.cta, { backgroundColor: "#F59E0B" }]} testID="open-repair-done-btn">
            <Ionicons name="build" size={16} color="#fff" />
            <Text style={styles.ctaText}>Selesai Repair</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openModal("write_off")} style={[styles.cta, { backgroundColor: theme.color.error }]} testID="open-write-off-btn">
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={styles.ctaText}>Rusak Permanen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={theme.color.brand} />
          <Text style={styles.infoText}>
            Alur: Produksi → Kirim ke Gudang → Sales jual. Jika ada rusak di Gudang, Gudang tap &quot;Return Rusak&quot; → masuk antrian
            <Text style={{ fontWeight: "700" }}> Repair</Text>. Setelah diperbaiki tap &quot;Selesai Repair&quot; → kembali ke stok Produksi.
            Rusak parah? Tap &quot;Rusak Permanen&quot; untuk write-off.
          </Text>
        </View>

        <Text style={styles.section}>Kotak Pantau Stok Barang Jadi</Text>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={24} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada Barang Jadi. Minta Super Admin tambah lewat menu Pengaturan → Inventory.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.stockCard}>
              <View style={styles.stockHeader}>
                <Text style={[styles.stockHeaderText, { width: 110 }]}>Barang</Text>
                <Text style={[styles.stockHeaderText, styles.stockCol, { color: "#fff", backgroundColor: "#8B5CF6" }]}>Produksi</Text>
                <Text style={[styles.stockHeaderText, styles.stockCol]}>Gudang</Text>
                <Text style={[styles.stockHeaderText, styles.stockCol, { color: "#fff", backgroundColor: "#F59E0B" }]}>Repair</Text>
                <Text style={[styles.stockHeaderText, styles.stockCol, { color: "#fff", backgroundColor: theme.color.error }]}>Rusak</Text>
                <Text style={[styles.stockHeaderText, styles.stockCol]}>Terjual</Text>
              </View>
              {rows.map((r) => (
                <View key={r.name} style={styles.stockRow}>
                  <View style={{ width: 110 }}>
                    <Text style={styles.stockName}>{r.name}</Text>
                    <Text style={styles.stockUnit}>{r.unit}</Text>
                  </View>
                  <Text style={[styles.stockVal, r.produksi < 10 && { color: theme.color.error }]}>{r.produksi}</Text>
                  <Text style={[styles.stockVal, r.gudang < 0 && { color: theme.color.error }]}>{r.gudang}</Text>
                  <Text style={[styles.stockVal, r.repair > 0 && { color: "#F59E0B", fontWeight: "800" }]}>{r.repair || 0}</Text>
                  <Text style={[styles.stockVal, r.rusak > 0 && { color: theme.color.error, fontWeight: "800" }]}>{r.rusak || 0}</Text>
                  <Text style={[styles.stockVal, { color: theme.color.muted }]}>{r.sold}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        <Text style={styles.section}>Riwayat Produksi</Text>
        <View style={styles.historyCard}>
          {productions.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada</Text>
          ) : (
            productions.slice(0, 20).map((m) => (
              <View key={m.id} style={styles.hRow}>
                <View style={[styles.hIcon, { backgroundColor: "rgba(139,92,246,0.15)" }]}>
                  <Ionicons name="hammer" size={14} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hName}>{m.item_name} · <Text style={{ color: "#8B5CF6", fontWeight: "800" }}>+{m.qty}</Text></Text>
                  <Text style={styles.hSub}>{m.date}{m.notes ? " · " + m.notes : ""} · {m.created_by_name || "-"}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.section}>Riwayat Kirim ke Gudang</Text>
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

        {damages.length > 0 && (
          <>
            <Text style={styles.section}>Riwayat Repair & Rusak</Text>
            <View style={styles.historyCard}>
              {damages.slice(0, 30).map((m) => {
                const label =
                  m.kind === "return" ? "Return dari Gudang" :
                  m.kind === "repair_done" ? "Repair Selesai" :
                  m.kind === "write_off" ? `Rusak Permanen (${m.source || "-"})` : m.kind || "-";
                const color =
                  m.kind === "return" ? "#F59E0B" :
                  m.kind === "repair_done" ? "#059669" :
                  theme.color.error;
                const icon =
                  m.kind === "return" ? "return-up-back" :
                  m.kind === "repair_done" ? "build" : "close-circle";
                return (
                  <View key={m.id} style={styles.hRow}>
                    <View style={[styles.hIcon, { backgroundColor: color + "22" }]}>
                      <Ionicons name={icon as any} size={14} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hName}>
                        {m.item_name} · <Text style={{ color, fontWeight: "800" }}>{m.qty}</Text>{"  "}
                        <Text style={{ fontSize: 11, color, fontWeight: "700" }}>· {label}</Text>
                      </Text>
                      <Text style={styles.hSub}>{m.date}{m.notes ? " · " + m.notes : ""} · {m.created_by_name || "-"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.mHeader}>
              <View style={styles.mIcon}>
                <Ionicons
                  name={
                    modal === "produce" ? "hammer" :
                    modal === "transfer" ? "paper-plane" :
                    modal === "repair_done" ? "build" : "close-circle"
                  }
                  size={22}
                  color={
                    modal === "repair_done" ? "#F59E0B" :
                    modal === "write_off" ? theme.color.error : theme.color.brand
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mTitle}>
                  {modal === "produce" ? "Catat Produksi" :
                   modal === "transfer" ? "Kirim ke Gudang" :
                   modal === "repair_done" ? "Selesai Repair" : "Rusak Permanen (Write-off)"}
                </Text>
                <Text style={styles.mSub}>
                  {modal === "produce" ? "Barang jadi diproduksi hari ini" :
                   modal === "transfer" ? "Produksi → Gudang (siap dijual)" :
                   modal === "repair_done" ? "Barang repair kembali ke stok Produksi" :
                   "Hilangkan permanen (mengurangi stok)"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModal(null)}>
                <Ionicons name="close" size={22} color={theme.color.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 14 }}>
              <Text style={styles.label}>Pilih Barang</Text>
              <View style={styles.chipsWrap}>
                {items.map((it) => {
                  const stok = stokProduksiFor[it.name] || 0;
                  const rep = repairFor[it.name] || 0;
                  const disabled =
                    (modal === "transfer" && stok <= 0) ||
                    (modal === "repair_done" && rep <= 0) ||
                    (modal === "write_off" && writeOffSource === "repair" && rep <= 0) ||
                    (modal === "write_off" && writeOffSource === "produksi" && stok <= 0);
                  const active = selectedItem === it.name;
                  return (
                    <TouchableOpacity
                      key={it.id}
                      onPress={() => !disabled && setSelectedItem(it.name)}
                      disabled={disabled}
                      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                      testID={`jadi-chip-${it.name}`}
                    >
                      <Text style={[styles.chipText, active && { color: "#fff" }, disabled && { color: theme.color.muted }]}>
                        {it.name}
                      </Text>
                      <Text style={[styles.chipUnit, active && { color: "#D1FAE5" }]}>{it.unit}</Text>
                      {modal === "transfer" && (
                        <Text style={[styles.chipStok, active && { color: "#D1FAE5" }, disabled && { color: theme.color.muted }]}>stok {stok}</Text>
                      )}
                      {modal === "repair_done" && (
                        <Text style={[styles.chipStok, active && { color: "#FEF3C7" }, disabled && { color: theme.color.muted }]}>repair {rep}</Text>
                      )}
                      {modal === "write_off" && (
                        <Text style={[styles.chipStok, active && { color: "#FEE2E2" }, disabled && { color: theme.color.muted }]}>
                          {writeOffSource === "repair" ? `repair ${rep}` : `stok ${stok}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {modal === "write_off" && (
                <>
                  <Text style={styles.label}>Sumber</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["repair", "produksi"] as const).map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setWriteOffSource(s)}
                        style={[styles.chip, writeOffSource === s && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, writeOffSource === s && { color: "#fff" }]}>
                          {s === "repair" ? "Dari antrian Repair" : "Dari stok Produksi"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Qty</Text>
              <View style={styles.stepRow}>
                <TouchableOpacity onPress={() => setQty((v) => String(Math.max(0, (parseInt(v, 10) || 0) - 1)))} style={styles.stepBtn}>
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
                  testID="jadi-qty-input"
                />
                <TouchableOpacity onPress={() => setQty((v) => String((parseInt(v, 10) || 0) + 1))} style={styles.stepBtn}>
                  <Ionicons name="add" size={18} color={theme.color.brand} />
                </TouchableOpacity>
              </View>
              <View style={styles.presetsRow}>
                {[10, 25, 50, 100, 250, 500].map((v) => (
                  <TouchableOpacity key={v} onPress={() => setQty(String(v))} style={styles.presetBtn}>
                    <Text style={styles.presetText}>+{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Catatan (opsional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={modal === "write_off" ? "Contoh: hangus terbakar, hilang, dsb" : modal === "repair_done" ? "Contoh: ganti kardus" : "Contoh: batch pagi"}
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
                disabled={sending || !qty || !selectedItem}
                style={[styles.doBtn, (sending || !qty || !selectedItem) && { opacity: 0.55 }, modal === "write_off" && { backgroundColor: theme.color.error }, modal === "repair_done" && { backgroundColor: "#F59E0B" }]}
                testID="do-jadi-btn"
              >
                {sending ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name={modal === "produce" ? "hammer" : modal === "transfer" ? "paper-plane" : modal === "repair_done" ? "build" : "close-circle"} size={14} color="#fff" />
                    <Text style={styles.doBtnText}>
                      {modal === "produce" ? "Simpan" : modal === "transfer" ? "Kirim" : modal === "repair_done" ? "Selesai" : "Write-off"}
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
  infoBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, backgroundColor: "rgba(15,118,110,0.06)", borderWidth: 1, borderColor: "rgba(15,118,110,0.15)" },
  infoText: { flex: 1, fontSize: 11, color: theme.color.onSurface, lineHeight: 16 },
  section: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface, marginTop: 4 },
  emptyBox: { padding: 24, alignItems: "center", gap: 8, backgroundColor: theme.color.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border },
  emptyText: { fontSize: 12, color: theme.color.muted, textAlign: "center" },
  stockCard: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.color.border },
  stockHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.color.border, marginBottom: 4 },
  stockHeaderText: { fontSize: 10, fontWeight: "800", color: theme.color.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  stockCol: { minWidth: 60, textAlign: "center", padding: 4, borderRadius: 6 },
  stockRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border,
  },
  stockName: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  stockUnit: { fontSize: 10, color: theme.color.muted },
  stockVal: { minWidth: 60, fontSize: 15, fontWeight: "700", color: theme.color.onSurface, textAlign: "center", fontVariant: ["tabular-nums"] },
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
});
