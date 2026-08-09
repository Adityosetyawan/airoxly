import React from "react";
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "@/src/theme";

/**
 * PhotoCapture — tombol foto realtime (kamera saja, tidak dari galeri).
 * Digunakan untuk foto nota, foto galon, dsb. Value = data URI base64 atau null.
 */
export function PhotoCapture({
  value,
  onChange,
  label,
  compact = false,
  testID,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  label: string;
  compact?: boolean;
  testID?: string;
}) {
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
        quality: 0.5,
        base64: true,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.back,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.base64) {
        onChange(`data:image/jpeg;base64,${a.base64}`);
      } else if (a.uri) {
        onChange(a.uri);
      }
    } catch (e: any) {
      Alert.alert("Kamera gagal", e?.message || "Coba lagi");
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
        <View style={styles.actions}>
          <Text style={styles.doneLabel} numberOfLines={1}>📷 {label}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={take} style={styles.iconBtn} testID={`${testID}-retake`}>
            <Ionicons name="camera" size={14} color={theme.color.brand} />
          </TouchableOpacity>
          <TouchableOpacity onPress={remove} style={[styles.iconBtn, { backgroundColor: "#fef2f2" }]} testID={`${testID}-remove`}>
            <Ionicons name="trash" size={14} color={theme.color.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={take} style={compact ? styles.compactEmpty : styles.empty} testID={testID}>
      <Ionicons name="camera" size={compact ? 20 : 24} color={theme.color.brand} />
      <Text style={compact ? styles.compactHint : styles.hint} numberOfLines={2}>{label}</Text>
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
    minHeight: 100,
  },
  hint: { color: theme.color.onBrandTertiary, fontSize: 11, fontWeight: "600", textAlign: "center" },
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
});
