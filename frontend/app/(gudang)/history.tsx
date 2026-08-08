import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { EditEntryModal } from "@/src/components/EditEntryModal";

export default function GudangHistory() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.listWarehouseDaily({});
      setRows(list || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDelete = (id: string) => {
    const doDel = async () => {
      try {
        await api.deleteWarehouseDaily(id);
        toast.show("Terhapus", "success");
        load();
      } catch (e: any) {
        toast.show(e?.message || "Gagal hapus", "error");
      }
    };
    if (typeof window !== "undefined" && (window as any).confirm) {
      if ((window as any).confirm("Hapus entry ini?")) doDel();
    } else {
      Alert.alert("Hapus?", "Yakin hapus entry ini?", [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDel },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Riwayat Input Gudang" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.color.muted, marginTop: 32 }}>Belum ada data</Text>}
        renderItem={({ item }) => {
          const terjual = (item.bawa_pagi || 0) + (item.bawa_siang || 0) - (item.sisa_pagi || 0) - (item.sisa_siang || 0);
          return (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.date}>{item.date} — {item.shift?.toUpperCase()}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {item.kelompok ? <Text style={styles.kel}>{item.kelompok}</Text> : null}
                  <Text style={styles.sales}>{item.sales_code}</Text>
                  {item.edit_count ? (
                    <View style={styles.editedBadge}><Text style={styles.editedText}>edited</Text></View>
                  ) : (
                    <TouchableOpacity onPress={() => setEditing(item)}>
                      <Ionicons name="create-outline" size={18} color={theme.color.brand} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.pills}>
                {(item.bawa_pagi || item.bawa_siang) ? <Pill k="Bawa" v={(item.bawa_pagi || 0) + (item.bawa_siang || 0)} color="#059669" /> : null}
                {(item.sisa_pagi || item.sisa_siang) ? <Pill k="Sisa" v={(item.sisa_pagi || 0) + (item.sisa_siang || 0)} color="#F59E0B" /> : null}
                {terjual ? <Pill k="Terjual" v={terjual} color="#0EA5E9" /> : null}
                {item.galon_ganti ? <Pill k="Gln" v={item.galon_ganti} /> : null}
                {item.galon_kran ? <Pill k="Gln Krn" v={item.galon_kran} /> : null}
                {item.galon_polos ? <Pill k="Gln Pls" v={item.galon_polos} /> : null}
                {item.kran_ganti ? <Pill k="Krn" v={item.kran_ganti} /> : null}
                {item.seal_ganti ? <Pill k="Seal" v={item.seal_ganti} /> : null}
                {item.mur_ganti ? <Pill k="Mur" v={item.mur_ganti} /> : null}
                {item.stiker_ganti ? <Pill k="Stiker" v={item.stiker_ganti} /> : null}
                {item.karet_kran_ganti ? <Pill k="Karet" v={item.karet_kran_ganti} /> : null}
                {item.stoper_ganti ? <Pill k="Stoper" v={item.stoper_ganti} /> : null}
              </View>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
          );
        }}
      />
      <EditEntryModal
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
        entry={editing}
        kind="warehouse"
      />
    </View>
  );
}

function Pill({ k, v, color }: { k: string; v: number; color?: string }) {
  return (
    <View style={[styles.pill, color ? { backgroundColor: color + "22", borderColor: color + "44" } : null]}>
      <Text style={[styles.pillK, color ? { color } : null]}>{k}</Text>
      <Text style={[styles.pillV, color ? { color } : null]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontWeight: "700", color: theme.color.onSurface },
  sales: { fontSize: 12, fontWeight: "700", color: theme.color.brand, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  kel: { fontSize: 11, fontWeight: "700", color: "#DC2626", backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  editedBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  editedText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary },
  pillK: { fontSize: 11, color: theme.color.muted },
  pillV: { fontSize: 12, fontWeight: "800", color: theme.color.onSurface },
  note: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
});
