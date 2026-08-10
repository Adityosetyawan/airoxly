# 📘 Buku Panduan — Aplikasi Air OXLY

**Sistem Penjualan Air Minum Terpadu**
*Versi 1.0 · Update Agustus 2026*

---

## 🎯 Tentang Aplikasi

**Air OXLY** adalah aplikasi manajemen penjualan air galon yang menghubungkan **5 peran** dalam satu sistem:

| Peran | Tugas Utama |
|-------|-------------|
| 👑 **Super Admin** | Kelola seluruh sistem, user, produk, part, laporan global |
| 📊 **Admin Wilayah** | Kelola sales & pelanggan di 1 wilayah, verifikasi setoran |
| 🚚 **Sales** | Kunjungi pelanggan, catat transaksi & pengeluaran, setor uang |
| 🏭 **Produksi** | Isi galon (dengan AI hitung foto), catat penggantian sparepart |
| 📦 **Gudang** | Cek bawa-kembali galon sales, kelola stok, catat barang masuk |

**URL Aplikasi Live:** [airoxly.vercel.app](https://airoxly.vercel.app)

---

## 🔑 1. Cara Login

![Halaman Login](/panduan-img/01_login.jpeg)

**Langkah:**
1. Buka aplikasi di browser HP atau Chrome PC
2. Masukkan **Username** dan **Password**
3. Tekan tombol hijau **Masuk**

**Akun yang tersedia:**
- Super Admin, Admin, Sales, Produksi, Gudang
- (Password diatur oleh Super Admin — hubungi jika belum punya akun)

**Login dengan Google:**
- Tekan **Masuk dengan Google** (email harus sudah didaftarkan Super Admin dulu)

**💡 Tips:** Klik banner **"Pasang Air OXLY ke Home Screen"** supaya app muncul sebagai ikon di HP seperti aplikasi native.

---

## 👑 2. Panduan Super Admin

### 2.1 Beranda Super Admin

![Dashboard Super Admin](/panduan-img/02_superadmin_dashboard.jpeg)

**Yang bisa dilihat:**
- 💰 **Setoran Bersih Hari Ini** — total uang bersih yang diterima
- 📊 **Uang Diterima vs Pengeluaran Sales**
- 🥛 **Galon Terjual** & **Transaksi Hari Ini**
- ⚠️ **Hutang Baru** hari ini
- 👥 **Total Pelanggan** di seluruh sistem

**Quick Access:** Tombol pintas ke Kelola User, Data Pelanggan, Produk, Laporan, GPS Live, dan Undian.

### 2.2 Kelola User

![Kelola User](/panduan-img/03_superadmin_users.jpeg)

Menambah / mengedit / menonaktifkan akun untuk Admin, Sales, Produksi, dan Gudang.

**Untuk tambah user:** tekan tombol **+ Tambah User** → isi username, password, role, dan wilayah/kelompok.

### 2.3 Kelola Produk & Harga

![Produk](/panduan-img/04_superadmin_produk.jpeg)

Set daftar produk (Galon 19L, Cup, Botol, dll) dan harga jual per satuan. Bisa juga atur harga kulakan.

### 2.4 GPS Live — Pantau Sales

![GPS Live](/panduan-img/05_superadmin_gps.jpeg)

Menampilkan posisi semua sales aktif di peta real-time (update tiap 60 detik). Klik kartu sales untuk lihat detail rute harian.

### 2.5 Pengaturan Sistem (Settings)

![Pengaturan Sistem — Radius, GPS, Shift](/panduan-img/06_settings_top.jpeg)

**⚙️ Akses tersembunyi:** Tap 7x pada logo/header untuk buka menu Settings.

**Yang bisa diatur:**
- **Radius Kunjungan Pelanggan** — jarak minimum sales dianggap "mengunjungi" pelanggan (default 100 m)
- **Filter Noise GPS** — jarak minimum titik GPS baru direkam (default 20 m — supaya rute smooth)
- **Shift Produksi & Gudang** — nama shift kustom (Pagi, Siang, Malam, Lembur, dll)

### 2.6 Kelola Part / Biaya Penggantian Part 🆕

![Kelola Part](/panduan-img/07_settings_kelola_part.jpeg)

**⭐ Fitur baru!** Semua item di daftar ini **otomatis muncul di form Produksi, Gudang, Stok Real-time, dan Barang Datang**.

**Cara pakai:**
1. **Tambah item baru:** isi Nama + Rp/pcs di kolom bawah, tekan tombol ➕
2. **Edit inline:** tekan nama / harga → ketik → tekan luar kolom (auto-save)
3. **Ubah urutan:** tekan tombol **↑ ↓** di kiri
4. **Hapus:** tekan tombol 🗑️ merah (konfirmasi ganda)

**Contoh item bawaan:** Seal, Mur, Kran, Galon Kran, Galon Polos, Stiker, Stoper, Karet Kran.
**Bebas tambah item kustom:** Bearing, Tutup Galon, Tisue Galon, dll.

### 2.7 Zona Berbahaya (Reset Data)

![Zona Berbahaya](/panduan-img/08_settings_danger.jpeg)

**⚠️ HATI-HATI!** Aksi berikut TIDAK BISA DIBATALKAN.

| Tombol | Efek |
|--------|------|
| 🟠 **HALF RESET** | Hapus transaksi/pengeluaran/laporan/GPS/produksi/gudang. **TETAP:** pelanggan, semua user, produk |
| 🔴 **ALL RESET** | Hapus SEMUA termasuk pelanggan. **HANYA TETAP:** user & produk |

**Konfirmasi ganda:** Anda harus ketik `RESET PENJUALAN` atau `RESET SEMUA` persis sebelum tombol aktif.

---

## 🚚 3. Panduan Sales

### 3.1 Beranda Sales

![Beranda Sales](/panduan-img/10_sales_beranda.jpeg)

**Ringkasan Hari Ini:**
- **Setoran ke Admin (net)** — total yang harus disetor: Uang Diterima − Pengeluaran
- **Transaksi Hari Ini** & **Nilai Jual**
- **Galon Terjual**, **Pelanggan** yang tercapai
- Tombol pintas: **Scan/Baru**, **Pelanggan**, **Pengeluaran**

### 3.2 Data Pelanggan

![Daftar Pelanggan](/panduan-img/11_sales_pelanggan.jpeg)

Daftar semua pelanggan yang Anda kelola. Bisa search, filter berdasarkan hutang, dan lihat riwayat transaksi.

**Klik pelanggan** → detail lengkap (transaksi, hutang, pinjaman galon).

### 3.3 Scan Barcode / Tambah Pelanggan Baru

![Scan / Baru](/panduan-img/12_sales_scan.jpeg)

Scan barcode pelanggan (ID unik OXLY-xxx) atau tambah pelanggan baru.

### 3.3.1 Form "Pelanggan Baru" 🆕

![Form Pelanggan Baru](/panduan-img/14_sales_pelanggan_baru.jpeg)

**Langkah:**
1. **Nama** (wajib) & **No. WhatsApp**
2. **Alamat** — tulis lengkap agar mudah dicari
3. **Barcode/QR** — kosongkan untuk auto-generate (format `[KODE_SALES]-OXLY-[nomor]`)
4. **Ambil Lokasi GPS Sekarang** — tekan sambil berdiri di depan rumah pelanggan agar akurat

### 3.3.2 Foto Rumah Pelanggan 📸

![Foto Rumah](/panduan-img/15_sales_foto_rumah.jpeg)

**Fitur baru!** Sertakan foto tampak depan rumah pelanggan supaya:
- Sales lain / sales baru mudah menemukan lokasi
- Bukti visual untuk Admin & SuperAdmin
- Membantu pengenalan pelanggan setelah lama tidak dikunjungi

**Cara pakai:**
1. Tekan tombol besar **"📷 Foto rumah pelanggan"**
2. Kamera akan aktif (galeri di-disable untuk audit)
3. Ambil foto tampak depan rumah dengan patokan (pagar, nomor rumah, warna)
4. **Watermark otomatis** — tanggal & jam tercetak di foto
5. Foto langsung tersimpan di form

**Kalau ingin ubah/hapus:** buka detail pelanggan → tap **Edit** → ganti foto atau kosongkan.

### 3.4 Transaksi Baru

Dari halaman Pelanggan → klik pelanggan → **+ Transaksi Baru**:
1. Pilih produk (Galon Isi 19L, dll)
2. Set jumlah galon
3. Catat: dibayar sekarang / hutang / pinjam galon kosong / kembali galon
4. Simpan → total otomatis dihitung

### 3.5 Pengeluaran Harian

Dari Beranda → **+ Tambah Pengeluaran**:
- Kategori: BBM, Makan, Parkir, dll
- Nominal + catatan
- **Foto struk (WAJIB kamera, bukan galeri)** untuk audit

### 3.6 Profil Sales

![Profil Sales](/panduan-img/13_sales_profil.jpeg)

Lihat data pribadi:
- Total pelanggan, total transaksi
- Setoran hari ini (Uang Diterima, Pengeluaran, Setoran Bersih)
- Gaji, komisi, bonus yang dihitung admin

---

## 🏭 4. Panduan Produksi

### 4.1 Beranda Produksi

![Beranda Produksi](/panduan-img/20_produksi_dashboard.jpeg)

**Ringkasan Hari Ini:**
- 💧 **Produksi Galon** — total galon yang sudah diisi
- 🔄 **Galon Ganti** — galon rusak diganti baru
- 🔧 **Sparepart Ganti** — total pcs sparepart terpakai
- 📄 **Entry** — jumlah input hari ini

Rekap per Kelompok & per Sales tercantum di bawah.

**Klik tombol hijau "Input Harian Produksi"** untuk mulai catat produksi baru.

### 4.2 Input Harian — Bagian Atas

![Input Produksi Atas](/panduan-img/21_produksi_input_top.jpeg)

**Langkah-langkah:**
1. **Tanggal** → default hari ini
2. **Shift** → pilih Pagi / Siang / Malam
3. **Sales** → ketik nama atau kode sales (contoh: A1) → pilih dari suggestion
4. **1️⃣ Foto Galon Kosong (SEBELUM diisi)**
   - Tekan area foto → kamera aktif (auto-stempel tanggal/jam)
   - **AI GPT-5** otomatis hitung jumlah galon di foto
   - Muncul: `🤖 AI hitung: X galon · yakin/cek ulang/kurang yakin`
   - Ada tombol **+ / −** di bawah foto untuk koreksi manual (kalau AI salah)
5. **2️⃣ Foto Galon Isi (SETELAH diisi)**
   - Sama seperti di atas, tapi setelah pengisian
   - Manual **+/−** di bawah foto **MEMPENGARUHI TOTAL PRODUKSI**

**TOTAL PRODUKSI** = AI count + manual adjust → ditampilkan otomatis dengan angka besar.

### 4.3 Input Harian — Bagian Bawah

![Input Produksi Bawah](/panduan-img/22_produksi_input_parts.jpeg)

**3️⃣ Destinasi:**
- 🏢 **Kirim Gudang** → hasil produksi masuk ke stok gudang
- 🛒 **Langsung Jual** → tidak masuk gudang, langsung ke sales

**Penggantian Galon & Sparepart (opsional):**
- Section ini **DINAMIS** mengikuti daftar Super Admin
- Isi jumlah part yang diganti (contoh: Seal 3, Mur 1, Kran 2)
- Kalau Super Admin tambah "Tisue Galon", otomatis muncul di sini

**Catatan (opsional):** keterangan tambahan.

Tekan **SIMPAN PRODUKSI** untuk simpan.

**⚠️ Aturan Edit:** Produksi hanya bisa edit entry **1× saja**. Setelah itu, hanya Super Admin yang bisa ubah.

---

## 📦 5. Panduan Gudang

### 5.1 Beranda Gudang

![Beranda Gudang](/panduan-img/30_gudang_dashboard.jpeg)

**Ringkasan Hari Ini:**
- ⬆️ **Total Bawa** — galon isi dibawa berangkat sales
- ⬇️ **Total Sisa** — galon isi yang tidak terjual
- 💱 **Terjual (Bawa−Sisa)**
- 🔄 **Galon Ganti**

**Tombol besar:** Input Harian & Barang Datang.

Rekap per Regu & per Sales tersedia di bawah.

### 5.2 Input Harian Gudang — Bagian Atas

![Input Gudang Atas](/panduan-img/31_gudang_input_top.jpeg)

**Kotak Peringatan Selisih (Merah/Hijau):**
- 🔴 **KURANG X galon** — kalau Bawa Isi > Galon Kembali
- 🟢 **LEBIH X galon** — kalau Bawa Isi < Galon Kembali
- Real-time ter-update saat Anda pilih sales

**1️⃣ Bawa Isi** (galon isi yang dibawa sales berangkat):
- Foto galon isi (kamera + auto-stempel)
- Isi jumlah dengan stepper **+/−** di bawah foto
- Split per Pagi & Siang

### 5.3 Input Harian Gudang — Bagian Bawah

![Input Gudang Bawah](/panduan-img/32_gudang_input_bottom.jpeg)

**2️⃣ Sisa Isi** — galon isi yang tidak terjual, kembali ke gudang.

**3️⃣ Galon Kembali** — galon kosong yang dibawa balik dari pelanggan:
- Foto galon kosong + jumlah pakai stepper +/−
- Split per Siang & Sore

**Penggantian Galon & Sparepart:**
- Sama dengan Produksi — DINAMIS mengikuti daftar Super Admin
- Isi part yang diganti hari itu

Tekan **SIMPAN**.

### 5.4 Stok Gudang Real-time

![Stok Real-time](/panduan-img/33_gudang_stok.jpeg)

**Stok terkini dari semua item:**
- 🟢 Angka hijau = stok aman (≥ 10)
- 🔴 Angka merah = stok kurang (< 10) → perlu order

**Item dinamis** — semua part yang dikelola Super Admin muncul di sini termasuk item baru seperti "Tisue Galon".

**Pull down untuk refresh.**

### 5.5 Barang Datang

![Barang Datang](/panduan-img/34_gudang_incoming.jpeg)

Untuk catat **stok masuk dari supplier**:

1. Tanggal (default hari ini)
2. Pilih **Item** dari chip (dinamis dari Super Admin)
3. Isi **Jumlah** unit yang datang
4. Catatan (Supplier, No PO, dll)
5. Tekan **SIMPAN & ➕ STOK**

Riwayat semua barang datang tampil di bawah. Long-press untuk hapus.

---

## 📊 6. Panduan Admin Wilayah

### 6.1 Beranda Admin

![Beranda Admin](/panduan-img/40_admin_dashboard.jpeg)

**Yang dilihat Admin (per wilayahnya saja):**
- 💰 Setoran Bersih Hari Ini + Uang Diterima
- 📊 Transaksi & Galon Terjual
- ⚠️ Hutang Terbentuk
- 🔗 Kelola Pelanggan, Undian Pemenang, Selisih Galon
- 📋 Rangkuman per Sales (dengan status setoran)

### 6.2 Tugas Admin Utama

1. **Verifikasi Setoran Sales:**
   - Klik sales → cek daftar setoran
   - Cocokkan uang fisik dengan sistem
   - Tandai **✓ Sudah Setor** setelah verifikasi

2. **Laporan Bulanan (menu Bulanan):**
   - Isi Gaji Sopir, Kernet, Bonus
   - Pastikan Part Qty benar (auto-fill dari Produksi/Gudang)
   - Laporan tersimpan permanen per bulan

3. **Undian Pemenang:**
   - Buat periode undian
   - Sistem acak pelanggan yang aktif transaksi
   - Cetak/share hasil ke pemenang

4. **Selisih Galon (Merah/Hijau):**
   - Cek harian per sales — Bawa vs Kembali
   - Follow up sales jika ada selisih ekstrem

---

## 🔄 7. Cara Reset Data (SuperAdmin)

### ⚠️ PENTING — Baca Dulu Sebelum Reset

Reset data adalah **aksi PERMANEN dan TIDAK BISA DIBATALKAN**.

**Sebelum reset, WAJIB:**
1. **Backup data** — buka menu **Bulanan** → Export laporan bulan berjalan
2. Pastikan **semua setoran sales** sudah tercatat & diverifikasi
3. Screenshot dashboard sebagai referensi visual

Reset hanya bisa dilakukan oleh **Super Admin**.

### Step 1 — Masuk ke Settings

![Zona Berbahaya](/panduan-img/50_reset_zona.jpeg)

1. Login sebagai `superadmin`
2. **TAP 7 KALI pada logo/header** aplikasi di beranda
3. Menu Settings akan terbuka
4. **Scroll ke bawah** sampai muncul kotak merah **"⚠️ Zona Berbahaya"**

### Step 2 — Pilih Jenis Reset

| Tombol | Yang Dihapus | Yang Tetap |
|--------|--------------|------------|
| 🟠 **HALF RESET** | Transaksi, pengeluaran, laporan, GPS, undian, produksi, gudang | ✅ Pelanggan (nama, foto, barcode) · Semua user · Produk · Part |
| 🔴 **ALL RESET** | **Semua di atas + data pelanggan** (nama, alamat, foto, barcode) | ✅ Semua user · Produk (hanya master data) |

**Kapan pakai HALF RESET?**
- Reset awal tahun / awal bulan pembukuan baru
- Setelah bulan uji coba
- Data lama menumpuk

**Kapan pakai ALL RESET?**
- Ganti pemilik bisnis / franchise baru
- Setelah demo / training (data dummy)
- Setup ulang dari nol

### Step 3 — Konfirmasi Ganda (Anti Iseng)

Setelah tap tombol reset, muncul dialog konfirmasi. Anda **WAJIB ketik teks konfirmasi PERSIS**:

- Untuk **HALF RESET**: ketik `RESET PENJUALAN`
- Untuk **ALL RESET**: ketik `RESET SEMUA`

Tombol **"Reset Sekarang"** hanya aktif kalau teks cocok 100%.

💡 **Kalau ragu, tekan Batal** — data aman.

### Step 4 — Verifikasi Setelah Reset

Setelah reset sukses, muncul notifikasi hijau **"Reset sukses. XX record dihapus"**.

**Cek:**
1. Beranda SuperAdmin — semua angka jadi 0
2. Menu **User** — akun masih lengkap (login tidak perlu ulang)
3. Menu **Produk** — daftar produk masih ada
4. Menu **Kelola Part** — daftar part masih ada
5. **Data Pelanggan** — tetap ada (HALF) / kosong (ALL)

### ⚠️ TIDAK PERLU RESET Kalau:

- Sekedar mau lihat laporan bulan lalu → pakai **filter tanggal** di menu Bulanan
- Ada transaksi salah → edit/hapus **1 item saja** lewat menu Transaksi
- Salah input harga → langsung edit di **Kelola Part** / **Master Produk**

---

## 💡 Tips & Trik

### Untuk Semua Pengguna:
- 📱 **Install sebagai App** — klik banner "Pasang Air OXLY ke Home Screen" → ikon muncul di HP seperti native app
- 🔄 **Pull-to-refresh** di banyak halaman untuk update data terkini
- 📷 **Foto WAJIB kamera** — untuk audit, galeri di-disable

### Untuk Sales:
- 🎯 **Foto struk pengeluaran** — jangan lupa, kalau tidak Admin tidak akan approve
- 📍 **GPS harus aktif** — supaya kunjungan pelanggan terdeteksi otomatis
- 💵 **Setor uang setiap hari** — jangan tunda supaya laporan bulanan benar

### Untuk Produksi & Gudang:
- 🤖 **Percaya AI, verifikasi manual** — kalau AI hitung 48 tapi kenyataan 50, pakai tombol +/− koreksi
- ⏰ **Input harian selesaikan sebelum ganti shift** — supaya laporan tepat
- 📦 **Barang datang catat segera** — supaya stok real-time akurat

### Untuk Super Admin:
- 🔒 **Backup dulu sebelum RESET** — export data via menu Bulanan
- 👥 **Non-aktifkan user** (bukan hapus) untuk mantan karyawan → riwayatnya tetap
- 🎨 **Urutan Kelola Part matters** — item paling atas muncul paling depan di form input

---

## 🆘 Bantuan & Support

**Masalah Umum:**
- **Tidak bisa login?** → Cek username/password. Kalau tetap gagal, minta reset ke Super Admin.
- **Foto tidak upload?** → Cek koneksi internet, atau restart app.
- **Selisih Galon KURANG terus?** → Cek foto Bawa Isi & Galon Kembali, kemungkinan salah hitung.
- **AI hitung salah?** → Pakai stepper +/− di bawah foto untuk koreksi manual.

**Hubungi Super Admin** untuk masalah teknis atau permintaan fitur.

---

*© 2026 Air OXLY — Sistem Penjualan Air Minum Terpadu*
