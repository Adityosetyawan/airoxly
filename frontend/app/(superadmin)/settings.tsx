import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

export default function SuperSettings() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingRadius, setSavingRadius] = useState(false);
  const [savingGps, setSavingGps] = useState(false);
  const [radius, setRadius] = useState("100");
  const [gpsMin, setGpsMin] = useState("20");

  // Reset flows
  const [resetType, setResetType] = useState<null | "sales" | "all">(null);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, g] = await Promise.all([
        api.getSetting("visit_radius_m").catch(() => null),
        api.getSetting("gps_min_move_m").catch(() => null),
      ]);
      if (r?.value) setRadius(String(r.value));
      if (g?.value) setGpsMin(String(g.value));
    } catch (e: any) {
      toast.show(e.message || "Gagal memuat pengaturan", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRadius = async () => {
    const v = parseInt(radius, 10);
    if (!v || v < 10 || v > 5000) {
      toast.show("Radius harus 10 – 5000 m", "error");
      return;
    }
    setSavingRadius(true);
    try {
      await api.setSetting("visit_radius_m", v);
      toast.show("Radius kunjungan tersimpan", "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setSavingRadius(false);
    }
  };

  const saveGpsMin = async () => {
    const v = parseInt(gpsMin, 10);
    if (v < 0 || v > 500) {
      toast.show("Jarak minimum 0 – 500 m", "error");
      return;
    }
    setSavingGps(true);
    try {
      await api.setSetting("gps_min_move_m", v);
      toast.show("Filter GPS tersimpan", "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setSavingGps(false);
    }
  };

  const openReset = (type: "sales" | "all") => {
    setResetType(type);
    setConfirmText("");
  };

  const closeReset = () => {
    setResetType(null);
    setConfirmText("");
  };

  const performReset = async () => {
    if (!resetType) return;
    const expected = resetType === "sales" ? "RESET PENJUALAN" : "RESET SEMUA";
    if (confirmText.trim().toUpperCase() !== expected) {
      toast.show(`Konfirmasi harus persis: ${expected}`, "error");
      return;
    }
    setResetting(true);
    try {
      const res =
        resetType === "sales"
          ? await api.resetSalesData(confirmText.trim().toUpperCase())
          : await api.resetAllData(confirmText.trim().toUpperCase());
      const total = Object.values(res.reset || {}).reduce((a, b) => a + (b || 0), 0);
      toast.show(`Reset sukses. ${total} record dihapus.`, "success");
      closeReset();
    } catch (e: any) {
      toast.show(e.message || "Gagal reset", "error");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.color.brandPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="settings-back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Pengaturan Sistem</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Visit radius */}
        <Text style={styles.section}>Radius Kunjungan Pelanggan</Text>
        <Text style={styles.desc}>
          Pelanggan dianggap dikunjungi jika Sales berada dalam radius ini dari titik pelanggan.
          Default 100 meter. Semakin kecil, semakin ketat.
        </Text>
        <View style={styles.row}>
          <TextInput
            value={radius}
            onChangeText={(v) => setRadius(v.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            style={styles.input}
            testID="radius-input"
          />
          <Text style={styles.unit}>meter</Text>
        </View>
        <TouchableOpacity onPress={saveRadius} disabled={savingRadius} style={[styles.btn, savingRadius && { opacity: 0.6 }]} testID="save-radius-btn">
          <Text style={styles.btnText}>{savingRadius ? "Menyimpan…" : "Simpan Radius"}</Text>
        </TouchableOpacity>

        {/* GPS min move */}
        <Text style={styles.section}>Filter Noise GPS</Text>
        <Text style={styles.desc}>
          Titik GPS baru diabaikan jika jaraknya kurang dari nilai ini dari titik sebelumnya (dalam 5 menit terakhir).
          Ini membuat garis rute lebih halus dan hemat storage. Default 20 meter.
          Set 0 untuk menyimpan semua titik (tidak disarankan).
        </Text>
        <View style={styles.row}>
          <TextInput
            value={gpsMin}
            onChangeText={(v) => setGpsMin(v.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            style={styles.input}
            testID="gps-min-input"
          />
          <Text style={styles.unit}>meter</Text>
        </View>
        <TouchableOpacity onPress={saveGpsMin} disabled={savingGps} style={[styles.btn, savingGps && { opacity: 0.6 }]} testID="save-gps-btn">
          <Text style={styles.btnText}>{savingGps ? "Menyimpan…" : "Simpan Filter GPS"}</Text>
        </TouchableOpacity>

        {/* Danger zone */}
        <View style={styles.dangerBox}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning" size={20} color={theme.color.error} />
            <Text style={styles.dangerTitle}>Zona Berbahaya</Text>
          </View>
          <Text style={styles.dangerDesc}>
            Aksi berikut TIDAK BISA DIBATALKAN. Backup dulu sebelum menekan tombol.
          </Text>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Reset Data Penjualan?",
                "Ini akan menghapus SEMUA transaksi, pengeluaran, laporan bulanan, riwayat GPS, undian, dan input Produksi/Gudang. Data pelanggan & user TETAP tapi hutang & pembelian pelanggan direset ke 0.",
                [
                  { text: "Batal", style: "cancel" },
                  { text: "Lanjutkan", style: "destructive", onPress: () => openReset("sales") },
                ],
              )
            }
            style={styles.dangerBtn}
            testID="reset-sales-btn"
          >
            <Ionicons name="refresh-circle" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerBtnTitle}>Reset Data Penjualan Saja</Text>
              <Text style={styles.dangerBtnDesc}>Hapus transaksi, pengeluaran, GPS, undian, produksi & gudang. Pelanggan tetap.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Reset TOTAL Semua Data?",
                "PERINGATAN KERAS: ini menghapus SEMUA transaksi, pengeluaran, laporan, GPS, undian, produksi/gudang, DAN JUGA SEMUA DATA PELANGGAN. Hanya user, produk, dan pengaturan yang tersisa. Yakin?",
                [
                  { text: "Batal", style: "cancel" },
                  { text: "Ya, Reset Total", style: "destructive", onPress: () => openReset("all") },
                ],
              )
            }
            style={[styles.dangerBtn, { backgroundColor: "#7f1d1d" }]}
            testID="reset-all-btn"
          >
            <Ionicons name="trash-bin" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerBtnTitle}>Reset Total (Termasuk Pelanggan)</Text>
              <Text style={styles.dangerBtnDesc}>Hapus semua data termasuk data pelanggan. Hanya user & produk yang tersisa.</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={!!resetType} transparent animationType="fade" onRequestClose={closeReset}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}>
            <Ionicons name="alert-circle" size={40} color={theme.color.error} style={{ alignSelf: "center" }} />
            <Text style={styles.modalTitle}>
              Konfirmasi {resetType === "sales" ? "Reset Data Penjualan" : "Reset Total"}
            </Text>
            <Text style={styles.modalBody}>
              Ketik <Text style={{ fontWeight: "700", color: theme.color.error }}>
                {resetType === "sales" ? "RESET PENJUALAN" : "RESET SEMUA"}
              </Text> di bawah untuk melanjutkan. Tindakan ini tidak dapat dibatalkan.
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={resetType === "sales" ? "RESET PENJUALAN" : "RESET SEMUA"}
              placeholderTextColor={theme.color.muted}
              autoCapitalize="characters"
              style={styles.modalInput}
              testID="reset-confirm-input"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={closeReset} style={[styles.modalBtn, { backgroundColor: theme.color.surfaceSecondary }]} testID="reset-cancel-btn">
                <Text style={{ color: theme.color.onSurface, fontWeight: "600" }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={performReset}
                disabled={resetting}
                style={[styles.modalBtn, { backgroundColor: theme.color.error, opacity: resetting ? 0.6 : 1 }]}
                testID="reset-confirm-btn"
              >
                {resetting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>RESET</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  section: { fontSize: 15, fontWeight: "700", color: theme.color.onSurface, marginTop: 8, marginBottom: 4 },
  desc: { fontSize: 12, color: theme.color.muted, marginBottom: 12, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: "600",
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  unit: { fontSize: 14, color: theme.color.muted, fontWeight: "500" },
  btn: {
    backgroundColor: theme.color.brandPrimary,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  dangerBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.color.error,
    padding: 16,
    backgroundColor: "#FEF2F2",
  },
  dangerHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  dangerTitle: { fontSize: 15, fontWeight: "700", color: theme.color.error },
  dangerDesc: { fontSize: 12, color: "#7f1d1d", marginBottom: 12, lineHeight: 18 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.error,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  dangerBtnTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  dangerBtnDesc: { color: "#fecaca", fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: theme.color.surface, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: theme.color.onSurface, textAlign: "center", marginTop: 8 },
  modalBody: { fontSize: 13, color: theme.color.onSurfaceSecondary, marginTop: 8, marginBottom: 16, lineHeight: 20, textAlign: "center" },
  modalInput: {
    borderWidth: 2,
    borderColor: theme.color.error,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: "700",
    color: theme.color.error,
    backgroundColor: "#fff",
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: "center",
  },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
});
