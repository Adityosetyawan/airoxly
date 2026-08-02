import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

export default function Scan() {
  const [perm, requestPerm] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const c = await api.lookupCustomer(data);
      toast.show(`Ditemukan: ${c.name}`, "success");
      router.replace({ pathname: "/(sales)/customer/[id]", params: { id: c.id, action: "transact" } });
    } catch (e: any) {
      // If not found, offer to create new customer with this barcode
      toast.show(e.message || "Pelanggan tidak ditemukan", "error");
      router.replace({ pathname: "/(sales)/customer/new", params: { barcode: data } });
    } finally {
      setTimeout(() => setScanned(false), 1500);
    }
  };

  const startScan = async () => {
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) {
        toast.show("Butuh izin kamera untuk scan barcode", "error");
        return;
      }
    }
    setScanning(true);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      {scanning ? (
        <View style={styles.camWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
            }}
          />
          <View style={styles.overlay}>
            <View style={styles.scanBox} />
            <Text style={styles.scanText}>Arahkan ke barcode / QR pelanggan</Text>
            <TouchableOpacity
              onPress={() => setScanning(false)}
              style={styles.cancelBtn}
              testID="cancel-scan-btn"
            >
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.heroCircle}>
            <Ionicons name="qr-code" size={72} color={theme.color.brandPrimary} />
          </View>
          <Text style={styles.title}>Scan / Pelanggan Baru</Text>
          <Text style={styles.sub}>
            Scan barcode/QR yang tertempel pada pelanggan, atau input manual untuk pelanggan baru.
          </Text>

          <TouchableOpacity onPress={startScan} style={styles.btn} testID="start-scan-btn">
            <Ionicons name="scan" size={20} color="#fff" />
            <Text style={styles.btnText}>Scan Barcode / QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(sales)/customer/new")}
            style={styles.btnGhost}
            testID="add-manual-btn"
          >
            <Ionicons name="person-add-outline" size={20} color={theme.color.brand} />
            <Text style={styles.btnGhostText}>Tambah Pelanggan Manual</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(sales)/customers")}
            style={styles.linkBtn}
            testID="browse-customers-btn"
          >
            <Text style={styles.link}>atau pilih dari daftar pelanggan →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  heroCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "600", color: theme.color.onSurface, marginBottom: 8 },
  sub: { fontSize: 14, color: theme.color.muted, textAlign: "center", marginBottom: 32, lineHeight: 20 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.color.brandPrimary,
    width: "100%",
    marginBottom: 12,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
    width: "100%",
  },
  btnGhostText: { color: theme.color.brand, fontWeight: "600", fontSize: 16 },
  linkBtn: { marginTop: 16 },
  link: { color: theme.color.muted, fontSize: 13 },
  camWrap: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scanBox: {
    width: 260,
    height: 260,
    borderColor: theme.color.brandSecondary,
    borderWidth: 3,
    borderRadius: 24,
  },
  scanText: { color: "#fff", marginTop: 24, fontSize: 14 },
  cancelBtn: {
    position: "absolute",
    bottom: 60,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  cancelText: { fontWeight: "600", color: "#000" },
});
