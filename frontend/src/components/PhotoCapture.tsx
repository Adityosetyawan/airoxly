import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "@/src/theme";
import { addWatermarkTimestamp } from "@/src/utils/watermark";
import { compressPhoto } from "@/src/utils/imageCompress";
import { api } from "@/src/api";

/**
 * Global kill-switch untuk AI auto-count galon.
 *
 * Disetel `false` per Aug 2026 sesuai instruksi user: akurasi AI belum
 * cukup untuk kondisi lapangan, sehingga penghitungan dilakukan MANUAL
 * oleh petugas (Gudang / Produksi). Foto tetap disimpan (bukti visual);
 * hanya panggilan AI yang dinonaktifkan.
 *
 * Untuk mengaktifkan kembali di masa depan: ubah ke `true` dan tidak
 * perlu menyentuh call-site lain — semua PhotoCapture yang punya prop
 * `aiCount` akan otomatis kembali menghitung.
 */
export const AI_COUNT_ENABLED = false;

/**
 * PhotoCapture — tombol foto realtime (kamera saja, tidak dari galeri).
 * Digunakan untuk foto nota, foto galon, dsb. Value = data URI base64 atau null.
 *
 * Opsional:
 *   - watermark: true → auto stamp tanggal+jam di kanan bawah foto
 *   - aiCount: true → setelah foto, panggil GPT-5 vision & callback onAICount(count, confidence)
 *   - hintForAI: konteks singkat untuk AI (mis "galon kosong", "galon isi")
 */
export function PhotoCapture({
  value,
  onChange,
  label,
  compact = false,
  testID,
  watermark = false,
  aiCount = false,
  hintForAI,
  onAICount,
  onAIError,
  caption,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  label: string;
  compact?: boolean;
  testID?: string;
  watermark?: boolean;
  aiCount?: boolean;
  hintForAI?: string;
  onAICount?: (count: number, confidence: "low" | "medium" | "high", reasoning: string) => void;
  onAIError?: (msg: string) => void;
  caption?: React.ReactNode;
}) {
  const [processing, setProcessing] = useState(false);

  const take = async () => {
    try {
      let perm = await ImagePicker.getCameraPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert(
            "Izin Kamera Diblokir",
            "Buka Pengaturan → Izin → Kamera untuk mengaktifkan",
            [{ text: "Batal", style: "cancel" }, { text: "Buka Pengaturan", onPress: () => Linking.openSettings() }],
          );
          return;
        }
        perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.55,
        base64: true,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.back,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      let dataUri: string | null = null;
      if (a.base64) dataUri = `data:image/jpeg;base64,${a.base64}`;
      else if (a.uri) dataUri = a.uri;
      if (!dataUri) return;

      setProcessing(true);
      // Kompres foto (max 1024px, JPEG q=0.5) supaya DB + backup lebih ringan
      try {
        const compressed = await compressPhoto(dataUri);
        if (compressed) dataUri = compressed;
      } catch { /* fail-open: pakai foto asli kalau kompres gagal */ }
      // Watermark timestamp jika diminta
      if (watermark) {
        try {
          dataUri = await addWatermarkTimestamp(dataUri, label);
        } catch { /* fallback: gunakan foto tanpa watermark */ }
      }
      onChange(dataUri);

      // AI count — dinonaktifkan global via AI_COUNT_ENABLED (lihat atas file).
      // Foto tetap disimpan; petugas mengisi angka manual pakai stepper +/−.
      if (AI_COUNT_ENABLED && aiCount && onAICount) {
        try {
          const r = await api.aiCountGallons(dataUri, hintForAI || label);
          if (r.annotated_image_base64) {
            onChange(`data:image/jpeg;base64,${r.annotated_image_base64}`);
          }
          onAICount(r.count, r.confidence, r.reasoning);
        } catch (e: any) {
          const msg = e?.message || "Gagal hitung AI";
          if (onAIError) onAIError(msg);
          else Alert.alert("AI gagal menghitung", msg + " — coba manual saja");
        }
      }
    } catch (e: any) {
      Alert.alert("Kamera gagal", e?.message || "Coba lagi");
    } finally {
      setProcessing(false);
    }
  };

  const remove = () => {
    Alert.alert("Hapus foto?", `Foto ${label.toLowerCase()} akan dihapus`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: () => onChange(null) },
    ]);
  };

  if (value) {
    return (
      <View style={compact ? styles.compactWrap : styles.wrap}>
        <Image source={{ uri: value }} style={compact ? styles.compactImg : styles.img} resizeMode="cover" />
        {caption ? (
          <View style={styles.captionBox}>
            {typeof caption === "string" ? (
              <Text style={styles.captionText} numberOfLines={3}>{caption}</Text>
            ) : caption}
          </View>
        ) : null}
        <View style={styles.actions}>
          <Text style={styles.doneLabel} numberOfLines={1}>📷 {label}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={take} style={styles.iconBtn} testID={`${testID}-retake`} disabled={processing}>
            {processing ? <ActivityIndicator size="small" color={theme.color.brand} /> : <Ionicons name="camera" size={14} color={theme.color.brand} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={remove} style={[styles.iconBtn, { backgroundColor: "#fef2f2" }]} testID={`${testID}-remove`} disabled={processing}>
            <Ionicons name="trash" size={14} color={theme.color.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={take} style={compact ? styles.compactEmpty : styles.empty} testID={testID} disabled={processing}>
      {processing ? (
        <ActivityIndicator color={theme.color.brand} />
      ) : (
        <>
          <Ionicons name="camera" size={compact ? 20 : 24} color={theme.color.brand} />
          <Text style={compact ? styles.compactHint : styles.hint} numberOfLines={2}>{label}</Text>
          {watermark ? (
            <View style={styles.badgeRow}>
              <Ionicons name="calendar-outline" size={10} color={theme.color.onBrandTertiary} style={{ opacity: 0.75 }} />
              <Text style={styles.badge}>auto-stempel</Text>
            </View>
          ) : null}
          {aiCount ? (
            <View style={styles.badgeRow}>
              <Ionicons name="sparkles-outline" size={10} color={theme.color.onBrandTertiary} style={{ opacity: 0.75 }} />
              <Text style={styles.badge}>AI hitung otomatis</Text>
            </View>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  img: { width: "100%", height: 140 },
  empty: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.brandPrimary,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 110,
  },
  hint: { color: theme.color.onBrandTertiary, fontSize: 11, fontWeight: "600", textAlign: "center" },
  badge: { fontSize: 9, color: theme.color.onBrandTertiary, opacity: 0.75 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6, backgroundColor: "#fff" },
  doneLabel: { fontSize: 10, fontWeight: "600", color: theme.color.brand, flexShrink: 1 },
  iconBtn: { padding: 6, borderRadius: 6, backgroundColor: theme.color.brandTertiary },
  compactWrap: { borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: theme.color.border, backgroundColor: "#fff" },
  compactImg: { width: "100%", height: 80 },
  compactEmpty: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.brandPrimary,
    backgroundColor: theme.color.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 60,
  },
  compactHint: { color: theme.color.onBrandTertiary, fontSize: 10, fontWeight: "600", textAlign: "center" },
  captionBox: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: theme.color.brandTertiary,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  captionText: {
    fontSize: 11,
    color: theme.color.onBrandTertiary,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
  },
});
