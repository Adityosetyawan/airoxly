import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";

/**
 * Buku Panduan (in-app manual)
 * Route: /panduan  — accessible from all role dashboards.
 * Rendered as ScrollView per role section with expandable accordions.
 * Screenshots hosted at /panduan-img/*.jpeg (served from public/).
 */

type Section = {
  id: string;
  icon: any;
  title: string;
  color: string;
  items: { heading: string; body: string; img?: string }[];
};

const SECTIONS: Section[] = [
  {
    id: "intro",
    icon: "information-circle",
    title: "Tentang Aplikasi",
    color: "#0EA5E9",
    items: [
      {
        heading: "Air OXLY — Sistem Penjualan Air Minum",
        body:
          "Aplikasi ini menghubungkan 5 peran dalam 1 sistem terpadu:\n\n" +
          "👑 Super Admin — kelola seluruh sistem\n" +
          "📊 Admin Wilayah — kelola sales & pelanggan 1 wilayah\n" +
          "🚚 Sales — kunjungi pelanggan & catat transaksi\n" +
          "🏭 Produksi — isi galon dengan bantuan AI foto\n" +
          "📦 Gudang — kelola stok & cek bawa-kembali galon",
      },
    ],
  },
  {
    id: "login",
    icon: "log-in",
    title: "1. Cara Login",
    color: "#059669",
    items: [
      {
        heading: "Login Username & Password",
        body:
          "1. Buka aplikasi di browser atau tap ikon home screen\n" +
          "2. Masukkan Username & Password Anda\n" +
          "3. Tekan tombol hijau MASUK\n\n" +
          "💡 Tips: Tekan banner \"Pasang Air OXLY ke Home Screen\" supaya app terinstall seperti aplikasi native.",
        img: "01_login.jpeg",
      },
      {
        heading: "Login dengan Google",
        body:
          "Tekan tombol \"Masuk dengan Google\" — pastikan email Google Anda sudah didaftarkan Super Admin dulu.",
      },
    ],
  },
  {
    id: "superadmin",
    icon: "shield-checkmark",
    title: "2. Panduan Super Admin",
    color: "#7C3AED",
    items: [
      {
        heading: "Beranda Super Admin",
        body:
          "Melihat ringkasan seluruh sistem:\n• Setoran Bersih Hari Ini\n• Uang Diterima vs Pengeluaran\n• Galon Terjual & Transaksi\n• Hutang Baru\n• Total Pelanggan\n\nQuick Access: Kelola User, Data Pelanggan, Produk, Laporan, GPS Live, Undian.",
        img: "02_superadmin_dashboard.jpeg",
      },
      {
        heading: "Kelola User",
        body:
          "Tambah / edit / non-aktifkan akun untuk Admin, Sales, Produksi, dan Gudang.\n\nTekan + Tambah User → isi Username, Password, Role, dan Wilayah/Kelompok.",
        img: "03_superadmin_users.jpeg",
      },
      {
        heading: "Produk & Harga",
        body:
          "Set daftar produk (Galon 19L, Cup, Botol, dll) dan harga jual per satuan. Bisa juga set harga kulakan.",
        img: "04_superadmin_produk.jpeg",
      },
      {
        heading: "GPS Live — Pantau Sales",
        body:
          "Melihat posisi sales aktif di peta real-time (update tiap 60 detik). Tap kartu sales untuk lihat detail rute harian.",
        img: "05_superadmin_gps.jpeg",
      },
      {
        heading: "Pengaturan Sistem",
        body:
          "⚙️ Akses tersembunyi: Tap 7x pada logo/header untuk buka Settings.\n\nYang bisa diatur:\n• Radius Kunjungan Pelanggan (default 100m)\n• Filter Noise GPS (default 20m)\n• Shift Produksi & Gudang (Pagi/Siang/Malam/kustom)",
        img: "06_settings_top.jpeg",
      },
      {
        heading: "⭐ Kelola Part / Biaya Penggantian Part",
        body:
          "Fitur baru! Item di daftar ini OTOMATIS muncul di form Produksi, Gudang, Stok Real-time, dan Barang Datang.\n\nCara pakai:\n• Tambah: isi Nama + Rp/pcs → tekan ➕\n• Edit: tap nama/harga → auto-save\n• Ubah urutan: tombol ↑↓\n• Hapus: tombol 🗑️ merah\n\nBebas tambah item kustom seperti Bearing, Tutup Galon, dll.",
        img: "07_settings_kelola_part.jpeg",
      },
      {
        heading: "⚠️ Zona Berbahaya (Reset)",
        body:
          "HATI-HATI! Aksi tidak bisa dibatalkan.\n\n🟠 HALF RESET — Hapus transaksi/pengeluaran/laporan/GPS/produksi/gudang. TETAP: pelanggan, user, produk.\n\n🔴 ALL RESET — Hapus SEMUA termasuk pelanggan. HANYA TETAP: user & produk.\n\nKonfirmasi ganda dengan ketik teks persis.",
        img: "08_settings_danger.jpeg",
      },
    ],
  },
  {
    id: "sales",
    icon: "car",
    title: "3. Panduan Sales",
    color: "#F59E0B",
    items: [
      {
        heading: "Beranda Sales",
        body:
          "Melihat ringkasan hari ini:\n• Setoran ke Admin (net)\n• Uang Diterima vs Pengeluaran\n• Transaksi & Nilai Jual\n• Galon Terjual & Pelanggan tercapai\n\nTombol pintas: Scan/Baru, Pelanggan, Pengeluaran.",
        img: "10_sales_beranda.jpeg",
      },
      {
        heading: "Data Pelanggan",
        body:
          "Daftar pelanggan yang Anda kelola. Bisa search, filter berdasarkan hutang, dan lihat riwayat.\n\nTap pelanggan → detail lengkap (transaksi, hutang, pinjaman galon).",
        img: "11_sales_pelanggan.jpeg",
      },
      {
        heading: "Scan Barcode / Tambah Baru",
        body:
          "Scan barcode pelanggan (ID unik OXLY-xxx) atau tambah pelanggan baru:\n• Nama, WhatsApp, alamat\n• Lokasi GPS otomatis\n• Foto lokasi (opsional)",
        img: "12_sales_scan.jpeg",
      },
      {
        heading: "Transaksi Baru",
        body:
          "Dari pelanggan → + Transaksi Baru:\n1. Pilih produk\n2. Jumlah galon\n3. Bayar / hutang / pinjam / kembali\n4. Simpan — total otomatis dihitung",
      },
      {
        heading: "Pengeluaran Harian",
        body:
          "Beranda → + Tambah Pengeluaran:\n• Kategori: BBM, Makan, Parkir, dll\n• Nominal + catatan\n• Foto struk WAJIB via kamera (galeri di-disable)",
      },
      {
        heading: "Profil Sales",
        body:
          "Melihat data pribadi:\n• Total pelanggan & transaksi\n• Setoran hari ini\n• Gaji, komisi, bonus (diatur Admin)",
        img: "13_sales_profil.jpeg",
      },
    ],
  },
  {
    id: "produksi",
    icon: "construct",
    title: "4. Panduan Produksi",
    color: "#0284C7",
    items: [
      {
        heading: "Beranda Produksi",
        body:
          "Ringkasan hari ini:\n💧 Produksi Galon\n🔄 Galon Ganti\n🔧 Sparepart Ganti\n📄 Entry Hari Ini\n\nRekap per Kelompok & Sales.\n\nTekan tombol Input Harian Produksi untuk mulai.",
        img: "20_produksi_dashboard.jpeg",
      },
      {
        heading: "Input Harian — Bagian Atas",
        body:
          "1. Tanggal (default hari ini)\n2. Shift: Pagi/Siang/Malam\n3. Sales: ketik kode/nama → pilih\n4. Foto Galon Kosong (SEBELUM) → AI hitung otomatis\n5. Foto Galon Isi (SETELAH) → AI hitung otomatis\n\nStepper +/− di bawah foto untuk koreksi manual.",
        img: "21_produksi_input_top.jpeg",
      },
      {
        heading: "Input Harian — Bagian Bawah",
        body:
          "Destinasi:\n🏢 Kirim Gudang — hasil masuk stok gudang\n🛒 Langsung Jual — langsung ke sales\n\nPenggantian Galon & Sparepart (DINAMIS mengikuti daftar Super Admin):\nIsi jumlah part yang diganti (Seal, Mur, Kran, dll).\n\n⚠️ Produksi hanya bisa edit 1x. Setelah itu hanya Super Admin.",
        img: "22_produksi_input_parts.jpeg",
      },
    ],
  },
  {
    id: "gudang",
    icon: "archive",
    title: "5. Panduan Gudang",
    color: "#EA580C",
    items: [
      {
        heading: "Beranda Gudang",
        body:
          "Ringkasan hari ini:\n⬆️ Total Bawa (galon isi dibawa sales)\n⬇️ Total Sisa (tidak terjual)\n💱 Terjual (Bawa−Sisa)\n🔄 Galon Ganti\n\nRekap per Regu & Sales.",
        img: "30_gudang_dashboard.jpeg",
      },
      {
        heading: "Input Harian — Atas",
        body:
          "🔴 KURANG X galon (kalau Bawa > Kembali)\n🟢 LEBIH X galon (kalau Bawa < Kembali)\nBox ini real-time saat pilih sales.\n\n1️⃣ Bawa Isi — foto galon isi + jumlah stepper +/− (Pagi & Siang).",
        img: "31_gudang_input_top.jpeg",
      },
      {
        heading: "Input Harian — Bawah",
        body:
          "2️⃣ Sisa Isi — galon isi yang tidak terjual.\n\n3️⃣ Galon Kembali — galon kosong dari pelanggan (foto + stepper +/− Siang & Sore).\n\nPenggantian Galon & Sparepart: DINAMIS dari Super Admin.\n\nTap SIMPAN.",
        img: "32_gudang_input_bottom.jpeg",
      },
      {
        heading: "Stok Real-time",
        body:
          "Melihat stok terkini semua item:\n🟢 Hijau = stok aman (≥10)\n🔴 Merah = kurang (<10) — perlu order\n\nItem dinamis — semua part yang dikelola Super Admin muncul di sini.\n\nPull down untuk refresh.",
        img: "33_gudang_stok.jpeg",
      },
      {
        heading: "Barang Datang (Stok Masuk)",
        body:
          "Catat barang dari supplier:\n1. Tanggal (default hari ini)\n2. Item: pilih chip (dinamis)\n3. Jumlah\n4. Catatan: supplier/PO\n5. Tap SIMPAN & ➕ STOK\n\nRiwayat di bawah. Long-press untuk hapus.",
        img: "34_gudang_incoming.jpeg",
      },
    ],
  },
  {
    id: "admin",
    icon: "clipboard",
    title: "6. Panduan Admin",
    color: "#DB2777",
    items: [
      {
        heading: "Beranda Admin Wilayah",
        body:
          "Yang dilihat Admin (per wilayah):\n• Setoran Bersih & Uang Diterima\n• Transaksi & Galon Terjual\n• Hutang Terbentuk\n• Kelola Pelanggan, Undian, Selisih\n• Rangkuman per Sales",
        img: "40_admin_dashboard.jpeg",
      },
      {
        heading: "Tugas Admin",
        body:
          "1. Verifikasi Setoran Sales — cocokkan uang fisik → tandai ✓ Sudah Setor\n\n2. Laporan Bulanan — isi gaji, bonus; auto-fill part qty\n\n3. Undian Pemenang — buat periode → acak → cetak\n\n4. Selisih Galon — cek harian per sales, follow-up jika ekstrem",
      },
    ],
  },
  {
    id: "tips",
    icon: "bulb",
    title: "💡 Tips & Trik",
    color: "#EAB308",
    items: [
      {
        heading: "Semua Pengguna",
        body:
          "📱 Install sebagai App — tap banner \"Pasang Air OXLY\"\n🔄 Pull-to-refresh untuk update data\n📷 Foto WAJIB kamera (galeri di-disable untuk audit)",
      },
      {
        heading: "Sales",
        body:
          "🎯 Foto struk pengeluaran jangan lupa (audit Admin)\n📍 GPS harus aktif (kunjungan auto-detect)\n💵 Setor uang setiap hari (jangan tunda)",
      },
      {
        heading: "Produksi & Gudang",
        body:
          "🤖 Percaya AI, verifikasi manual — koreksi via +/−\n⏰ Selesaikan input sebelum ganti shift\n📦 Barang datang catat segera (stok real-time)",
      },
      {
        heading: "Super Admin",
        body:
          "🔒 Backup sebelum RESET (export via Bulanan)\n👥 Non-aktifkan (bukan hapus) mantan karyawan\n🎨 Urutan Kelola Part matters — atas muncul depan",
      },
    ],
  },
];

