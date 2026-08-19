import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type CollInfo = { name: string; count: number };

/**
 * Superadmin-only manual full-database backup.
 * Downloads a ZIP containing one CSV per collection.
 */
export default function BackupExportModal({ visible, onClose }: Props) {
  const toast = useToast();
  const [preview, setPreview] = useState<{
    collections: CollInfo[];
    total_rows: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.previewBackup();
      setPreview(p);
    } catch (e: any) {
      toast.show(e?.message || "Gagal memuat ringkasan backup", "error");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await api.downloadFullBackup();

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 500);
        toast.show("Backup ZIP tersimpan", "success");
        onClose();
        return;
      }

      // Native: blob → base64 → file-system + share
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const FileSystem = await import("expo-file-system");
          const Sharing = await import("expo-sharing");
          const uri = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(uri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: "application/zip",
              dialogTitle: "Backup Air OXLY",
            });
            toast.show("Backup siap dibagikan", "success");
          } else {
            toast.show(`Backup tersimpan: ${uri}`, "success");
          }
          onClose();
        } catch (err: any) {
          toast.show(err?.message || "Gagal simpan backup", "error");
        } finally {
          setDownloading(false);
        }
      };
      reader.readAsDataURL(blob);
      return; // native path finishes in reader.onloadend
    } catch (e: any) {
      toast.show(e?.message || "Gagal unduh backup", "error");
    } finally {
      if (Platform.OS === "web") setDownloading(false);
    }
  };

  const total = preview?.total_rows ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="cloud-download" size={22} color={theme.color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Backup Semua Data</Text>
              <Text style={styles.subtitle}>Export ZIP · CSV per koleksi</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.color.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16 }}>
            <View style={styles.summaryBox}>
              <Ionicons name="archive" size={20} color={theme.color.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryBig}>
                  {loading ? "…" : total.toLocaleString("id-ID")}
                  <Text style={styles.summarySmall}> total baris data</Text>
                </Text>
                <Text style={styles.summaryMeta}>
                  {loading
                    ? "Menghitung koleksi…"
                    : `${preview?.collections.length || 0} koleksi akan diekspor`}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Rincian Koleksi</Text>
            {loading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator color={theme.color.brand} />
              </View>
            ) : (
              (preview?.collections || []).map((c) => (
                <View key={c.name} style={styles.row}>
                  <Ionicons
                    name={c.count > 0 ? "checkmark-circle" : "remove-circle-outline"}
                    size={16}
                    color={c.count > 0 ? theme.color.success : theme.color.muted}
                  />
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowCount}>{c.count.toLocaleString("id-ID")}</Text>
                </View>
              ))
            )}

            <View style={styles.tipBox}>
              <Ionicons name="information-circle" size={16} color={theme.color.brand} />
              <Text style={styles.tipText}>
                CSV memakai UTF-8 (dengan BOM), buka langsung di Excel/Google Sheets.
                Field password & internal ID tidak diekspor.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={downloading}
            >
              <Text style={styles.cancelBtnText}>Tutup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dlBtn, (downloading || total === 0) && { opacity: 0.55 }]}
              onPress={handleDownload}
              disabled={downloading || total === 0}
              testID="download-backup-btn"
            >
              {downloading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.dlBtnText}>Menyiapkan ZIP…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.dlBtnText}>Unduh Backup (ZIP)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: theme.color.surface,
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: (theme.color as any).brandContainer || "rgba(15,118,110,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: theme.color.onSurface },
  subtitle: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  summaryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,118,110,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.15)",
    marginBottom: 16,
  },
  summaryBig: { fontSize: 20, fontWeight: "800", color: theme.color.brand },
  summarySmall: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  summaryMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  label: {
    fontSize: 12, fontWeight: "700", color: theme.color.onSurface,
    marginBottom: 8, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 6,
    backgroundColor: theme.color.surfaceSecondary,
  },
  rowName: { flex: 1, fontSize: 13, color: theme.color.onSurface, fontWeight: "600" },
  rowCount: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.color.brand,
    fontVariant: ["tabular-nums"],
  },
  tipBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    backgroundColor: (theme.color as any).surfaceContainer || theme.color.surfaceSecondary,
    marginTop: 12,
  },
  tipText: { flex: 1, fontSize: 11, color: theme.color.muted, lineHeight: 16 },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
  },
  cancelBtnText: { color: theme.color.onSurface, fontWeight: "600" },
  dlBtn: {
    flex: 2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.color.brand,
  },
  dlBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
