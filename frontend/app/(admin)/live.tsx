import React, { useCallback, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";

export default function LiveLocations() {
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.liveLocations();
      setItems(r);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Lokasi Sales (Live)</Text>
        <Text style={styles.sub}>Otomatis diupdate tiap 60 detik saat sales online</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        {items.map((s) => {
          const l = s.last_location;
          return (
            <View key={s.id} style={styles.card}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{s.sales_code || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                {l ? (
                  <>
                    <Text style={styles.coords}>{l.lat.toFixed(5)}, {l.lng.toFixed(5)}</Text>
                    <Text style={styles.time}>Update: {new Date(l.ts).toLocaleString("id-ID")}</Text>
                  </>
                ) : (
                  <Text style={styles.offline}>Belum ada lokasi</Text>
                )}
              </View>
              <View style={[styles.dot, { backgroundColor: l ? theme.color.success : theme.color.muted }]} />
            </View>
          );
        })}
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={40} color={theme.color.muted} />
            <Text style={styles.emptyText}>Belum ada data lokasi</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface },
  sub: { fontSize: 12, color: theme.color.muted, marginTop: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.color.border, marginBottom: 8 },
  badge: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.color.brandTertiary, alignItems: "center", justifyContent: "center" },
  badgeText: { color: theme.color.onBrandTertiary, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "500", color: theme.color.onSurface },
  coords: { fontSize: 12, color: theme.color.muted, marginTop: 2, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) },
  time: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  offline: { fontSize: 12, color: theme.color.muted, fontStyle: "italic" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: theme.color.muted, marginTop: 12 },
});
