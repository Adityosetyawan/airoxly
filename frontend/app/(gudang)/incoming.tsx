import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type PartPrice = { id: string; name: string; rp_per_pcs: number; order?: number };

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function GudangIncoming() {
  const toast = useToast();
  const [parts, setParts] = useState<PartPrice[]>([]);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, p] = await Promise.all([
        api.listWarehouseIncoming({}),
        api.listPartPrices().catch(() => []),
      ]);
      setRows(list || []);
      const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setParts(sorted);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const setQty = (name: string, v: string) =>
    setQtys((s) => ({ ...s, [name]: v.replace(/[^\d]/g, "") }));

  const filled = useMemo(() => {
    const list = Object.entries(qtys)
      .map(([name, v]) => ({ name, qty: parseInt(v, 10) || 0 }))
      .filter((r) => r.qty > 0);
    return { list, count: list.length, total: list.reduce((a, b) => a + b.qty, 0) };
  }, [qtys]);

  const onSave = async () => {
    if (filled.list.length === 0) return toast.show("Isi minimal 1 item", "error");
    setSaving(true);
    try {
      const results = await Promise.allSettled(filled.list.map((e) =>
        api.createWarehouseIncoming({ date, item: e.name, qty: e.qty, note: note || null } as any)
      ));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.show(`✅ ${ok} item masuk (total ${filled.total})`, "success");
        setQtys({});
        setNote("");
      } else {
        toast.show(`${ok} berhasil, ${fail} gagal`, "error");
      }
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

            <Text style={styles.label}>Item & Jumlah</Text>
            {parts.length === 0 ? (
              <Text style={styles.hint}>
                Belum ada daftar Part. Minta SuperAdmin menambah item dulu di menu
                &quot;Kelola Part / Biaya Penggantian Part&quot;.
              </Text>
            ) : (
              <>
                <View style={styles.hintBox}>
                  <Ionicons name="information-circle" size={16} color={theme.color.brand} />
                  <Text style={styles.hintBoxText}>
                    Isi Qty untuk item yang mau dimasukkan. Baris 0/kosong akan diabaikan.
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {parts.map((p) => {
                    const val = qtys[p.name] || "";
                    const q = parseInt(val, 10) || 0;
                    return (
                      <View key={p.id} style={[styles.itemRow, q > 0 && styles.itemRowActive]}>
                        <Text style={styles.itemName} numberOfLines={2}>{p.name}</Text>
                        <View style={styles.qtyGroup}>
                          <TouchableOpacity
                            onPress={() => setQty(p.name, String(Math.max(0, q - 1)))}
                            style={styles.qtyStep}
                            testID={`incoming-minus-${p.name}`}
                          >
                            <Ionicons name="remove" size={16} color={theme.color.brand} />
                          </TouchableOpacity>
                          <TextInput
                            value={val}
                            onChangeText={(v) => setQty(p.name, v)}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={theme.color.muted}
                            style={styles.qtyInput}
                            testID={`incoming-qty-${p.name}`}
                          />
                          <TouchableOpacity
                            onPress={() => setQty(p.name, String(q + 1))}
                            style={styles.qtyStep}
                            testID={`incoming-plus-${p.name}`}
                          >
                            <Ionicons name="add" size={16} color={theme.color.brand} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.label}>Catatan (opsional, berlaku semua baris)</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Supplier, PO, dsb" style={styles.input} />

            <TouchableOpacity
              style={[styles.saveBtn, (saving || filled.count === 0) && { opacity: 0.55 }]}
              onPress={onSave}
              disabled={saving || filled.count === 0}
              testID="incoming-save-btn"
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.saveText}>
                  SIMPAN & ➕ STOK{filled.count > 0 ? `  (${filled.count} item · ${filled.total})` : ""}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.title, { marginTop: 16 }]}>Riwayat Barang Datang</Text>
          </View>
        }
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.color.muted, marginTop: 12 }}>Belum ada entry</Text>}
        renderItem={({ item: r }) => (
          <TouchableOpacity onLongPress={() => onDelete(r.id)} style={styles.rowCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowDate}>{r.date}</Text>
              <Text style={styles.rowItem}>{r.item} • +{r.qty}</Text>
              {r.note ? <Text style={styles.rowNote}>{r.note}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.color.surface, borderRadius: 14, padding: 14, gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "800", color: theme.color.onSurface },
  label: { fontSize: 12, fontWeight: "600", color: theme.color.onSurfaceSecondary, marginTop: 4 },
  hint: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
  hintBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: theme.color.brandTertiary, marginTop: 2, marginBottom: 4 },
  hintBoxText: { flex: 1, fontSize: 11, color: theme.color.brand, lineHeight: 15 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    padding: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    backgroundColor: "#fff",
    color: theme.color.onSurface,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  itemRowActive: { borderColor: theme.color.brandPrimary, backgroundColor: theme.color.brandTertiary },
  itemName: { flex: 1, fontSize: 14, fontWeight: "700", color: theme.color.onSurface },
  qtyGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyStep: { width: 30, height: 34, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 62, height: 34, borderWidth: 1, borderColor: theme.color.border, borderRadius: 8, textAlign: "center", fontSize: 15, fontWeight: "700", color: theme.color.onSurface, backgroundColor: "#fff", fontVariant: ["tabular-nums"], paddingVertical: 0 },
  saveBtn: { backgroundColor: theme.color.brandPrimary, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 6 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  rowCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.surface, padding: 12, borderRadius: 10, gap: 12 },
  rowDate: { fontSize: 12, color: theme.color.muted },
  rowItem: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  rowNote: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
});
