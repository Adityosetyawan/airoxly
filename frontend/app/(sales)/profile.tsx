import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useToast } from "@/src/components/Toast";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);
  const [loc, setLoc] = useState<Location.LocationObject | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.overview();
      setStats(s);
    } catch {}
  }, []);

  const grabLocation = useCallback(async () => {
    try {
      let p = await Location.getForegroundPermissionsAsync();
      if (p.status !== "granted") {
        p = await Location.requestForegroundPermissionsAsync();
      }
      if (p.status !== "granted") {
        toast.show("Izin lokasi ditolak. Buka Settings untuk mengaktifkan.", "error");
        return;
      }
      const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLoc(l);
      await api.pingLocation(l.coords.latitude, l.coords.longitude);
      toast.show("Lokasi diperbarui", "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal ambil lokasi", "error");
    }
  }, [toast]);

  useEffect(() => {
    load();
    grabLocation();
  }, [load, grabLocation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), grabLocation()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.brandPrimary} />}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.sales_code || user?.username || "?")[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name || user?.username}</Text>
        <Text style={styles.role}>{user?.sales_code} · Group {user?.group_letter || "-"}</Text>

        <View style={styles.card}>
          <Row label="Username" value={user?.username || "-"} />
          <Row label="No WhatsApp" value={user?.wa_number || "-"} />
          <Row label="Alamat" value={user?.address || "-"} />
          <Row label="Tahun Masuk" value={String(user?.year_joined || "-")} />
          <Row label="Gaji" value={"Rp " + rp(user?.salary || 0)} />
          <Row label="Komisi" value={"Rp " + rp(user?.commission || 0)} />
          <Row label="Bonus" value={"Rp " + rp(user?.bonus || 0)} />
        </View>

        <Text style={styles.section}>Statistik</Text>
        <View style={styles.statRow}>
          <StatCard label="Total Pelanggan" value={String(stats?.total_customers || 0)} icon="people" />
          <StatCard label="Total Transaksi" value={String(stats?.total_transactions || 0)} icon="receipt" />
        </View>

        <Text style={styles.section}>Lokasi Saat Ini (GPS)</Text>
        <View style={styles.locCard}>
          <Ionicons name="location" size={20} color={theme.color.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.locTitle}>
              {loc ? `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}` : "Belum tersedia"}
            </Text>
            <Text style={styles.locSub}>
              {loc ? `Akurasi ${loc.coords.accuracy?.toFixed(0) || 0} m · terkirim otomatis tiap 60s` : "Tekan refresh untuk kirim manual"}
            </Text>
          </View>
          <TouchableOpacity onPress={grabLocation} testID="refresh-location-btn" style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color={theme.color.brand} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-btn">
          <Ionicons name="log-out-outline" size={20} color={theme.color.error} />
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={theme.color.brand} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.color.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 8,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface, textAlign: "center", marginTop: 12 },
  role: { fontSize: 13, color: theme.color.muted, textAlign: "center", marginBottom: 20 },
  card: { borderWidth: 1, borderColor: theme.color.border, borderRadius: 14, padding: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: theme.color.muted },
  rowValue: { fontSize: 14, color: theme.color.onSurface, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  section: { fontSize: 14, fontWeight: "600", color: theme.color.onSurface, marginTop: 20, marginBottom: 8 },
  statRow: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.color.surfaceSecondary,
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: "600", color: theme.color.onSurface },
  statLabel: { fontSize: 12, color: theme.color.muted },
  locCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.color.brandTertiary,
    gap: 12,
  },
  locTitle: { fontSize: 14, fontWeight: "600", color: theme.color.onBrandTertiary },
  locSub: { fontSize: 11, color: theme.color.onBrandTertiary, marginTop: 2 },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fff" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.error,
    marginTop: 24,
  },
  logoutText: { color: theme.color.error, fontWeight: "600" },
});
