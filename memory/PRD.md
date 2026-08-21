# Air OXLY - Aplikasi Penjualan Air Minum (PRD)

## Overview
Aplikasi mobile (Expo/React Native) untuk penjualan air minum galon dengan hirarki 3 tingkat: Super Admin → Admin → Sales. Sales bekerja di lapangan, dikelompokkan berdasarkan wilayah kode huruf A-Z dengan kode sales A1..Z100.

## Roles

### Super Admin
- Mengelola SEMUA user (super_admin, admin, sales)
- Mengelola produk & harga (CRUD)
- Melihat SEMUA laporan penjualan (semua wilayah)
- Menghapus transaksi
- Mengedit inputan Admin
- Live GPS tracking semua sales

### Admin (per wilayah)
- Hanya mengelola sales pada wilayahnya (group_letter)
- Melihat laporan sales dalam wilayahnya
- Menambah/edit sales (username, password, nama, no WA, tahun masuk, alamat, gaji, komisi, bonus)
- Live GPS tracking sales wilayahnya

### Sales
- Menambah pelanggan (scan barcode/QR atau input manual)
- Membuat transaksi (produk, bayar, hutang, pinjam galon, galon kembali)
- Kirim struk transaksi via WhatsApp deep link
- Edit transaksi hanya 1× kemudian kirim ulang WA
- Melihat statistik hari ini (uang diterima, galon terjual)
- Melihat database pelanggan sendiri, disortir berdasarkan No. Urut, Ranking Belanja, Terlama Beli, Pinjam Galon
- Melihat detail pelanggan (hutang total, pinjam galon, tanggal terakhir beli)
- Generate QR code untuk pelanggan baru (untuk dicetak & ditempel)
- Auto ping GPS ke server setiap 60 detik

## Business Rules

### Transaksi
- Item: qty × harga → subtotal
- Total = sum(subtotal)
- Jika `bayar > total`: uang lebih otomatis MENGURANGI hutang lama pelanggan
- Jika `bayar < total`: kekurangan menjadi hutang transaksi, MENAMBAH total hutang pelanggan
- Pinjam galon → +gallon_loans; Kembali galon → -gallon_loans (min 0)
- `last_purchase_date`, `total_purchases`, `purchase_count` diupdate

### Edit transaksi
- Sales: max 1×, hanya milik sendiri
- Super Admin: bebas edit/hapus
- Admin: tidak bisa edit transaksi

## Tech Stack
- Frontend: Expo SDK 54, expo-router, expo-camera, expo-location, react-native-qrcode-svg
- Backend: FastAPI, Motor (MongoDB async), JWT (pyjwt), passlib (bcrypt)
- WhatsApp: Deep link `wa.me/{phone}?text=...`
- Storage: MongoDB (users, products, customers, transactions, locations)
- Auth: JWT bearer, secure storage on device (expo-secure-store)

## API Endpoints
- POST /api/auth/login, GET /api/auth/me
- Users: GET/POST /api/users, PATCH/DELETE /api/users/{id}
- Products: GET/POST /api/products, PATCH/DELETE /api/products/{id}
- Customers: GET /api/customers (sort=no|ranking|last|loans), POST, PATCH/DELETE, lookup barcode
- Transactions: GET/POST /api/transactions, GET/PATCH/DELETE /api/transactions/{id}
- Reports: GET /api/reports/daily?date=&group_letter=&sales_code=
- Location: POST /api/location/ping, GET /api/location/live, /api/location/history/{sales_id}
- Stats: GET /api/stats/overview

## Screens
### Sales
- Dashboard (KPI hari ini + list transaksi hari ini)
- Customers (search + sort chips + summary hutang/pinjam)
- Scan (kamera QR/barcode + tombol manual)
- Customer Detail (info + QR + riwayat + tombol transaksi baru)
- Transaction Form (produk stepper + galon + bayar + sticky "Kirim WA & Simpan")
- Transaction Detail (view + edit 1× + resend WA)
- Profile (info sales, gaji, komisi, bonus, lokasi GPS live, logout)

