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
import BackupExportModal from "@/src/components/BackupExportModal";

export default function SuperSettings() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingRadius, setSavingRadius] = useState(false);
  const [savingGps, setSavingGps] = useState(false);
  const [radius, setRadius] = useState("100");
  const [gpsMin, setGpsMin] = useState("20");
  const [lotteryMin, setLotteryMin] = useState("11000");
  const [savingLottery, setSavingLottery] = useState(false);
  const [shifts, setShifts] = useState<{ key: string; label: string; order?: number }[]>([]);
  const [savingShifts, setSavingShifts] = useState(false);

  // Part prices (Biaya Penggantian Part)
  const [parts, setParts] = useState<{ id: string; name: string; rp_per_pcs: number; order?: number }[]>([]);
  const [savingPart, setSavingPart] = useState<string | null>(null);
  const [newPart, setNewPart] = useState({ name: "", rp: "" });

  // Reset flows
  const [resetType, setResetType] = useState<null | "sales" | "all">(null);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, g, sh, pp, lot] = await Promise.all([
        api.getSetting("visit_radius_m").catch(() => null),
        api.getSetting("gps_min_move_m").catch(() => null),
        api.getShifts().catch(() => null),
        api.listPartPrices().catch(() => null),
        api.getSetting("lottery_min_price_per_galon").catch(() => null),
      ]);
      if (r?.value) setRadius(String(r.value));
      if (g?.value) setGpsMin(String(g.value));
      if (sh?.shifts) setShifts(sh.shifts);
      if (Array.isArray(pp)) {
        const sorted = [...pp].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        setParts(sorted);
      }
      if (lot?.value != null) setLotteryMin(String(lot.value));
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

  const saveLotteryMin = async () => {
    const v = parseInt(lotteryMin, 10);
    if (isNaN(v) || v < 0 || v > 1_000_000) {
      toast.show("Harga minimum harus 0 – 1.000.000", "error");
      return;
    }
    setSavingLottery(true);
    try {
      await api.setSetting("lottery_min_price_per_galon", v);
      toast.show("Harga minimum kupon tersimpan", "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setSavingLottery(false);
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

  const savePart = async (id: string, patch: { name?: string; rp_per_pcs?: number; order?: number }) => {
    const target = parts.find((p) => p.id === id);
    if (!target) return;
    setSavingPart(id);
    try {
      const body = {
        name: patch.name ?? target.name,
        rp_per_pcs: patch.rp_per_pcs !== undefined ? patch.rp_per_pcs : Number(target.rp_per_pcs || 0),
        order: patch.order !== undefined ? patch.order : (target.order || 0),
      };
      const updated = await api.updatePartPrice(id, body);
      setParts((arr) => arr.map((p) => (p.id === id ? { ...p, ...(updated || body) } : p)));
      toast.show(`Part "${body.name}" tersimpan`, "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan part", "error");
    } finally {
      setSavingPart(null);
    }
  };

  const deletePart = async (id: string) => {
    const target = parts.find((p) => p.id === id);
    if (!target) return;
    Alert.alert(
      "Hapus Item Part?",
      `Item "${target.name}" akan dihapus dari daftar Biaya Penggantian Part. Input Produksi & Gudang tidak akan menampilkannya lagi.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            setSavingPart(id);
            try {
              await api.deletePartPrice(id);
              setParts((arr) => arr.filter((p) => p.id !== id));
              toast.show(`Part "${target.name}" dihapus`, "success");
            } catch (e: any) {
              toast.show(e.message || "Gagal hapus", "error");
            } finally {
              setSavingPart(null);
            }
          },
        },
      ],
    );
  };

  const addPart = async () => {
    const name = newPart.name.trim();
    const rp = parseInt(newPart.rp || "0", 10) || 0;
    if (!name) { toast.show("Nama part wajib diisi", "error"); return; }
    setSavingPart("__new__");
    try {
      const created = await api.createPartPrice({ name, rp_per_pcs: rp, order: parts.length + 1 });
      setParts((arr) => [...arr, created]);
      setNewPart({ name: "", rp: "" });
      toast.show(`Part "${name}" ditambahkan`, "success");
    } catch (e: any) {
      toast.show(e.message || "Gagal tambah part", "error");
    } finally {
      setSavingPart(null);
    }
  };

  const movePart = async (id: string, direction: -1 | 1) => {
    const idx = parts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= parts.length) return;
    const arr = [...parts];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    // Reassign order numbers
    const reordered = arr.map((p, i) => ({ ...p, order: i + 1 }));
    setParts(reordered);
    // Persist both moved items
    try {
      await Promise.all([
        api.updatePartPrice(arr[idx].id, { name: arr[idx].name, rp_per_pcs: arr[idx].rp_per_pcs, order: idx + 1 }),
        api.updatePartPrice(arr[newIdx].id, { name: arr[newIdx].name, rp_per_pcs: arr[newIdx].rp_per_pcs, order: newIdx + 1 }),
      ]);
    } catch (e: any) {
      toast.show(e.message || "Gagal ubah urutan", "error");
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

        {/* Lottery minimum price */}
        <Text style={styles.section}>🎟️ Kupon Undian — Harga Minimum</Text>
        <Text style={styles.desc}>
          Hanya pembelian <Text style={{ fontWeight: "700" }}>Air Galon 19L</Text> dengan harga
          per unit ≥ nilai ini yang berhak mendapatkan kupon undian. Galon Kosong tidak dapat kupon.
          Default: Rp 11.000.
        </Text>
        <View style={styles.row}>
          <Text style={styles.unit}>Rp</Text>
          <TextInput
            value={lotteryMin}
            onChangeText={(v) => setLotteryMin(v.replace(/[^\d]/g, ""))}
            keyboardType="number-pad"
            style={styles.input}
            placeholder="11000"
            testID="lottery-min-input"
          />
          <Text style={styles.unit}>/ galon</Text>
        </View>
        <TouchableOpacity
          onPress={saveLotteryMin}
          disabled={savingLottery}
          style={[styles.btn, savingLottery && { opacity: 0.6 }]}
          testID="save-lottery-min-btn"
        >
          <Text style={styles.btnText}>{savingLottery ? "Menyimpan…" : "Simpan Harga Minimum Kupon"}</Text>
        </TouchableOpacity>

        {/* Shifts CRUD */}
        <Text style={styles.section}>Shift Produksi & Gudang</Text>
        <Text style={styles.desc}>
          Atur nama shift yang tersedia untuk input Produksi & Gudang. Default: Pagi, Siang, Malam.
          Bisa tambah shift kustom seperti Lembur atau Subuh.
        </Text>
        {shifts.map((s, idx) => (
          <View key={idx} style={styles.shiftRow}>
            <TextInput
              value={s.label}
              onChangeText={(v) => setShifts((arr) => arr.map((x, i) => i === idx ? { ...x, label: v } : x))}
              placeholder="Nama shift"
              style={[styles.input, { flex: 1 }]}
              testID={`shift-label-${idx}`}
            />
            <TextInput
              value={s.key}
              onChangeText={(v) => setShifts((arr) => arr.map((x, i) => i === idx ? { ...x, key: v.replace(/[^a-z0-9_]/g, "") } : x))}
              placeholder="key"
              autoCapitalize="none"
              style={[styles.input, { width: 90 }]}
              testID={`shift-key-${idx}`}
            />
            <TouchableOpacity onPress={() => setShifts((arr) => arr.filter((_, i) => i !== idx))} style={styles.shiftDel} testID={`shift-del-${idx}`}>
              <Ionicons name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={() => setShifts((arr) => [...arr, { key: `shift${arr.length + 1}`, label: "Shift Baru" }])}
          style={styles.addShiftBtn}
          testID="add-shift-btn"
        >
          <Ionicons name="add-circle" size={18} color={theme.color.brandPrimary} />
          <Text style={{ color: theme.color.brandPrimary, fontWeight: "700", fontSize: 13 }}>Tambah Shift</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            if (shifts.length === 0) { toast.show("Minimal 1 shift", "error"); return; }
            setSavingShifts(true);
            try {
              const payload = shifts.map((s, i) => ({ key: s.key || `shift${i + 1}`, label: s.label || `Shift ${i + 1}`, order: i + 1 }));
              const r = await api.setShifts(payload);
              setShifts(r.shifts || payload);
              toast.show("Daftar shift tersimpan", "success");
            } catch (e: any) {
              toast.show(e.message || "Gagal simpan shift", "error");
            } finally {
              setSavingShifts(false);
            }
          }}
          disabled={savingShifts}
          style={[styles.btn, savingShifts && { opacity: 0.6 }]}
          testID="save-shifts-btn"
        >
          <Text style={styles.btnText}>{savingShifts ? "Menyimpan…" : "Simpan Shift"}</Text>
        </TouchableOpacity>

        {/* ===== Kelola Part (Biaya Penggantian Part) ===== */}
        <Text style={styles.section}>Kelola Part / Biaya Penggantian Part</Text>
        <Text style={styles.desc}>
          Item di daftar ini otomatis muncul di form Produksi & Gudang, Stok Gudang, dan
          Laporan Bulanan. Urutan bisa diubah dengan tombol ↑↓.
        </Text>
        {parts.map((p, idx) => (
          <View key={p.id} style={styles.partRow}>
            <View style={{ flexDirection: "column", gap: 2 }}>
              <TouchableOpacity
                onPress={() => movePart(p.id, -1)}
                disabled={idx === 0 || savingPart === p.id}
                style={[styles.moveBtn, idx === 0 && { opacity: 0.3 }]}
                testID={`part-up-${idx}`}
              >
                <Ionicons name="chevron-up" size={16} color={theme.color.brandPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => movePart(p.id, 1)}
                disabled={idx === parts.length - 1 || savingPart === p.id}
                style={[styles.moveBtn, idx === parts.length - 1 && { opacity: 0.3 }]}
                testID={`part-down-${idx}`}
              >
                <Ionicons name="chevron-down" size={16} color={theme.color.brandPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={p.name}
              onChangeText={(v) => setParts((arr) => arr.map((x, i) => (i === idx ? { ...x, name: v } : x)))}
              onEndEditing={() => savePart(p.id, { name: p.name })}
              placeholder="Nama part"
              style={[styles.input, { flex: 1 }]}
              testID={`part-name-${idx}`}
            />
            <TextInput
              value={String(p.rp_per_pcs || 0)}
              onChangeText={(v) => setParts((arr) => arr.map((x, i) => (i === idx ? { ...x, rp_per_pcs: parseInt(v.replace(/[^\d]/g, ""), 10) || 0 } : x)))}
              onEndEditing={() => savePart(p.id, { rp_per_pcs: Number(p.rp_per_pcs || 0) })}
              placeholder="Rp/pcs"
              keyboardType="number-pad"
              style={[styles.input, { width: 110 }]}
              testID={`part-rp-${idx}`}
            />
            <TouchableOpacity
              onPress={() => deletePart(p.id)}
              disabled={savingPart === p.id}
              style={styles.shiftDel}
              testID={`part-del-${idx}`}
            >
              {savingPart === p.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ))}
        {parts.length === 0 ? (
          <Text style={[styles.desc, { fontStyle: "italic" }]}>Belum ada item part.</Text>
        ) : null}
        <View style={styles.partRow}>
          <TextInput
            value={newPart.name}
            onChangeText={(v) => setNewPart((s) => ({ ...s, name: v }))}
            placeholder="Nama part baru (contoh: Bearing)"
            style={[styles.input, { flex: 1 }]}
            testID="new-part-name"
          />
          <TextInput
            value={newPart.rp}
            onChangeText={(v) => setNewPart((s) => ({ ...s, rp: v.replace(/[^\d]/g, "") }))}
            placeholder="Rp/pcs"
            keyboardType="number-pad"
            style={[styles.input, { width: 110 }]}
            testID="new-part-rp"
          />
          <TouchableOpacity
            onPress={addPart}
            disabled={savingPart === "__new__" || !newPart.name.trim()}
            style={[styles.addShiftBtn, { paddingHorizontal: 10, opacity: !newPart.name.trim() ? 0.5 : 1 }]}
            testID="add-part-btn"
          >
            {savingPart === "__new__" ? (
              <ActivityIndicator size="small" color={theme.color.brandPrimary} />
            ) : (
              <Ionicons name="add-circle" size={20} color={theme.color.brandPrimary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Privasi Harga */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-off" size={20} color={theme.color.brand} />
            <Text style={styles.sectionTitle}>Privasi Harga Produk</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Privasi harga sekarang diatur <Text style={{ fontWeight: "700" }}>per-produk</Text>. Buka menu{" "}
            <Text style={{ fontWeight: "700" }}>Produk & Harga</Text> lalu aktifkan toggle{" "}
            <Text style={{ fontWeight: "700" }}>“Sembunyikan Harga dari Sales”</Text> pada produk yang harganya ingin disembunyikan.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(superadmin)/products")}
            style={styles.linkBtn}
            testID="goto-products-btn"
          >
            <Ionicons name="pricetag" size={16} color={theme.color.brandPrimary} />
            <Text style={styles.linkBtnText}>Buka Produk & Harga</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.color.brandPrimary} />
          </TouchableOpacity>
        </View>

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
            onPress={() => setBackupOpen(true)}
            style={styles.backupBtn}
            testID="open-backup-btn"
          >
            <Ionicons name="cloud-download" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerBtnTitle}>💾 BACKUP SEMUA DATA (ZIP)</Text>
              <Text style={styles.dangerBtnDesc}>
                Unduh 1 file ZIP berisi CSV per koleksi (pelanggan, transaksi, user, produksi, gudang, dll).
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openReset("sales")}
            style={styles.dangerBtn}
            testID="reset-sales-btn"
          >
            <Ionicons name="refresh-circle" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerBtnTitle}>🟠 HALF RESET</Text>
              <Text style={styles.dangerBtnDesc}>Hapus transaksi/pengeluaran/laporan/GPS/undian/produksi/gudang. TETAP: pelanggan, semua user (admin/sales/gudang/produksi), produk.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openReset("all")}
            style={[styles.dangerBtn, { backgroundColor: "#7f1d1d" }]}
            testID="reset-all-btn"
          >
            <Ionicons name="trash-bin" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerBtnTitle}>🔴 ALL RESET</Text>
              <Text style={styles.dangerBtnDesc}>Hapus SEMUA data termasuk data pelanggan. TETAP: semua user (admin/sales/gudang/produksi) & produk.</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirmation Modal — sekarang jadi 1 modal dengan warning + input */}
      <Modal visible={!!resetType} transparent animationType="fade" onRequestClose={closeReset}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Ionicons name="warning" size={44} color={theme.color.error} style={{ alignSelf: "center" }} />
              <Text style={styles.modalTitle}>
                {resetType === "sales" ? "🟠 HALF RESET" : "🔴 ALL RESET"}
              </Text>
              <Text style={styles.modalWarn}>
                ⚠️ Aksi ini TIDAK BISA DIBATALKAN
              </Text>

              {/* Detail apa yang dihapus & tetap */}
              <View style={styles.detailBox}>
                <Text style={styles.detailTitleRed}>❌ YANG DIHAPUS:</Text>
                <Text style={styles.detailText}>
                  • Semua transaksi{"\n"}
                  • Semua pengeluaran{"\n"}
                  • Laporan bulanan{"\n"}
                  • Riwayat GPS & undian{"\n"}
                  • Input Produksi & Gudang
                  {resetType === "all" ? "\n• SEMUA data pelanggan (nama, alamat, foto, barcode)" : ""}
                </Text>
                <Text style={[styles.detailTitleGreen, { marginTop: 8 }]}>✅ YANG TETAP:</Text>
                <Text style={styles.detailText}>
                  {resetType === "sales"
                    ? "• Data pelanggan (hutang direset ke 0)\n• Semua user (Admin/Sales/Gudang/Produksi)\n• Master produk & harga\n• Kelola Part / Biaya Penggantian"
                    : "• Semua user (Admin/Sales/Gudang/Produksi)\n• Master produk & harga"}
                </Text>
              </View>

              <Text style={styles.modalBody}>
                Untuk konfirmasi, ketik teks berikut{" "}
                <Text style={{ fontWeight: "700", color: theme.color.error }}>
                  PERSIS SAMA
                </Text>{" "}
                di kotak bawah:
              </Text>
              <View style={styles.mustTypeBox}>
                <Text style={styles.mustTypeText}>
                  {resetType === "sales" ? "RESET PENJUALAN" : "RESET SEMUA"}
                </Text>
              </View>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={resetType === "sales" ? "Ketik: RESET PENJUALAN" : "Ketik: RESET SEMUA"}
                placeholderTextColor={theme.color.muted}
                autoCapitalize="characters"
                style={styles.modalInput}
                testID="reset-confirm-input"
              />
              {(() => {
                const expected = resetType === "sales" ? "RESET PENJUALAN" : "RESET SEMUA";
                const typed = confirmText.trim().toUpperCase();
                const ok = typed === expected;
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginBottom: 4 }}>
                    <Ionicons
                      name={ok ? "checkmark-circle" : (typed ? "close-circle" : "ellipse-outline")}
                      size={16}
                      color={ok ? theme.color.success : (typed ? theme.color.error : theme.color.muted)}
                    />
                    <Text style={{ fontSize: 11, color: ok ? theme.color.success : (typed ? theme.color.error : theme.color.muted) }}>
                      {ok ? "Teks cocok — tombol RESET aktif" : (typed ? `Belum cocok (${typed.length}/${expected.length} karakter)` : "Belum diketik")}
                    </Text>
                  </View>
                );
              })()}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={closeReset} style={[styles.modalBtn, { backgroundColor: theme.color.surfaceSecondary }]} testID="reset-cancel-btn">
                  <Text style={{ color: theme.color.onSurface, fontWeight: "600" }}>Batal</Text>
                </TouchableOpacity>
                {(() => {
                  const expected = resetType === "sales" ? "RESET PENJUALAN" : "RESET SEMUA";
                  const ok = confirmText.trim().toUpperCase() === expected;
                  return (
                    <TouchableOpacity
                      onPress={performReset}
                      disabled={resetting || !ok}
                      style={[
                        styles.modalBtn,
                        { backgroundColor: ok ? theme.color.error : "#94A3B8", opacity: resetting ? 0.6 : 1 },
                      ]}
                      testID="reset-confirm-btn"
                    >
                      {resetting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "700" }}>
                          {ok ? "RESET SEKARANG" : "Ketik dulu ↑"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <BackupExportModal visible={backupOpen} onClose={() => setBackupOpen(false)} />
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
  shiftRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  shiftDel: { padding: 10, backgroundColor: theme.color.error, borderRadius: 8 },
  addShiftBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 10, marginBottom: 6 },
  partRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  moveBtn: {
    width: 26,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: theme.color.surfaceSecondary,
  },
  dangerBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.color.error,
    padding: 16,
    backgroundColor: "#FEF2F2",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  toggleRowActive: {
    backgroundColor: theme.color.brand,
    borderColor: theme.color.brand,
  },
  toggleTitle: { fontSize: 13, fontWeight: "800", color: theme.color.onSurface },
  toggleDesc: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  toggleKnob: {
    width: 42, height: 24, borderRadius: 12,
    backgroundColor: theme.color.border,
    justifyContent: "center",
    padding: 2,
  },
  toggleKnobActive: { backgroundColor: "rgba(255,255,255,0.35)" },
  toggleDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#fff",
  },
  toggleDotActive: {
    backgroundColor: "#fff",
    transform: [{ translateX: 18 }],
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.brandPrimary,
    backgroundColor: theme.color.brandTertiary,
    marginTop: 8,
  },
  linkBtnText: { flex: 1, fontSize: 13, fontWeight: "700", color: theme.color.brandPrimary },
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
  backupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.brandPrimary,
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
  modalWarn: {
    textAlign: "center",
    color: theme.color.error,
    fontWeight: "700",
    fontSize: 13,
    backgroundColor: "#FEE2E2",
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  detailBox: {
    backgroundColor: theme.color.surfaceSecondary,
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  detailTitleRed: { fontSize: 12, fontWeight: "800", color: theme.color.error },
  detailTitleGreen: { fontSize: 12, fontWeight: "800", color: theme.color.success },
  detailText: { fontSize: 12, color: theme.color.onSurface, lineHeight: 18, marginTop: 4 },
  mustTypeBox: {
    borderWidth: 2,
    borderColor: theme.color.error,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 6,
    marginTop: 4,
    backgroundColor: "#FFF7ED",
  },
  mustTypeText: { fontSize: 18, fontWeight: "900", letterSpacing: 2, color: theme.color.error },
});
