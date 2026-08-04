import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";
import { sendWhatsApp, broadcastWhatsApp } from "@/src/whatsapp";

type Winner = {
  period_id: string;
  period_name: string;
  drawn_at: string;
  prize_description?: string | null;
  rank: number;
  ticket_code: string;
  customer_id?: string;
  customer_name: string;
  customer_no?: number | null;
  customer_wa?: string;
  sales_code?: string;
  group_letter?: string;
};

export default function WinnersHistory() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const canBroadcast = user?.role === "super_admin" || user?.role === "admin";
  const [winners, setWinners] = useState<Winner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const items = await api.listAllWinners(500);
      setWinners(items);
    } catch (e: any) {
      toast.show(e?.message || "Gagal memuat", "error");
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Group by period
  const grouped: Record<string, { periodName: string; drawnAt: string; prize?: string | null; items: Winner[] }> = {};
  const q = query.toLowerCase().trim();
  winners
    .filter((w) => {
      if (!q) return true;
      return (
        w.customer_name.toLowerCase().includes(q) ||
        w.ticket_code.toLowerCase().includes(q) ||
        (w.sales_code || "").toLowerCase().includes(q) ||
        w.period_name.toLowerCase().includes(q)
      );
    })
    .forEach((w) => {
      const key = w.period_id;
      if (!grouped[key]) {
        grouped[key] = {
          periodName: w.period_name,
          drawnAt: w.drawn_at,
          prize: w.prize_description,
          items: [],
        };
      }
      grouped[key].items.push(w);
    });
  const groupList = Object.entries(grouped).sort(([, a], [, b]) =>
    b.drawnAt.localeCompare(a.drawnAt),
  );

  const sendWA = (w: Winner) => {
    if (!w.customer_wa) {
      toast.show("Pelanggan belum punya nomor WhatsApp", "error");
      return;
    }
    const msg = `🎉 Selamat ${w.customer_name}!\n\nAnda memenangkan Undian *${w.period_name}* sebagai Juara #${w.rank} dengan nomor undian *${w.ticket_code}*.${w.prize_description ? `\n\n🏆 Hadiah: ${w.prize_description}` : ""}\n\nSilakan hubungi kami untuk info klaim hadiah.\n\nSalam,\nTim Air OXLY`;
    sendWhatsApp(w.customer_wa, msg);
  };

  const broadcastGroup = async (periodName: string, items: Winner[], prize?: string | null) => {
    const eligible = items.filter((w) => w.customer_wa);
    if (eligible.length === 0) {
      toast.show("Tidak ada pemenang dengan nomor WhatsApp", "error");
      return;
    }
    const confirm = Platform.OS === "web"
      ? window.confirm(`Broadcast WA ke ${eligible.length} pemenang periode "${periodName}"? WhatsApp akan terbuka bergantian.`)
      : await new Promise<boolean>((res) => {
          Alert.alert(
            "Broadcast WA",
            `Kirim ucapan ke ${eligible.length} pemenang periode "${periodName}" secara berurutan?`,
            [
              { text: "Batal", style: "cancel", onPress: () => res(false) },
              { text: "Kirim", onPress: () => res(true) },
            ],
          );
        });
    if (!confirm) return;
    const recipients = eligible.map((w) => ({
      phone: w.customer_wa || "",
      label: w.customer_name,
      message: `🎉 Selamat ${w.customer_name}!\n\nAnda memenangkan Undian *${periodName}* sebagai Juara #${w.rank} dengan nomor undian *${w.ticket_code}*.${prize ? `\n\n🏆 Hadiah: ${prize}` : ""}\n\nSilakan hubungi kami untuk info klaim hadiah.\n\nSalam,\nTim Air OXLY`,
    }));
    const r = await broadcastWhatsApp(recipients);
    toast.show(`Broadcast: ${r.sent} terkirim · ${r.skipped} tanpa WA · ${r.failed} gagal`, r.failed > 0 ? "error" : "success");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Riwayat Pemenang</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={theme.color.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari nama / kode tiket / sales / periode"
          placeholderTextColor={theme.color.muted}
          style={styles.searchInput}
          testID="search-input"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} testID="clear-search-btn">
            <Ionicons name="close-circle" size={16} color={theme.color.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        {groupList.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={44} color={theme.color.muted} />
            <Text style={styles.emptyText}>
              {winners.length === 0
                ? "Belum ada undian yang di-draw"
                : "Tidak ada pemenang cocok pencarian"}
            </Text>
          </View>
        )}

        {groupList.map(([pid, g]) => {
          const eligibleCount = g.items.filter((w) => w.customer_wa).length;
          return (
            <View key={pid} style={styles.section}>
              <View style={styles.periodHead}>
                <Ionicons name="trophy" size={16} color="#B45309" />
                <Text style={styles.periodName}>{g.periodName}</Text>
                <Text style={styles.periodDate}>
                  {new Date(g.drawnAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </Text>
              </View>
              {g.prize ? <Text style={styles.prize}>🏆 {g.prize}</Text> : null}

              {canBroadcast && eligibleCount > 0 && (
                <TouchableOpacity
                  onPress={() => broadcastGroup(g.periodName, g.items, g.prize)}
                  style={styles.broadcastBtn}
                  testID={`broadcast-${pid}`}
                >
                  <Ionicons name="megaphone" size={14} color="#fff" />
                  <Text style={styles.broadcastText}>
                    Broadcast WA ke {eligibleCount} Pemenang
                  </Text>
                </TouchableOpacity>
              )}

              {g.items
                .sort((a, b) => a.rank - b.rank)
                .map((w) => (
                  <View key={w.ticket_code} style={styles.row}>
                    <View
                      style={[
                        styles.rankBadge,
                        w.rank === 1 && { backgroundColor: "#F59E0B" },
                        w.rank === 2 && { backgroundColor: "#9CA3AF" },
                        w.rank === 3 && { backgroundColor: "#B45309" },
                      ]}
                    >
                      <Text style={styles.rankText}>#{w.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{w.customer_name}</Text>
                      <Text style={styles.sub}>
                        {w.customer_no != null ? `No. ${w.customer_no} · ` : ""}Sales {w.sales_code || "-"}
                      </Text>
                      <Text style={styles.ticket}>{w.ticket_code}</Text>
                    </View>
                    {w.customer_wa ? (
                      <TouchableOpacity
                        onPress={() => sendWA(w)}
                        style={styles.waBtn}
                        testID={`wa-winner-${w.period_id}-${w.rank}`}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.waBtn, { backgroundColor: theme.color.border }]}>
                        <Ionicons name="ban-outline" size={14} color={theme.color.muted} />
                      </View>
                    )}
                  </View>
                ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  searchInput: { flex: 1, color: theme.color.onSurface, fontSize: 13 },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { color: theme.color.muted, textAlign: "center" },
  section: { marginBottom: 20 },
  periodHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  periodName: { fontSize: 14, fontWeight: "700", color: theme.color.onSurface, flex: 1 },
  periodDate: { fontSize: 11, color: theme.color.muted },
  prize: { fontSize: 12, color: "#B45309", fontStyle: "italic", marginBottom: 8, marginLeft: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 6,
    gap: 10,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  name: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface },
  sub: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  ticket: { fontSize: 12, fontWeight: "700", color: theme.color.brand, marginTop: 3, fontFamily: "monospace" },
  waBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  broadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#25D366",
    marginBottom: 8,
  },
  broadcastText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