### Admin
- Dashboard (KPI wilayah + rangkuman per sales)
- Report (filter tanggal & kode sales)
- Sales (CRUD sales dalam wilayah)
- Live GPS (peta status sales)
- Profile

### Super Admin
- Dashboard (KPI global)
- Report (semua wilayah)
- Users (CRUD semua role)
- Products (CRUD produk & harga)
- Live GPS


## Manual Full Backup (Aug 2026)
- Super Admin bisa unduh 1 file ZIP berisi semua koleksi (CSV per koleksi) dari:
  - Quick Access dashboard → "Backup Data"
  - Pengaturan Sistem → Zona Berbahaya → "💾 BACKUP SEMUA DATA (ZIP)"
- Endpoint: `GET /api/backup/preview`, `GET /api/backup/export-all.zip` (Super Admin only)
- CSV pakai UTF-8 BOM (langsung rapi di Excel/Sheets), nested field dijadikan JSON string
- Field `password_hash` dan `_id` tidak diekspor
- Isi ZIP: users, products, part_prices, customers, transactions, expenses, warehouse_daily, warehouse_incoming, production_daily, monthly_reports, lottery_periods, lottery_tickets, locations, settings, README.txt, manifest.json

## Photo Compression (Aug 2026)
- Foto baru: PhotoCapture otomatis resize ke max 1024px + JPEG q=0.5 via `expo-image-manipulator`
- Foto lama: Endpoint migrasi `POST /api/backup/compress-photos` menggunakan Pillow (max 1024px + JPEG q=60). Idempotent. Skip file < 60KB atau file yang sudah optimal.
- Stats endpoint: `GET /api/backup/photo-stats` menampilkan total foto & ukuran
- UI: card kuning di dalam Backup modal — tombol "Kompres Sekarang" dengan konfirmasi Alert
- Hasil real-world test: 1.56 MB → 0.17 MB (89.2% saving)

## Photo Lazy Loading (Aug 2026)
- `GET /api/customers` (list) & `GET /api/customers/reminders` sekarang TIDAK mengirim field `photo_rumah` (base64). Response payload turun dari ~2.2 MB → ~25 KB untuk 57 pelanggan.
- Ganti dengan boolean flag `has_photo` di setiap item list (via MongoDB aggregation `$strLenCP`) supaya UI bisa tampilkan ikon kamera 📷 pada pelanggan yang punya foto.
- `GET /api/customers/{id}` (detail) tetap mengirim foto lengkap → foto hanya di-load saat user buka detail.
- Frontend: `Customer` type dapat properti `has_photo?: boolean`. Ikon kamera muncul di `CustomersList.tsx` & `(sales)/customers.tsx`.
- Detail cache offline: `cacheCustomerDetail` menyimpan 30 pelanggan yang paling baru dibuka lengkap dengan foto → tetap bisa lihat foto meski offline.

## Sparepart Transfer Gudang → Produksi (Aug 2026)
- New collection: `sparepart_transfers` `{id, date, part_name, qty, notes, from_location, to_location, created_by_name, created_at}`
- Endpoints: `POST /api/warehouse/transfer`, `GET /api/warehouse/transfers`, `GET /api/warehouse/stock-split`, `DELETE /api/warehouse/transfer/{id}`
- Business rules:
  • `warehouse_incoming` → menambah stok Gudang
  • `sparepart_transfers` → kurangi Gudang, tambah Produksi
  • `production_daily.part_qtys` → kurangi Produksi (tetap tercatat per sales — logika lama tidak berubah)
  • `warehouse_daily.part_qtys` → kurangi Gudang (pemakaian Gudang untuk sales)
