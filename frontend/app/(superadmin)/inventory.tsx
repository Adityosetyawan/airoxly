import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

/** SuperAdmin CRUD untuk Bahan & Barang Jadi. */
export default function InventoryItemsAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState<"bahan" | "barang_jadi">("bahan");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [saving, setSaving] = useState(false);

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
            {filtered.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemIcon}>
                  <Ionicons name={tab === "bahan" ? "layers" : "hammer"} size={16} color={theme.color.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemMeta}>Satuan: {it.unit}</Text>
                </View>
                <TouchableOpacity onPress={() => del(it)} style={styles.delBtn} testID={`del-item-${it.name}`}>
                  <Ionicons name="trash" size={18} color={theme.color.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
});
