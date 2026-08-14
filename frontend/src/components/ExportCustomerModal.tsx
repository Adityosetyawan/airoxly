import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** If provided, sales selector is hidden. Used when a specific sales context. */
  fixedSalesId?: string;
  /** Optional list of Sales users the caller can export (for Admin/SuperAdmin picker). */
  salesOptions?: { id: string; code?: string; name?: string; group_letter?: string }[];
};

/**
 * A modal that lets Sales/Admin/SuperAdmin download a PDF of customer data
 * filtered by customer_no range (per sales). Renders a live preview count so
 * users don't waste time downloading an empty PDF.
 */
export default function ExportCustomerModal({
  visible,
  onClose,
  fixedSalesId,
  salesOptions,
}: Props) {
  const toast = useToast();
  const [salesId, setSalesId] = useState<string | undefined>(fixedSalesId ?? salesOptions?.[0]?.id);
  const [fromNo, setFromNo] = useState("1");
  const [toNo, setToNo] = useState("9999");
  const [preview, setPreview] = useState<{
    total_customers: number;
    min_no: number;
    max_no: number;
    in_range: number;
    sales_code: string;
    sales_name?: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (fixedSalesId) setSalesId(fixedSalesId);
    else if (!salesId && salesOptions?.[0]?.id) setSalesId(salesOptions[0].id);
  }, [fixedSalesId, salesOptions, salesId]);

  const from = Math.max(1, parseInt(fromNo || "1", 10) || 1);
  const to = Math.max(from, parseInt(toNo || "9999", 10) || 9999);

  const loadPreview = useCallback(async () => {
    if (!visible) return;
    setLoadingPreview(true);
    try {
      const p = await api.previewCustomerExport({
        sales_id: fixedSalesId ?? salesId,
        from_no: from,
        to_no: to,
      });
      setPreview(p);
    } catch (e: any) {
      setPreview(null);
      // silent — sales without sales_id gets prompted differently; toast if it's a real error
      if (e?.message && !e.message.includes("sales_id wajib")) {
        toast.show(e.message, "error");
      }
    } finally {
      setLoadingPreview(false);
    }
  }, [visible, fixedSalesId, salesId, from, to, toast]);

  useEffect(() => {
    const t = setTimeout(loadPreview, 300);
    return () => clearTimeout(t);
  }, [loadPreview]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await api.downloadCustomerPDF({
        sales_id: fixedSalesId ?? salesId,
        from_no: from,
        to_no: to,
      });
      const filename = `Pelanggan_${preview?.sales_code || "sales"}_${from}-${to}.pdf`;
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
        toast.show("PDF berhasil diunduh", "success");
        onClose();
      } else {
        // Native: convert blob → base64 → save via expo-file-system + share
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = (reader.result as string).split(",")[1];
            const FileSystem = await import("expo-file-system");
            const Sharing = await import("expo-sharing");
            const uri = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Ekspor Data Pelanggan" });
            } else {
              toast.show(`PDF tersimpan: ${uri}`, "success");
            }
            toast.show("PDF siap dibagikan", "success");
            onClose();
          } catch (err: any) {
            toast.show(err?.message || "Gagal simpan PDF", "error");
          } finally {
            setDownloading(false);
          }
        };
        reader.readAsDataURL(blob);
        return; // native handles setDownloading in reader.onloadend
      }
    } catch (e: any) {
      toast.show(e?.message || "Gagal unduh PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  const salesLabel = useMemo(() => {
    const opt = salesOptions?.find((o) => o.id === salesId);
    if (opt) return `${opt.code || "?"} — ${opt.name || ""}`;
    return preview ? `${preview.sales_code}${preview.sales_name ? " — " + preview.sales_name : ""}` : "";
  }, [salesOptions, salesId, preview]);

  const rangeInfo = preview
    ? `Range aktual: #${preview.min_no}–#${preview.max_no} · Total ${preview.total_customers} pelanggan`
    : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="document-text" size={22} color={theme.color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Export Data Pelanggan</Text>
              <Text style={styles.subtitle}>PDF · Pilih rentang nomor urut pelanggan</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.color.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16 }}>
            {salesOptions && salesOptions.length > 0 && !fixedSalesId ? (
              <>
                <Text style={styles.label}>Pilih Sales</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {salesOptions.map((s) => {
                      const active = s.id === salesId;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.salesChip, active && styles.salesChipActive]}
                          onPress={() => setSalesId(s.id)}
                        >
                          <Text style={[styles.salesChipText, active && styles.salesChipTextActive]}>
                            {s.code || "?"}
                          </Text>
                          {s.name ? (
                            <Text style={[styles.salesChipSubtext, active && { color: "#fff" }]} numberOfLines={1}>
                              {s.name}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : (
              salesLabel ? (
                <View style={styles.salesBadge}>
                  <Ionicons name="person" size={14} color={theme.color.brand} />
                  <Text style={styles.salesBadgeText}>{salesLabel}</Text>
                </View>
              ) : null
            )}

            <Text style={styles.label}>Rentang Nomor Urut Pelanggan</Text>
            <View style={styles.rangeRow}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Dari #</Text>
                <TextInput
                  style={styles.input}
                  value={fromNo}
                  onChangeText={setFromNo}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={theme.color.muted}
                  testID="from-no-input"
                />
              </View>
              <Ionicons name="arrow-forward" size={18} color={theme.color.muted} />
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Sampai #</Text>
                <TextInput
                  style={styles.input}
                  value={toNo}
                  onChangeText={setToNo}
                  keyboardType="number-pad"
                  placeholder="9999"
                  placeholderTextColor={theme.color.muted}
                  testID="to-no-input"
                />
              </View>
            </View>

            {/* Quick presets */}
            <View style={styles.presets}>
              {[
                { label: "Semua", from: 1, to: 9999 },
                { label: "1–20", from: 1, to: 20 },
                { label: "21–50", from: 21, to: 50 },
                { label: "51–100", from: 51, to: 100 },
              ].map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={styles.presetBtn}
                  onPress={() => {
                    setFromNo(String(p.from));
                    setToNo(String(p.to));
                  }}
                >
                  <Text style={styles.presetText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.previewBox}>
              {loadingPreview ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color={theme.color.brand} />
                  <Text style={styles.previewText}>Menghitung...</Text>
                </View>
              ) : preview ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="people" size={18} color={theme.color.brand} />
                    <Text style={styles.previewBig}>
                      {preview.in_range}
                      <Text style={styles.previewSmall}> pelanggan akan di-export</Text>
                    </Text>
                  </View>
                  <Text style={styles.previewMeta}>{rangeInfo}</Text>
                </>
              ) : (
                <Text style={styles.previewText}>Pilih sales & rentang nomor</Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={downloading}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dlBtn, (downloading || (preview?.in_range || 0) === 0) && { opacity: 0.55 }]}
              onPress={handleDownload}
              disabled={downloading || (preview?.in_range || 0) === 0}
              testID="download-pdf-btn"
            >
              {downloading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.dlBtnText}>Menyiapkan PDF…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.dlBtnText}>Unduh PDF</Text>
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
    maxWidth: 460,
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
    backgroundColor: theme.color.brandContainer || "rgba(15,118,110,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: theme.color.onSurface },
  subtitle: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface, marginBottom: 8 },
  salesChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    minWidth: 90,
  },
  salesChipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  salesChipText: { fontSize: 12, fontWeight: "700", color: theme.color.onSurface },
  salesChipTextActive: { color: "#fff" },
  salesChipSubtext: { fontSize: 10, color: theme.color.muted, marginTop: 2 },
  salesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(15,118,110,0.08)",
    marginBottom: 14,
  },
  salesBadgeText: { fontSize: 12, fontWeight: "700", color: theme.color.brand },
  rangeRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 10 },
  inputWrap: { flex: 1 },
  inputLabel: { fontSize: 10, color: theme.color.muted, marginBottom: 4, textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceContainer || theme.color.surface,
    fontWeight: "700",
  },
  presets: { flexDirection: "row", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  presetText: { fontSize: 11, color: theme.color.onSurface, fontWeight: "600" },
  previewBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,118,110,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.15)",
    gap: 4,
  },
  previewText: { fontSize: 13, color: theme.color.muted },
  previewBig: { fontSize: 18, fontWeight: "800", color: theme.color.brand },
  previewSmall: { fontSize: 13, fontWeight: "600", color: theme.color.onSurface },
  previewMeta: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
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