- Frontend:
  • Gudang → tab "Stok" — CTA "Kirim Sparepart ke Produksi" + kotak pantau Gudang/Produksi/Total + riwayat transfer
  • Produksi → tab "Stok" — kotak pantau (readonly, highlight kolom Produksi) + riwayat kiriman dari Gudang
  • Shared component: `StockSplitPanel.tsx`

## Impersonation Fix Final (Aug 2026)
- `AuthContext.navigateToRoleHome()` sekarang route via `/` (index.tsx) yang membaca `user` state terbaru untuk pick dashboard yang benar → menghindari race condition native Stack group-switch.
- Double-fire pattern: `setTimeout 60ms` + `setTimeout 600ms` untuk menahan native Android Stack cache.

## Sales Transaction Form Improvements (Aug 2026)
- Form transaksi baru (`/(sales)/transaction/new`) sekarang eksplisit reset `qtys/bayar/pinjam/kembali` saat buka untuk transaksi baru (bukan edit).
- Tambah label "💡 Wajib bayar sesuai belanja: Rp X" di bawah input Uang dibayar.
- Tombol quick "Bayar lunas Rp X" untuk auto-fill bayar = total.
- Label "(baru)" dihapus → sekarang cuma "Pinjam Galon".

## Keyboard Calc Bar (Aug 2026)
- Komponen global `KeyboardCalcBar.tsx` di-mount di root layout.
- Ketika user fokus TextInput numeric, muncul bar hitam melayang di atas keyboard yang tampilkan angka besar (Rp XX.XXX atau "X galon" atau "X unit").
- Registrasi via hook `useCalcBar(value, { hint, format })`.
- Diaplikasikan di: bayar/pinjam/kembali di transaction form + qty transfer di Gudang.

## Privasi Harga Produk (Aug 2026)
- Toggle Superadmin di Pengaturan → "Privasi Harga Produk"
- Setting key: `hide_prices_from_sales` (boolean)
- Ketika ON: form transaksi Sales tampilkan produk hanya dgn "/ box" atau "/ gln" tanpa nominal Rp
- Superadmin, Admin tetap bisa lihat harga

## Produksi Rekap per Sales Detail (Aug 2026)
- Kolom galon dipisah: Prod Gln / Gln Kran / Gln Polos / Gln Gt
- Sparepart tidak lagi ditampilkan agregat — sekarang breakdown chip per item ("Seal 2, Mur 1, Karet Kran 3, ...")
- Chip warna brand tertiary di bawah row galon

## Inventory: Bahan & Barang Jadi (Aug 2026)

### Collections & Endpoints
- `inventory_items` — Superadmin CRUD (fields: id, name, category, unit, order)
- `bahan_incoming` — Gudang input material masuk
- `bahan_transfers` — Gudang → Produksi
- `finished_production` — Produksi produce barang jadi
- `finished_transfers` — Produksi → Gudang
- Endpoints:
  - `GET/POST/PUT/DELETE /api/inventory/items`
  - `POST /api/inventory/bahan/incoming` + `GET .../incoming`
  - `POST /api/inventory/bahan/transfer` + `GET .../transfers`
  - `POST /api/inventory/finished/produce` + `GET .../production`
  - `POST /api/inventory/finished/transfer` + `GET .../transfers`
  - `GET /api/inventory/stock?category=bahan|barang_jadi`

### Stock Formula
- **Bahan Gudang** = sum(bahan_incoming.qty) − sum(bahan_transfers.qty)
- **Bahan Produksi** = sum(bahan_transfers.qty)
- **Barang Jadi Produksi** = sum(finished_production.qty) − sum(finished_transfers.qty)
- **Barang Jadi Gudang** = sum(finished_transfers.qty) − sum(transactions.items.qty where product name matches, non-draft)

### UI
- SuperAdmin: `/(superadmin)/inventory` → tab Bahan/Barang Jadi, CRUD dengan nama + satuan
- Gudang: tab baru "Bahan" (di sebelah "Stok") → Barang Masuk, Kirim ke Produksi, Kotak Pantau + Riwayat
- Produksi: tab baru "Barang Jadi" (di sebelah "Stok") → Catat Produksi, Kirim ke Gudang, Kotak Pantau + Riwayat

