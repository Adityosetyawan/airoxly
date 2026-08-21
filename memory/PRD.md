# PRD — Air OXLY Web Admin Dashboard

## Problem Statement (asli)
Web admin companion untuk airoxly (Expo tetap untuk lapangan). v1 fokus: Login (JWT + RBAC) dan Dashboard Overview (kartu ringkasan, grafik tren harian/mingguan/bulanan, konten per-role, guard rute, state error/empty/loading jelas). Target: SuperAdmin (akses penuh), Admin (operasional), Sales (read-only data sendiri). Backend: numpang FastAPI + MongoDB airoxly. UI Bahasa Indonesia.

## Keputusan & Deviasi dari Plan
- Frontend **sudah terhubung ke backend asli airoxly** (`https://oxly-crm.emergent.host`, env `REACT_APP_AIROXLY_API_URL`, 21 Agu 2026). Backend replica lokal tetap ada sebagai mode demo/dev (fallback bila env dikosongkan).
- Frontend berjalan di **root URL** environment ini (bukan sub-path `/admin`) — konfigurasi Vite base path + rewrite Vercel akan dilakukan saat fase deploy.
- Stack frontend memakai React (CRA/craco) bawaan environment, bukan Vite + TypeScript — migrasi TS bisa dijadwalkan bila diperlukan.

## Arsitektur
- Backend: `/app/backend/server.py` — FastAPI, Motor (MongoDB async), JWT (bcrypt + PyJWT), RBAC per-role, brute-force lockout (5x gagal → 15 menit, identifier per email).
- Frontend: `/app/frontend/src` — React 19, React Router 7, TanStack Query, Recharts, Tailwind + font Cabinet Grotesk / IBM Plex Sans (tema Swiss monochrome, lihat /app/design_guidelines.json).
- DB: MongoDB lokal (`test_database`) — koleksi: users, customers, products, transactions, expenses, login_attempts, app_meta.
- Auth: Bearer token di localStorage (`oxly_token`) + cookie httpOnly cadangan. Kredensial: /app/memory/test_credentials.md.

## User Personas
- SuperAdmin (adityo.setyawan@gmail.com): semua metrik + modul.
- Admin (admin@airoxly.id): sama seperti SuperAdmin di v1.
- Sales (budi.santoso@airoxly.id, sari.dewi@airoxly.id): hanya data miliknya; tanpa Pengeluaran/Laba Kotor; tanpa kolom Sales.

## Yang Sudah Diimplementasikan (21 Agu 2026)
- [x] Login JWT + logout + /auth/me + route guard (redirect /login)
- [x] Dashboard Overview: 5 kartu KPI (Penjualan, Transaksi, Pelanggan Baru, Pengeluaran, Laba Kotor) + delta % vs periode sebelumnya
- [x] Grafik tren (Recharts AreaChart) + filter Harian (14 hari) / Mingguan (12 minggu) / Bulanan (12 bulan)
- [x] Tabel Transaksi Terbaru + panel Ringkasan Periode (rata-rata transaksi, margin laba kotor)
- [x] RBAC ditegakkan di backend (sales difilter via sales_id; metrik sensitif tidak dikembalikan)
- [x] State loading (skeleton), error (dengan tombol Coba Lagi), empty
- [x] Layout sidebar + topbar; menu Fase 2/3 tampil nonaktif sesuai role
- [x] Brute-force protection (diperbaiki: identifier email-only, terverifikasi 429 pada percobaan ke-6)
- [x] Tahan outage backend sesaat: token tidak dihapus saat error jaringan/5xx (fallback decode JWT)
- [x] Testing: 15/16 backend pytest + 100% flow UI Playwright (iteration_1); bug critical diperbaiki & diverifikasi ulang via curl

## Integrasi API Asli (21 Agu 2026)
- [x] Login memakai username + password ke `/api/auth/login` asli; role asli super_admin/admin/sales/produksi/gudang
- [x] KPI di-map dari `/api/stats/overview` (Penjualan/Penerimaan/Transaksi/Galon/Pengeluaran/Setoran hari ini + total pelanggan & transaksi)
- [x] Grafik tren dikomposisi client-side dari `/api/transactions` + `/api/expenses` (bucket harian/mingguan/bulanan) — tanpa endpoint baru
- [x] RBAC sales terverifikasi ditegakkan backend asli (token sales hanya menerima datanya sendiri)
- [x] Cache user (oxly_user) sebagai fallback saat jaringan down (JWT asli tanpa claim role)
- [x] Testing integrasi (iteration_2): 6/6 skenario lulus, 10 request terkonfirmasi ke oxly-crm.emergent.host, 0 ke replica

## Fase 2 — CRUD + Export (21 Agu 2026)
- [x] Halaman Pelanggan (cari, edit, hapus, export CSV + PDF via /api/exports/customers.pdf dengan picker sales)
- [x] Halaman Produk (CRUD lengkap + CSV), Transaksi (filter tanggal/sales, catat transaksi multi-item, edit, hapus, CSV), Pengeluaran (filter tanggal, CRUD, CSV)
- [x] RBAC tulis: SuperAdmin full + hapus; Admin tambah/edit; Sales read-only (terverifikasi UI)
- [x] Penyesuaian RBAC backend asli: create pelanggan dibatasi backend ke role sales → tombol Tambah di web diganti hint "Pelanggan baru ditambahkan sales via aplikasi lapangan"; super_admin terverifikasi bisa PATCH/DELETE customer & full CRUD transaksi (probe API, cleanup 0 residu)
- [x] Testing iterasi 3: 17/18 lulus; mismatch RBAC create-pelanggan diperbaiki; record uji TEST-QA dibersihkan penuh

## Fase 3 — Live Map + User Management (21 Agu 2026)
- [x] Peta Live (/map, super_admin+admin): Leaflet + OpenStreetMap, marker posisi live sales (auto-refresh 30 dtk) + pin pelanggan (toggle), filter per grup, panel Sales Aktif dengan waktu relatif, popup detail
- [x] Pengguna & Peran (/users, khusus super_admin, route guard RequireRole): tabel 108 user, cari + filter peran, tambah user (5 role), edit (nama/role/kode sales/grup/WA/reset password opsional), nonaktifkan/aktifkan (PATCH disabled) — tanpa hapus permanen di UI
- [x] Testing iterasi 4: 100% lulus — RBAC peta & users, toggle disable terverifikasi menolak login API (401), cleanup testqa_user 0 residu

## Backlog Prioritas
- P1: Deploy sub-path /admin di Vercel
- P2 (Fase 4): warehouse, production, shifts, AI Vision, import Excel, reminder pelanggan
- P2: Migrasi TypeScript + Vite, refresh token flow penuh, lupa/reset password UI

## Next Tasks
1. (Opsional) Minta pemilik backend airoxly membuka POST /api/customers untuk super_admin/admin bila ingin tambah pelanggan dari web — saat ini backend membatasi create pelanggan ke role sales (by design aplikasi lapangan: butuh foto + GPS).
2. Fase 4: Gudang, Produksi, Shift, AI Vision (endpoint asli sudah ada: /api/warehouse/*, /api/production/*, /api/shifts, /api/ai/*), import Excel, reminder pelanggan.
3. Siapkan deploy Vercel sub-path /admin (base path + rewrite + cek service worker PWA root).
