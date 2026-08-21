import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

type Item = {
  id: string;
  name: string;
  category: string;
  unit: string;
  order: number;
  bom?: Record<string, number>;
  bom_repair?: Record<string, number>;
};

/** SuperAdmin CRUD untuk Bahan & Barang Jadi. */
export default function InventoryItemsAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState<"bahan" | "barang_jadi">("bahan");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [saving, setSaving] = useState(false);
  const [bomEditor, setBomEditor] = useState<Item | null>(null);
  const [bomMain, setBomMain] = useState<Record<string, string>>({});
  const [bomRepair, setBomRepair] = useState<Record<string, string>>({});
  const [savingBom, setSavingBom] = useState(false);

  const bahanList = useMemo(() => items.filter((i) => i.category === "bahan"), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api.listInventoryItems();
      setItems(all || []);
    } catch (e: any) {
      toast.show(e?.message || "Gagal muat", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) => it.category === tab);

  const add = async () => {
    const n = name.trim();
    if (!n) return toast.show("Nama tidak boleh kosong", "error");
    setSaving(true);
    try {
      await api.createInventoryItem({ name: n, category: tab, unit: unit.trim() || "pcs", order: filtered.length + 1 });
      toast.show(`Tambah ${n} ✅`, "success");
      setName("");
      setUnit("pcs");
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal", "error");
    } finally {
      setSaving(false);
    }
  };

  const openBom = (it: Item) => {
    setBomEditor(it);
    const m: Record<string, string> = {};
    const r: Record<string, string> = {};
    Object.entries(it.bom || {}).forEach(([k, v]) => { m[k] = String(v || ""); });
    Object.entries(it.bom_repair || {}).forEach(([k, v]) => { r[k] = String(v || ""); });
    setBomMain(m);
    setBomRepair(r);
  };

  const saveBom = async () => {
    if (!bomEditor) return;
    setSavingBom(true);
    try {
      const packDict = (src: Record<string, string>) => {
        const out: Record<string, number> = {};
        Object.entries(src).forEach(([k, v]) => {
          const n = parseFloat(v);
          if (!isNaN(n) && n > 0) out[k] = n;
        });
        return out;
      };
      await api.updateInventoryItem(bomEditor.id, {
        name: bomEditor.name,
        category: bomEditor.category,
        unit: bomEditor.unit,
        order: bomEditor.order,
        bom: packDict(bomMain),
        bom_repair: packDict(bomRepair),
      });
      toast.show("BOM tersimpan ✅", "success");
      setBomEditor(null);
      await load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan BOM", "error");
    } finally {
      setSavingBom(false);
    }
  };

  const del = (item: Item) => {
    Alert.alert(
      "Hapus?",
      `Hapus "${item.name}" (${item.category})? Riwayat transfer/produksi tetap tersimpan.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteInventoryItem(item.id);
              toast.show("Terhapus", "success");
              await load();
            } catch (e: any) {
              toast.show(e?.message || "Gagal", "error");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Inventory Items" />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            onPress={() => setTab("bahan")}
            style={[styles.tab, tab === "bahan" && styles.tabActive]}
            testID="tab-bahan"
          >
            <Ionicons name="layers" size={16} color={tab === "bahan" ? "#fff" : theme.color.onSurface} />
            <Text style={[styles.tabText, tab === "bahan" && { color: "#fff" }]}>Bahan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("barang_jadi")}
            style={[styles.tab, tab === "barang_jadi" && styles.tabActive]}
            testID="tab-barang-jadi"
          >
            <Ionicons name="hammer" size={16} color={tab === "barang_jadi" ? "#fff" : theme.color.onSurface} />
            <Text style={[styles.tabText, tab === "barang_jadi" && { color: "#fff" }]}>Barang Jadi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hint}>
          <Ionicons name="information-circle" size={14} color={theme.color.brand} />
          <Text style={styles.hintText}>
            {tab === "bahan"
              ? "Bahan: material yg dikirim Gudang → Produksi (cup kosong, kardus, sedotan, lid cup, lakban)."
              : "Barang Jadi: hasil Produksi → dikirim ke Gudang → dijual Sales (Cup 150ml, 240ml, Botol, dll). Nama harus sama dengan produk di Sales."}
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.section}>Tambah {tab === "bahan" ? "Bahan" : "Barang Jadi"}</Text>
          <View style={styles.formRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tab === "bahan" ? "Contoh: Cup Kosong 240ml" : "Contoh: Cup 240ml (harus match nama produk)"}
              placeholderTextColor={theme.color.muted}
              style={[styles.input, { flex: 2 }]}
              testID="new-item-name"
            />
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="pcs"
              placeholderTextColor={theme.color.muted}
              style={[styles.input, { flex: 1 }]}
              testID="new-item-unit"
            />
            <TouchableOpacity onPress={add} disabled={saving || !name} style={[styles.addBtn, (saving || !name) && { opacity: 0.55 }]} testID="add-item-btn">
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.section}>Daftar {tab === "bahan" ? "Bahan" : "Barang Jadi"} ({filtered.length})</Text>
        {loading ? (
          <ActivityIndicator color={theme.color.brand} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={26} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {filtered.map((it) => {
              const bomCount = Object.keys(it.bom || {}).length;
              const bomRCount = Object.keys(it.bom_repair || {}).length;
              return (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.itemIcon}>
                    <Ionicons name={tab === "bahan" ? "layers" : "hammer"} size={16} color={theme.color.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      Satuan: {it.unit}
                      {tab === "barang_jadi" ? ` · BOM: ${bomCount} bahan · Repair: ${bomRCount}` : ""}
                    </Text>
                  </View>
                  {tab === "barang_jadi" && (
                    <TouchableOpacity onPress={() => openBom(it)} style={styles.bomBtn} testID={`bom-${it.name}`}>
                      <Ionicons name="construct" size={16} color={theme.color.brandPrimary} />
                      <Text style={styles.bomBtnText}>BOM</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => del(it)} style={styles.delBtn} testID={`del-item-${it.name}`}>
                    <Ionicons name="trash" size={18} color={theme.color.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* BOM Editor Modal */}
      <Modal visible={!!bomEditor} transparent animationType="fade" onRequestClose={() => setBomEditor(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Resep Bahan (BOM)</Text>
                <Text style={styles.modalSub}>{bomEditor?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setBomEditor(null)}>
                <Ionicons name="close" size={22} color={theme.color.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ padding: 12, gap: 6 }} keyboardShouldPersistTaps="handled">
              <View style={styles.bomHint}>
                <Ionicons name="information-circle" size={14} color={theme.color.brand} />
                <Text style={styles.bomHintText}>
                  Isi qty bahan per 1 unit barang jadi. <Text style={{ fontWeight: "800" }}>BOM Utama</Text> dipakai saat Catat Produksi & Rusak Permanen.{" "}
                  <Text style={{ fontWeight: "800" }}>BOM Repair</Text> dipakai saat Selesai Repair. Kosongkan = tidak dipakai.
                </Text>
              </View>

              <View style={styles.bomHeaderRow}>
                <Text style={[styles.bomHeaderCell, { flex: 1 }]}>Bahan</Text>
                <Text style={[styles.bomHeaderCell, { width: 80, textAlign: "center", backgroundColor: theme.color.brandTertiary }]}>Utama</Text>
                <Text style={[styles.bomHeaderCell, { width: 80, textAlign: "center", backgroundColor: "#FEF3C7" }]}>Repair</Text>
              </View>

              {bahanList.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada bahan. Tambah bahan dulu di tab Bahan.</Text>
              ) : (
                bahanList.map((b) => (
                  <View key={b.id} style={styles.bomRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bomBahanName}>{b.name}</Text>
                      <Text style={styles.bomBahanUnit}>{b.unit}</Text>
                    </View>
                    <TextInput
                      value={bomMain[b.name] || ""}
                      onChangeText={(v) => setBomMain((s) => ({ ...s, [b.name]: v.replace(/[^\d.]/g, "") }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={theme.color.muted}
                      style={styles.bomInput}
                    />
                    <TextInput
                      value={bomRepair[b.name] || ""}
                      onChangeText={(v) => setBomRepair((s) => ({ ...s, [b.name]: v.replace(/[^\d.]/g, "") }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={theme.color.muted}
                      style={[styles.bomInput, { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" }]}
                    />
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setBomEditor(null)} style={styles.cancelBtn} disabled={savingBom}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveBom}
                disabled={savingBom}
                style={[styles.saveBomBtn, savingBom && { opacity: 0.55 }]}
              >
                {savingBom ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="save" size={14} color="#fff" />
                    <Text style={styles.saveBomText}>Simpan BOM</Text>
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
  tabRow: { flexDirection: "row", gap: 6, padding: 4, backgroundColor: theme.color.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border },
  tab: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 8 },
  tabActive: { backgroundColor: theme.color.brand },
  tabText: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface },
  hint: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, backgroundColor: "rgba(15,118,110,0.06)", borderWidth: 1, borderColor: "rgba(15,118,110,0.15)" },
  hintText: { flex: 1, fontSize: 11, color: theme.color.onSurface, lineHeight: 16 },
  formCard: { backgroundColor: theme.color.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, gap: 8 },
  formRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  section: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface },
  input: {
    borderWidth: 1, borderColor: theme.color.border, borderRadius: 10, padding: 10,
    fontSize: 14, color: theme.color.onSurface, backgroundColor: theme.color.surfaceSecondary,
  },
  addBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  emptyBox: { padding: 24, alignItems: "center", gap: 6, backgroundColor: theme.color.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border },
  emptyText: { fontSize: 12, color: theme.color.muted },
  listCard: { backgroundColor: theme.color.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.color.border, gap: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  itemIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  itemMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  delBtn: { padding: 8, borderRadius: 8 },
  bomBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.color.brandTertiary, borderWidth: 1, borderColor: theme.color.brandPrimary },
  bomBtnText: { fontSize: 11, fontWeight: "700", color: theme.color.brandPrimary },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 500, backgroundColor: theme.color.surface, borderRadius: 16, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  modalTitle: { fontSize: 15, fontWeight: "800", color: theme.color.onSurface },
  modalSub: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  bomHint: { flexDirection: "row", gap: 6, padding: 10, borderRadius: 10, backgroundColor: theme.color.brandTertiary, marginBottom: 8 },
  bomHintText: { flex: 1, fontSize: 11, color: theme.color.brand, lineHeight: 15 },
  bomHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bomHeaderCell: { fontSize: 10, fontWeight: "800", color: theme.color.muted, textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 6 },
  bomRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  bomBahanName: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface },
  bomBahanUnit: { fontSize: 10, color: theme.color.muted },
  bomInput: { width: 80, height: 36, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, textAlign: "center", fontSize: 14, fontWeight: "700", color: theme.color.onSurface, backgroundColor: theme.color.brandTertiary },
  modalFooter: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: theme.color.border },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: theme.color.onSurface },
  saveBomBtn: { flex: 2, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 12, borderRadius: 10, backgroundColor: theme.color.brandPrimary },
  saveBomText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
