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

## Fase 4 (sebagian) — Gudang, Produksi, Shift (21 Agu 2026)
- [x] Gudang (/warehouse): 8 kartu stok, tab Barang Masuk + Transfer Sparepart (catat), tab Laporan Harian (CRUD), guard duplikat (date+shift+sales) di frontend
- [x] Produksi (/production): list + filter tanggal/shift, form lengkap (hasil produksi, part diganti, sisa), draft saat create, CRUD + guard duplikat
- [x] Shift (/shifts): tambah/edit/hapus via PUT array penuh
- [x] Testing iterasi 5+6: 100% lulus (6/6 retest); fix field `note` barang masuk; guard duplikat via pre-check API (tidak bergantung filter aktif) sebagai mitigasi bug upsert backend
- [!] Insiden saat tes (21 Agu): bug backend POST /warehouse/daily & /production/daily = UPSERT diam-diam per (date, shift, sales_id) → 2 record operator (warehouse `81490340`, production `67b5aba0`) tertimpa payload uji lalu terhapus. Konten asli kedua record terekam di log probe main agent (dapat direstorasi manual bila perilaku backend dibetulkan)
- [!] Bug backend dilaporkan ke pemilik airoxly: (1) upsert diam-diam harusnya 409/create-baru, (2) GET /api/warehouse/transfers & /stock-split → 500

## Deploy Vercel sub-path /admin (21 Agu 2026)
- [x] Build script `PUBLIC_URL=/admin craco build` + BrowserRouter `basename` dinamis (PUBLIC_URL) — preview Emergent tetap jalan di root. Catatan: craco mengabaikan PUBLIC_URL dari `.env.production`, harus inline di script build.
- [x] `frontend/vercel.json` (SPA fallback) + `frontend/.env.production` (REACT_APP_AIROXLY_API_URL)
- [x] `/app/DEPLOY.md`: panduan lengkap — project Vercel terpisah untuk admin, rewrite `/admin/*` di project PWA utama, cek service worker (`navigateFallbackDenylist`), checklist verifikasi
- [x] Build produksi terverifikasi: aset ter-prefix `/admin/static/*`
- [x] Replica backend diselaraskan (login menerima `username`, query ber-projection + limit) — deployment_agent pass
- [x] Fix build Vercel (deploy pertama gagal di "Installing dependencies" ~6 detik): hapus pin `packageManager` yarn (memicu corepack download yang gagal), tambah `engines.node=20.x`, tambah `.npmrc` legacy-peer-deps; lockfile terverifikasi install bersih via cache folder baru
- [x] Fix build Vercel kedua (gagal 1m3s di tahap build): Vercel menset CI=true sehingga warning ESLint jadi error — warning useMemo di LiveMap.jsx diperbaiki (sales & customers dibungkus useMemo); `CI=true yarn build` lokal lolos 0 warning
- [x] Fix build Vercel ketiga: hapus `"version": 2` dari frontend/vercel.json (memicu perilaku platform legacy); simulasi penuh ala Vercel (install dari nol di folder bersih + CI=true build + serve via /admin dengan symlink) lolos end-to-end
- [x] Fix build Vercel keempat: error sebenarnya terlihat — Vercel memakai **npm** (bukan yarn) sehingga pohon dependensi kena konflik klasik `ajv@8` vs `ajv-keywords@3` (stack: schema-utils → terser-webpack-plugin). Fix: `vercel.json` kini memaksa `installCommand: yarn install` + `buildCommand: yarn build`
- [x] Fix runtime Vercel kelima: deploy Ready tapi blank di URL standalone — aset dicari di `/admin/static/*` (PUBLIC_URL) sementara file ada di `/static/*`. Fix: rewrite `/admin/static/:path* → /static/:path*` (+ manifest/favicon) di vercel.json — URL standalone langsung berfungsi, dan di belakang rewrite PWA utama tetap aman (filesystem Vercel didahulukan)
- [x] Fix runtime Vercel keenam: bundle berisi `undefined/api` — file `.env*` difilter Save to GitHub sehingga REACT_APP_AIROXLY_API_URL hilang saat build. Fix: api.js fail-fast dengan pesan jelas + dokumentasi WAJIB set env var di dashboard Vercel (DEPLOY.md)
- [x] **DEPLOY LIVE (22 Agu 2026): https://airoxly-admin.vercel.app/admin** — env var diset di dashboard Vercel → redeploy → testing iterasi 9: 6/6 flow PASS (login superadmin 8 KPI, login sales 6 KPI tanpa Pengeluaran/Setoran, deep link, SPA fallback, CORS, logout)

## Backlog Prioritas
- P1: Eksekusi deploy Vercel mengikuti /app/DEPLOY.md (butuh akses akun Vercel user)
- P2 (Fase 4 sisa): AI Vision, import Excel, reminder pelanggan
- P2 (backend airoxly, di luar repo ini): perbaiki upsert POST warehouse/production daily + 500 di /warehouse/transfers & /stock-split
- P2: Migrasi TypeScript + Vite, refresh token flow penuh, lupa/reset password UI

## Next Tasks
1. (Opsional) Minta pemilik backend airoxly membuka POST /api/customers untuk super_admin/admin bila ingin tambah pelanggan dari web — saat ini backend membatasi create pelanggan ke role sales (by design aplikasi lapangan: butuh foto + GPS).
2. Fase 4 sisa: AI Vision, import Excel, reminder pelanggan.
3. Wiring domain utama: tambah rewrite `/admin/*` → `https://airoxly-admin.vercel.app/:path*` di vercel.json project PWA (Langkah 2 DEPLOY.md) + cek service worker PWA (Langkah 3).
