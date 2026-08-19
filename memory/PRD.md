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