## Privasi Harga per-Produk (Sept 2026)
- Field `hide_price: bool` ditambahkan ke schema `Product` (create/update/read).
- Superadmin dapat toggle "Sembunyikan Harga dari Sales" per-produk di halaman `Produk & Harga`.
- Global toggle `hide_prices_from_sales` di Settings dihapus/diarahkan ke per-produk (halaman Settings sekarang menampilkan link ke Produk & Harga).
- Di aplikasi Sales:
  - `transaction/new.tsx`: baris harga "Rp XX / unit" tidak ditampilkan bila `product.hide_price = true`.
  - `transaction/[id].tsx` (detail transaksi): untuk role Sales, item dengan `hide_price = true` menyembunyikan "× Rp XXX" dan subtotal, hanya menampilkan qty + unit.
- Total transaksi tetap ditampilkan agar Sales tetap tahu total yang harus dibayar customer.

## Privasi Harga per-Role (Sept 2026 v2)
- Refactor field ke `hide_price_roles: List[str]` di schema `Product` (create/update/read).
- Field lama `hide_price: bool` dipertahankan sebagai mirror ("sales" in hide_price_roles) untuk backward compat.
- UI Superadmin `Produk & Harga` menampilkan 4 checkbox role per produk: Sales, Admin, Gudang, Produksi.
- Legacy migration: bila `hide_price=true` & `hide_price_roles=[]` (data lama), diperlakukan seolah `["sales"]`.
- Efek saat ini:
  - Sales `transaction/new.tsx` menyembunyikan baris harga produk bila role "sales" ada di list.
  - Detail transaksi Sales (`transaction/[id].tsx`) TETAP menampilkan harga (per keputusan bisnis: Sales berhak lihat harga dari transaksi yang dia buat sendiri).
  - Admin/Gudang/Produksi belum menampilkan harga produk di UI saat ini — toggle disimpan untuk masa depan (future-proof).

## Akses Produk per-Wilayah / per-Sales (Sept 2026)
- Field baru di schema `Product`:
  - `allowed_groups: List[str]` — group letters (mis. ["Z"])
  - `allowed_sales: List[str]` — sales_codes (mis. ["Z1","Z2"])
- Default keduanya `[]` = produk **terbuka untuk semua sales** (backward compatible dengan produk lama).
- UI Superadmin `Produk & Harga` → editor produk menampilkan section **"Akses Produk (Prioritas Wilayah/Sales)"** dengan:
  - Chip **Wilayah** (di-generate dari group letters unik yang aktif di user Sales)
  - Chip **Sales Spesifik** (list semua user role=sales dengan format "CODE · Nama")
  - Tombol "Bersihkan (buka untuk semua)" untuk reset cepat
- Card produk menampilkan badge **"🔒 Khusus Wilayah Z · Z1, Z2"** bila ada restriction.
- Efek Sales:
  - `transaction/new.tsx` filter client-side: produk hanya muncul bila `allowed_groups=[]` & `allowed_sales=[]` (open) ATAU user.group_letter cocok ATAU user.sales_code cocok.
  - Filter berlaku baik saat online (network fetch) maupun offline (cached products).

## Barang Jadi — Repair/Rusak Flow (Sept 2026)
- **Backend**: Collection `damage_movements` (kind: return | repair_done | write_off, source: repair | produksi).
- Endpoints: 
  - POST /api/inventory/damage/return (Gudang → antrian Repair Produksi)
  - POST /api/inventory/damage/repair-done (Repair → Stok Produksi)
  - POST /api/inventory/damage/write-off (source: repair atau produksi → Rusak permanen)
  - GET /api/inventory/damage/list
