import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

type PartPrice = { id: string; name: string; rp_per_pcs: number; order?: number };

// Ikon default berdasarkan nama part (fallback: cube-outline)
function pickIcon(name: string): any {
  const n = name.toLowerCase();
  if (n.includes("galon")) return "water";
  if (n.includes("seal") || n.includes("sil")) return "ellipse-outline";
  if (n.includes("mur")) return "cog";
  if (n.includes("kran")) return "beaker";
  if (n.includes("stiker")) return "pricetag";
  if (n.includes("karet")) return "ellipse";
  if (n.includes("stoper")) return "stop-circle";
  return "cube-outline";
}

export default function GudangStock() {
  const [stock, setStock] = useState<Record<string, number>>({});
  const [parts, setParts] = useState<PartPrice[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.getWarehouseStock(),
        api.listPartPrices().catch(() => []),
      ]);
      setStock((s as any) || {});
      const sorted = [...(p || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setParts(sorted);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Gabungkan: item dari part_prices + item stok yang tidak ada di part_prices (legacy)
  const partNames = parts.map((p) => p.name);
  const extraKeys = Object.keys(stock).filter((k) => !partNames.includes(k));
  const rows: { name: string; qty: number }[] = [
    ...parts.map((p) => ({ name: p.name, qty: Number(stock[p.name] || 0) })),
    ...extraKeys.map((k) => ({ name: k, qty: Number(stock[k] || 0) })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Stok Gudang Real-time" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      >
        {rows.length === 0 ? (
          <Text style={styles.hint}>Belum ada item Part. Minta SuperAdmin menambah item.</Text>
        ) : rows.map((r) => {
          const low = r.qty < 10;
          return (
            <View key={r.name} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name={pickIcon(r.name)} size={22} color={low ? theme.color.error : theme.color.brand} />
              </View>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={[styles.value, low ? { color: theme.color.error } : null]}>{r.qty}</Text>
            </View>
          );
        })}
        <Text style={styles.hint}>Stok merah = kurang dari 10 unit</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.color.surface,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.color.onSurface },
  value: { fontSize: 22, fontWeight: "800", color: theme.color.onSurface },
  hint: { fontSize: 11, color: theme.color.muted, textAlign: "center", marginTop: 8 },
});
