import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, Alert, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { EditEntryModal } from "@/src/components/EditEntryModal";

type Kind = "production" | "warehouse";

export default function SuperAdminProdWhData() {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("production");
  const [rows, setRows] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [filterKelompok, setFilterKelompok] = useState<string>("");
  const [filterSales, setFilterSales] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const list = kind === "production" ? await api.listProductionDaily({}) : await api.listWarehouseDaily({});
      setRows(list || []);
    } catch (e: any) {
      toast.show(e?.message || "Gagal load data", "error");
    }
  }, [kind, toast]);

  useEffect(() => { load(); }, [load]);

  const onDelete = (id: string) => {
    const doDel = async () => {
      try {
        if (kind === "production") await api.deleteProductionDaily(id);
        else await api.deleteWarehouseDaily(id);
        toast.show("Terhapus", "success");
        load();
      } catch (e: any) {
        toast.show(e?.message || "Gagal hapus", "error");
      }
    };
    if (typeof window !== "undefined" && (window as any).confirm) {
      if ((window as any).confirm("Hapus entry ini permanen?")) doDel();
    } else {
      Alert.alert("Hapus?", "Yakin hapus?", [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: doDel },
      ]);
    }
  };

  // Unique kelompok & sales for filter chips
  const kelompokOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.kelompok).filter(Boolean))).sort(), [rows]);
  const salesOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.sales_code).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterKelompok && r.kelompok !== filterKelompok) return false;
      if (filterSales && r.sales_code !== filterSales) return false;
      return true;
    });
  }, [rows, filterKelompok, filterSales]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Data Produksi & Gudang" subtitle="Super Admin — bisa edit unlimited" />

      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setKind("production")} style={[styles.tab, kind === "production" && styles.tabOn]}>
          <Text style={[styles.tabText, kind === "production" && { color: "#fff" }]}>Produksi</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setKind("warehouse")} style={[styles.tab, kind === "warehouse" && styles.tabOn]}>
          <Text style={[styles.tabText, kind === "warehouse" && { color: "#fff" }]}>Gudang</Text>
        </TouchableOpacity>
      </View>

      {(kelompokOptions.length > 0 || salesOptions.length > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 80 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: "center" }}>
          <TouchableOpacity onPress={() => { setFilterKelompok(""); setFilterSales(""); }} style={styles.clearChip}>
            <Ionicons name="close-circle" size={14} color={theme.color.muted} />
            <Text style={styles.clearChipText}>Semua</Text>
          </TouchableOpacity>
          {kelompokOptions.map((k) => (
            <TouchableOpacity key={"k-" + k} onPress={() => setFilterKelompok((s) => s === k ? "" : k)} style={[styles.filterChip, filterKelompok === k && styles.filterChipOn]}>
              <Text style={[styles.filterChipText, filterKelompok === k && { color: "#fff" }]}>{k}</Text>
            </TouchableOpacity>
          ))}
          {salesOptions.map((s) => (
            <TouchableOpacity key={"s-" + s} onPress={() => setFilterSales((v) => v === s ? "" : s)} style={[styles.filterChip, filterSales === s && styles.filterChipSalesOn]}>
              <Text style={[styles.filterChipText, filterSales === s && { color: "#fff" }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.color.muted, marginTop: 32 }}>Belum ada data</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.date}>{item.date} — {item.shift?.toUpperCase()}</Text>
                <Text style={styles.subInfo}>
                  {item.created_by_name || "-"}
                  {item.updated_by_name ? ` → diedit oleh ${item.updated_by_name}` : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {item.kelompok ? <Text style={styles.kel}>{item.kelompok}</Text> : null}
                <Text style={styles.sales}>{item.sales_code}</Text>
                <TouchableOpacity onPress={() => setEditing(item)}>
                  <Ionicons name="create-outline" size={20} color={theme.color.brand} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color={theme.color.error} />
                </TouchableOpacity>
              </View>
            </View>
            {renderPills(item, kind)}
            {item.edit_count ? <Text style={styles.editInfo}>✏️ diedit {item.edit_count}x</Text> : null}
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </View>
        )}
      />

      <EditEntryModal
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
        entry={editing}
        kind={kind}
      />
    </View>
  );
}

function renderPills(item: any, kind: Kind) {
  if (kind === "production") {
    return (
      <View style={styles.pills}>
        {item.produksi_galon ? <Pill k="Prod Gln" v={item.produksi_galon} color="#1E3A8A" /> : null}
        {item.galon_ganti ? <Pill k="Gln Gt" v={item.galon_ganti} /> : null}
        {item.sil_ganti ? <Pill k="Sil" v={item.sil_ganti} /> : null}
        {item.mur_ganti ? <Pill k="Mur" v={item.mur_ganti} /> : null}
        {item.kran_ganti ? <Pill k="Kran" v={item.kran_ganti} /> : null}
        {item.stiker_ganti ? <Pill k="Stiker" v={item.stiker_ganti} /> : null}
        {item.stoper_ganti ? <Pill k="Stoper" v={item.stoper_ganti} /> : null}
        {item.karet_kran_ganti ? <Pill k="Karet Krn" v={item.karet_kran_ganti} /> : null}
      </View>
    );
  }
  const terjual = (item.bawa_pagi || 0) + (item.bawa_siang || 0) - (item.sisa_pagi || 0) - (item.sisa_siang || 0);
  return (
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
  tabRow: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: theme.color.surface },
  tab: { flex: 1, padding: 12, borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, alignItems: "center" },
  tabOn: { backgroundColor: theme.color.brandPrimary, borderColor: theme.color.brandPrimary },
  tabText: { fontWeight: "700", color: theme.color.onSurface },
  clearChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border },
  clearChipText: { fontSize: 12, color: theme.color.muted },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border },
  filterChipOn: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  filterChipSalesOn: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  filterChipText: { fontSize: 12, fontWeight: "600", color: theme.color.onSurface },
  card: { backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, gap: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  date: { fontWeight: "700", color: theme.color.onSurface },
  subInfo: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  sales: { fontSize: 12, fontWeight: "700", color: theme.color.brand, backgroundColor: theme.color.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  kel: { fontSize: 11, fontWeight: "700", color: "#8B5CF6", backgroundColor: "#EDE9FE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary },
  pillK: { fontSize: 11, color: theme.color.muted },
  pillV: { fontSize: 12, fontWeight: "800", color: theme.color.onSurface },
  editInfo: { fontSize: 11, color: "#F59E0B", fontWeight: "600" },
  note: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
});
