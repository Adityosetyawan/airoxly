import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

export default function ProduksiHistory() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listProductionDaily({});
      setRows(list || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = (id: string) => {
    const doDel = async () => {
      try {
        await api.deleteProductionDaily(id);
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
      <AppHeader title="Riwayat Input Produksi" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.color.muted, marginTop: 32 }}>Belum ada data</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.date}>{item.date} — {item.shift?.toUpperCase()}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {item.kelompok ? (
                  <Text style={styles.kel}>{item.kelompok}</Text>
                ) : null}
                <Text style={styles.sales}>{item.sales_code}</Text>
                <TouchableOpacity onPress={() => onDelete(item.id)}>
                  <Ionicons name="trash-outline" size={18} color={theme.color.error} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.pills}>
              {item.galon_ganti ? <Pill k="Gln Gt" v={item.galon_ganti} /> : null}
              {item.sil_ganti ? <Pill k="Sil" v={item.sil_ganti} /> : null}
              {item.mur_ganti ? <Pill k="Mur" v={item.mur_ganti} /> : null}
              {item.kran_ganti ? <Pill k="Kran" v={item.kran_ganti} /> : null}
              {item.stiker_ganti ? <Pill k="Stiker" v={item.stiker_ganti} /> : null}
              {item.stoper_ganti ? <Pill k="Stoper" v={item.stoper_ganti} /> : null}
              {item.karet_kran_ganti ? <Pill k="Karet Kran" v={item.karet_kran_ganti} /> : null}
              {item.produksi_galon ? <Pill k="Prod Gln" v={item.produksi_galon} color="#1E3A8A" /> : null}
              {item.stok_galon_baru ? <Pill k="Gln Baru" v={item.stok_galon_baru} color="#DC2626" /> : null}
            </View>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </View>
        )}
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
  kel: { fontSize: 11, fontWeight: "700", color: "#8B5CF6", backgroundColor: "#EDE9FE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary },
  pillK: { fontSize: 11, color: theme.color.muted },
  pillV: { fontSize: 12, fontWeight: "800", color: theme.color.onSurface },
  note: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
});
