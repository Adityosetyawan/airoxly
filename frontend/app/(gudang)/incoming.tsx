import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { itemLabel } from "./dashboard";

const ITEMS = ["galon", "galon_kran", "kran", "seal", "mur", "stiker", "karet_kran", "stoper", "galon_polos"];
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function GudangIncoming() {
  const toast = useToast();
  const [item, setItem] = useState<string>("galon");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listWarehouseIncoming({});
      setRows(list || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSave = async () => {
    const q = parseInt(qty || "0") || 0;
    if (q <= 0) return toast.show("Isi jumlah barang > 0", "error");
    setSaving(true);
    try {
      await api.createWarehouseIncoming({ date, item, qty: q, note: note || null });
      toast.show(`✅ Stok ${itemLabel(item)} bertambah +${q}`, "success");
      setQty("");
      setNote("");
      load();
    } catch (e: any) {
      toast.show(e?.message || "Gagal simpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (id: string) => {
    const doDel = async () => {
      try {
        await api.deleteWarehouseIncoming(id);
        toast.show("Terhapus", "success");
        load();
      } catch (e: any) {
        toast.show(e?.message || "Gagal hapus", "error");
      }
    };
    if (typeof window !== "undefined" && (window as any).confirm) {
      if ((window as any).confirm("Hapus entry ini? Stok akan berkurang.")) doDel();
    } else {
      Alert.alert("Hapus?", "Yakin hapus? Stok akan berkurang.", [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDel },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Barang Datang" subtitle="➕ Otomatis tambah stok" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
        ListHeaderComponent={
          <View style={styles.card}>
            <Text style={styles.title}>Input Barang Masuk</Text>

            <Text style={styles.label}>Tanggal</Text>
            <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} />

            <Text style={styles.label}>Item</Text>
            <View style={styles.chipWrap}>
              {ITEMS.map((k) => (
                <TouchableOpacity key={k} onPress={() => setItem(k)} style={[styles.chip, item === k && styles.chipOn]}>
                  <Text style={[styles.chipText, item === k && { color: "#fff" }]}>{itemLabel(k)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Jumlah</Text>
            <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="0" style={styles.input} />

            <Text style={styles.label}>Catatan (opsional)</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Supplier, PO, dsb" style={styles.input} />

            <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>SIMPAN & ➕ STOK</Text>}
            </TouchableOpacity>

            <Text style={[styles.title, { marginTop: 16 }]}>Riwayat Barang Datang</Text>
          </View>
        }
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.color.muted, marginTop: 12 }}>Belum ada entry</Text>}
        renderItem={({ item: r }) => (
          <View style={styles.rowCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowDate}>{r.date}</Text>
              <Text style={styles.rowItem}>{itemLabel(r.item)} • +{r.qty}</Text>
              {r.note ? <Text style={styles.rowNote}>{r.note}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => onDelete(r.id)}>
              <Ionicons name="trash-outline" size={20} color={theme.color.error} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.color.surface, borderRadius: 14, padding: 14, gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "800", color: theme.color.onSurface },
  label: { fontSize: 12, fontWeight: "600", color: theme.color.onSurfaceSecondary, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    padding: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    backgroundColor: "#fff",
    color: theme.color.onSurface,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  saveBtn: { backgroundColor: theme.color.brandPrimary, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 6 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  rowCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.surface, padding: 12, borderRadius: 10, gap: 12 },
  rowDate: { fontSize: 12, color: theme.color.muted },
  rowItem: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  rowNote: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
});