- Stock endpoint sekarang return `repair` & `rusak` count per barang.
- **Frontend Produksi (Barang Jadi tab)**: 4 tombol (Catat Produksi, Kirim, Selesai Repair, Rusak Permanen). Tabel 5 kolom + riwayat lengkap.
- **Frontend Gudang (Bahan tab)**: Section "Barang Jadi di Gudang" dengan tombol "Return Rusak" + riwayat return.
- Alur: Produksi cetak → Kirim Gudang → (rusak?) Gudang Return → antrian Repair Produksi → Selesai Repair → kembali ke Stok Produksi (atau Write-off jika parah).

## Stok Bahan di Produksi (Sept 2026)
- **Frontend Produksi (Stok tab)**: Ditambah "Kotak Pantau Stok Bahan" (Gudang | Produksi) di atas panel Sparepart + Riwayat Bahan Masuk dari Gudang.

## Password Persistence Safeguard (Sept 2026)
- Seed default users di `services/seed.py` sekarang di-gate dengan flag `initial_user_seed_done` di collection settings.
- Efek: Setelah seed pertama kali sukses, seed users TIDAK akan re-inject default password ke akun yang dihapus/diedit.

## Input Harian Produksi — Placeholder 0 (Sept 2026)
- Kolom manual_adjust / manual_adjust_before default kosong (placeholder abu-abu "0") bukan "0".

## Kelola User — Pencarian (Sept 2026)
- Tambah TextInput pencarian di atas daftar user. Mendukung filter nama, username, sales_code, group_letter, kelompok. Kompatibel dengan tab role.

## Koordinat Manual Pelanggan (Sept 2026)
- Form Edit Pelanggan (Sales) sekarang punya 2 kolom (Latitude & Longitude) opsional.
- Berlaku juga di Superadmin/Admin edit (menggunakan form yang sama).
- Kosongkan keduanya → hapus koordinat. Validasi angka.

## GPS Auto-Update (Verified)
- Foreground ping tiap 120s untuk Sales role sudah aktif (`(sales)/_layout.tsx`), guard 08:00–17:00 baik di client maupun backend (`locations.py`).

## Live Map — Wilayah Filter (Sept 2026)
- `(admin)/live.tsx` (dipakai juga oleh Superadmin) tambah chip filter Wilayah (multi-select) + search bar.
- Filter berlaku ke marker sales, marker pelanggan, dan list sales di bawah peta.
- Empty state khusus ketika filter kosong.

## Impersonation — Kembali ke Superadmin (Sept 2026)
- `stopImpersonation` di AuthContext sekarang:
  - Purge offlineStore (buang cache milik user impersonated)
  - Navigate DIRECTLY ke `/(superadmin)/dashboard` (bukan lewat `/` index) — 3× retry (0/200/700 ms)
- Banner sticky "Kembali" tetap ada di atas.

## Rute Kunjungan Optimal (Sales, Sept 2026)
- Chip sort baru "Rute Optimal" di halaman Pelanggan Sales.
- Ambil GPS foreground, greedy nearest-neighbor sort atas pelanggan yang punya lat/lng.
- Pelanggan tanpa koordinat digeser ke akhir list (badge "—").
- Setiap baris menampilkan jarak dari pemberhentian sebelumnya (m / km).
- Bar biru info: Rute dari GPS Anda + tombol reload GPS.

## Rangkuman Wilayah Bulanan (Sept 2026)
- Endpoint `GET /api/reports/monthly-by-wilayah?year=X&month=Y` return per-wilayah agregat: omzet, bayar, hutang, gln_terjual, trx_count, sales_count, customer_count, customer_active + totals.
- Page: `(superadmin)/wilayah-summary` (link dari Dashboard Superadmin) & mirror `(admin)/wilayah-summary` (link dari Dashboard Admin).
- UI: month navigator, total card, per-wilayah cards dengan bar-chart % share + statistik detail.
- Admin dibatasi ke `group_letter`-nya sendiri; Superadmin lihat semua.
