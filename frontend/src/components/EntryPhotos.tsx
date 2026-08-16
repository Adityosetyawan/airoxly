import React, { useState } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

/**
 * Strip foto galon dari 1 entry Produksi / Gudang.
 *
 * Menampilkan thumbnail masing-masing foto (biasanya 2 untuk produksi,
 * 4 untuk gudang) berdampingan. Tap salah satu → modal fullscreen zoom.
 *
 * Aman-null: jika sebuah `photo` bernilai kosong / null, slot itu dilewati
 * (tidak me-render kotak kosong). Kalau SEMUA slot kosong → komponen
 * mengembalikan null (tidak render apa-apa) supaya card tidak jadi longgar.
 */
export type PhotoSlot = { key: string; label: string; uri?: string | null };

export function EntryPhotos({
  slots,
  hint,
  compact = false,
}: {
  slots: PhotoSlot[];
  hint?: string;
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState<{ uri: string; label: string } | null>(null);
  const visible = slots.filter((s) => !!s.uri);
  if (visible.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={[styles.row, compact && { gap: 6 }]}>
        {visible.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.box, compact && styles.boxCompact]}
            onPress={() => setZoom({ uri: s.uri!, label: s.label })}
            testID={`entry-photo-${s.key}`}
          >
            <Image source={{ uri: s.uri! }} style={styles.img} resizeMode="cover" />
            <View style={styles.labelOverlay}>
              <Text style={styles.labelText} numberOfLines={1}>{s.label}</Text>
            </View>
            <View style={styles.zoomIcon}>
              <Ionicons name="expand" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={!!zoom}
        transparent
        animationType="fade"
        onRequestClose={() => setZoom(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setZoom(null)}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayTitle} numberOfLines={1}>
              {zoom?.label || "Foto"}
            </Text>
            <TouchableOpacity
              onPress={() => setZoom(null)}
              style={styles.closeBtn}
              testID="close-photo-zoom"
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {zoom ? (
            <Image
              source={{ uri: zoom.uri }}
              style={styles.zoomImg}
              resizeMode="contain"
            />
          ) : null}
          <Text style={styles.overlayHint}>Ketuk area gelap untuk menutup</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  hint: { fontSize: 10, color: theme.color.muted, marginBottom: 4, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  box: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.border,
    position: "relative",
  },
  boxCompact: { width: 68, height: 68 },
  img: { width: "100%", height: "100%" },
  labelOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  labelText: { color: "#fff", fontSize: 9, fontWeight: "700", textAlign: "center" },
  zoomIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    padding: 3,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "700" },
  closeBtn: { padding: 6 },
  zoomImg: { width: "100%", height: "80%" },
  overlayHint: {
    position: "absolute",
    bottom: 24,
    color: "#fff9",
    fontSize: 11,
  },
});

/** Preset slots untuk entry Produksi. */
export function makeProductionSlots(entry: any): PhotoSlot[] {
  return [
    { key: "before", label: "Sebelum diisi", uri: entry?.photo_before },
    { key: "after", label: "Setelah diisi", uri: entry?.photo_after },
  ];
}

/** Preset slots untuk entry Gudang. */
export function makeWarehouseSlots(entry: any): PhotoSlot[] {
  return [
    { key: "isi_pagi", label: "Isi Pagi", uri: entry?.photo_isi_pagi },
    { key: "isi_siang", label: "Isi Siang", uri: entry?.photo_isi_siang },
    { key: "kosong_siang", label: "Galon Siang", uri: entry?.photo_kosong_siang },
    { key: "kosong_sore", label: "Galon Sore", uri: entry?.photo_kosong_sore },
  ];
}