export default function PanduanScreen() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>("intro");

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="panduan-back">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>📘 Buku Panduan</Text>
          <Text style={styles.subtitle}>Air OXLY · v1.0</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map((sec) => (
          <SectionCard
            key={sec.id}
            section={sec}
            open={openId === sec.id}
            onToggle={() => setOpenId(openId === sec.id ? null : sec.id)}
          />
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Air OXLY</Text>
          <Text style={styles.footerText}>Sistem Penjualan Air Minum Terpadu</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({
  section, open, onToggle,
}: { section: Section; open: boolean; onToggle: () => void }) {
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  return (
    <View style={[styles.card, { borderLeftColor: section.color }]}>
      <TouchableOpacity onPress={onToggle} style={styles.cardHeader} testID={`panduan-sec-${section.id}`}>
        <View style={[styles.iconCircle, { backgroundColor: section.color + "22" }]}>
          <Ionicons name={section.icon} size={20} color={section.color} />
        </View>
        <Text style={styles.cardTitle}>{section.title}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.color.muted}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.cardBody}>
          {section.items.map((it, i) => (
            <View key={i} style={styles.itemBox}>
              <Text style={styles.itemHeading}>{it.heading}</Text>
              <Text style={styles.itemBody}>{it.body}</Text>
              {it.img && !imgErrors[it.img] ? (
                <Image
                  source={{ uri: `/panduan-img/${it.img}` }}
                  style={styles.itemImg}
                  resizeMode="contain"
                  onError={() => setImgErrors((s) => ({ ...s, [it.img!]: true }))}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surfaceSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: theme.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "700", color: theme.color.onSurface },
  subtitle: { fontSize: 11, color: theme.color.muted, marginTop: 2 },
  body: { padding: 12, paddingBottom: 60, gap: 10 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    borderLeftWidth: 4,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: theme.color.onSurface },
  cardBody: {
    padding: 14,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.divider,
  },
  itemBox: { gap: 8, paddingBottom: 8 },
  itemHeading: { fontSize: 14, fontWeight: "700", color: theme.color.brand },
  itemBody: { fontSize: 13, lineHeight: 20, color: theme.color.onSurface },
  itemImg: {
    width: "100%",
    aspectRatio: 390 / 700,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  footer: {
    alignItems: "center",
    padding: 20,
    gap: 4,
  },
  footerText: { fontSize: 11, color: theme.color.muted, textAlign: "center" },
});
