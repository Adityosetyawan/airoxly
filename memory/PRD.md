# PRD — Air OXLY Web Admin Dashboard

## Problem Statement (asli)
Web admin companion untuk airoxly (Expo tetap untuk lapangan). v1 fokus: Login (JWT + RBAC) dan Dashboard Overview (kartu ringkasan, grafik tren harian/mingguan/bulanan, konten per-role, guard rute, state error/empty/loading jelas). Target: SuperAdmin (akses penuh), Admin (operasional), Sales (read-only data sendiri). Backend: numpang FastAPI + MongoDB airoxly. UI Bahasa Indonesia.

## Keputusan & Deviasi dari Plan
- URL API airoxly asli belum diberikan user → dibangun **backend replica** (FastAPI + MongoDB lokal environment) yang meniru endpoint airoxly (`/api/auth/*`, `/api/overview`, `/api/reports/trend`) dengan data seed realistis (420 hari). Saat integrasi nanti: cukup ganti base URL/ENV ke backend airoxly asli.
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

## Backlog Prioritas
- P0 (Fase 2): Tabel CRUD customers, products, transactions, expenses + export CSV/PDF
- P1: Integrasi backend airoxly asli (ganti base URL, cocokkan skema endpoint), deploy sub-path /admin di Vercel
- P1 (Fase 3): Live Map + user & role management
- P2 (Fase 4): warehouse, production, shifts, AI Vision, import Excel, reminder pelanggan
- P2: Migrasi TypeScript + Vite, refresh token flow penuh, lupa/reset password UI

## Next Tasks
1. Konfirmasi URL API airoxly production + skema endpoint asli untuk integrasi.
2. Mulai Fase 2: modul CRUD pertama (disarankan: Pelanggan lalu Transaksi).
