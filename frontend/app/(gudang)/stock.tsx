import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/src/components/AppHeader";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { itemLabel } from "./dashboard";

const ITEM_ORDER = ["galon", "galon_kran", "kran", "seal", "mur", "stiker", "karet_kran", "stoper"];
const ITEM_ICONS: Record<string, any> = {
  galon: "water",
  galon_kran: "water-outline",
  seal: "ellipse-outline",
  mur: "cog",
  kran: "beaker",
  stiker: "pricetag",
  karet_kran: "ellipse",
  stoper: "stop-circle",
};

export default function GudangStock() {
  const [stock, setStock] = useState<Record<string, number>>({});
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.getWarehouseStock();
      setStock(s || {});
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surfaceSecondary }}>
      <AppHeader title="Stok Gudang Real-time" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      >
        {ITEM_ORDER.map((k) => {
          const v = stock[k] || 0;
          const low = v < 10;
          return (
            <View key={k} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name={ITEM_ICONS[k] || "cube-outline"} size={22} color={low ? theme.color.error : theme.color.brand} />
              </View>
              <Text style={styles.name}>{itemLabel(k)}</Text>
              <Text style={[styles.value, low ? { color: theme.color.error } : null]}>{v}</Text>
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
