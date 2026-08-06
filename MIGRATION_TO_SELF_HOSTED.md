# 🚀 Panduan Migrasi Self-Hosted — Air OXLY

Panduan lengkap step-by-step untuk pindah dari Emergent ke hosting sendiri.
**Ditulis untuk pemula** — asumsi Anda belum pernah pakai Linux/SSH/Docker.

**Estimasi total biaya bulanan**: **~Rp 100.000 – 200.000/bulan** (tanpa Emergent).

---

## 📦 Yang Akan Dipakai

| Komponen | Layanan | Biaya | Alasan |
|---|---|---|---|
| **Database** | MongoDB Atlas M0 | **Gratis selamanya** (512MB) | Managed, backup otomatis, tidak perlu setup Linux |
| **Backend** | **Railway.app** (rekomendasi utama) | ~USD 5-10/bulan (Rp 80-150rb) | Deploy dari GitHub, no SSH, dashboard UI |
| **Frontend PWA** | Vercel | **Gratis** (unlimited hobby) | Auto HTTPS, custom domain gratis |
| **APK Android** | Expo EAS Build | **Gratis** (30 build/bulan) | Build cloud, no laptop kencang |
| **Domain** | Niagahoster `.my.id` | Rp 25rb/tahun | Murah, Rupiah, mudah setup |
| **Email support** | (opsional) | 0 | Gmail/Google Workspace |

**Total estimasi**: Rp 100-150rb/bulan + Rp 25rb/tahun domain.

---

## 🎯 Alur Migrasi (Overview)

```
1. Setup MongoDB Atlas ────► dapat MONGO_URL
                                  │
                                  ▼
2. Push kode ke GitHub ──── (butuh 1x)
                                  │
                                  ▼
3. Deploy backend ke Railway ────► dapat URL backend (e.g., https://oxly-api.up.railway.app)
                                  │
                                  ▼
4. Deploy frontend ke Vercel ────► dapat URL PWA (e.g., https://airoxly.vercel.app)
                                  │
                                  ▼
5. (Opsional) Beli domain di Niagahoster & connect
                                  │
                                  ▼
6. (Opsional) Build APK via Expo EAS
                                  │
                                  ▼
   ✅ Sales pakai PWA (buka URL di HP), Admin pakai APK/PWA
```

---

# BAB 1 — Setup MongoDB Atlas (Gratis Selamanya) 🍃

MongoDB Atlas adalah versi cloud dari MongoDB — kita akan pakai tier **M0 Free** (512MB, cukup untuk ~10rb pelanggan + 100rb transaksi).

## Langkah 1.1 — Daftar Akun
1. Buka https://www.mongodb.com/cloud/atlas/register
2. Klik **Sign up with Google** (paling cepat) atau isi email + password
3. Verifikasi email jika diminta

## Langkah 1.2 — Buat Cluster Gratis
1. Setelah login, klik **Create** atau **Build a Database**
2. Pilih tier **M0 (FREE)** — jangan pilih M2/M5 (berbayar)
3. **Provider**: pilih **AWS** (default)
4. **Region**: pilih **Singapore (ap-southeast-1)** — paling dekat ke Indonesia (latency 30-50ms)
5. **Cluster Name**: `oxly-prod` (bebas)
6. Klik **Create** (tunggu 3-5 menit)

## Langkah 1.3 — Buat User Database
1. Setelah cluster jadi, di sidebar klik **Database Access** → **Add New Database User**
2. **Authentication Method**: Password
3. **Username**: `oxly_admin`
4. **Password**: klik **Autogenerate Secure Password** → **COPY & SIMPAN password ini!** (misal di Notes)
5. **Database User Privileges**: pilih **Read and write to any database**
6. Klik **Add User**

## Langkah 1.4 — Allow Network Access
1. Sidebar → **Network Access** → **Add IP Address**
2. Klik **Allow Access from Anywhere** → confirm (IP: `0.0.0.0/0`)
   - ⚠️ Ini agak longgar tapi tidak masalah karena akses tetap butuh password. Untuk lebih aman, nanti bisa lock ke IP Railway saja.
3. Klik **Confirm**

## Langkah 1.5 — Ambil Connection String
1. Sidebar → **Database** → di cluster Anda klik **Connect**
2. Pilih **Drivers**
3. Pilih **Python** + version **3.11 or later**
4. **Copy** connection string yang muncul, formatnya:
   ```
   mongodb+srv://oxly_admin:<password>@oxly-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Ganti `<password>`** dengan password yang Anda copy tadi (Langkah 1.3)
6. **SIMPAN URL LENGKAP INI** — kita butuh nanti di Bab 3.

✅ **MongoDB Atlas selesai!**

---

# BAB 2 — Push Kode ke GitHub 📦

Railway & Vercel deploy dari GitHub. Anda perlu 1x push semua kode ke sana.

## Langkah 2.1 — Buat Akun GitHub
1. Buka https://github.com/signup
2. Daftar dengan email
3. Verifikasi email

## Langkah 2.2 — Buat Repository
1. Login GitHub → klik **+** (kanan atas) → **New repository**
2. **Repository name**: `airoxly`
3. **Privacy**: **Private** (kode Anda tidak dilihat publik)
4. Klik **Create repository**
5. Jangan tutup halaman — nanti kita balik ke sini

## Langkah 2.3 — Download Kode dari Emergent
Di Emergent, klik **Save to GitHub** atau **Export code** (letak menu bisa di kanan atas atau di sidebar). Ini akan push kode ke repo GitHub Anda.

**Alternatif kalau menu tsb tidak ada:**
- Download ZIP kode dari Emergent
- Extract di komputer Anda
- Install [GitHub Desktop](https://desktop.github.com/) (gratis, UI klik-klik)
- Buka GitHub Desktop → **File → Add local repository** → pilih folder yang di-extract
- **Publish repository** → pilih repo `airoxly` yang tadi dibuat

✅ **Kode sudah di GitHub!**

---

# BAB 3 — Deploy Backend ke Railway 🚂

Railway = "Vercel untuk backend" — deploy dari GitHub, tanpa SSH/Docker knowledge.

## Langkah 3.1 — Daftar & Connect GitHub
1. Buka https://railway.app → **Login with GitHub**
2. Authorize Railway akses ke repo Anda

## Langkah 3.2 — Deploy Backend
1. Klik **New Project** → **Deploy from GitHub repo**
2. Pilih repo **airoxly**
3. Railway auto-detect Dockerfile di `backend/Dockerfile` ✅ (sudah kita siapkan)
4. Klik **Deploy** — tunggu 3-5 menit (Railway build image)

## Langkah 3.3 — Set Environment Variables
1. Setelah service jadi, klik service `airoxly` → tab **Variables**
2. Klik **Raw Editor** → paste isi berikut (ganti dengan value Anda):

```env
MONGO_URL=mongodb+srv://oxly_admin:PASSWORD_ANDA@oxly-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=airoxly_prod
JWT_SECRET=GENERATE_RANDOM_HEX_32_KARAKTER_DI_SINI
CORS_ORIGINS=*
```

**Cara generate JWT_SECRET yang random:**
- Buka https://www.random.org/strings/?num=1&len=64&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new
- Copy string yang muncul → paste sebagai JWT_SECRET

3. Klik **Deploy** (Railway auto-redeploy dengan variables baru)

## Langkah 3.4 — Generate Public URL
1. Tab **Settings** → scroll ke **Networking** → **Generate Domain**
2. Railway kasih URL random misal: `https://airoxly-production.up.railway.app`
3. **COPY & SIMPAN URL INI** — ini backend URL Anda

## Langkah 3.5 — Verifikasi Backend Jalan
1. Buka URL Anda + `/api/health` di browser, misal:
   `https://airoxly-production.up.railway.app/api/health`
2. Harus muncul: `{"status":"ok","db":"connected"}`
3. Kalau `db: unreachable` → cek MONGO_URL & password benar
4. Kalau error lain → tab **Deployments → View Logs** untuk lihat error

## Langkah 3.6 — Test Login Default
Buka URL + `/api/auth/login` dengan Postman/curl:
```bash
curl -X POST https://airoxly-production.up.railway.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"super123"}'
```
Harus dapat `access_token` — artinya seed data sudah masuk ✅

✅ **Backend production siap!** (~USD 5/bulan Railway)

---

# BAB 4 — Deploy Frontend PWA ke Vercel 🌐

Vercel deploy web version Air OXLY sebagai PWA. Gratis selamanya untuk hobby project.

## Langkah 4.1 — Daftar & Connect
1. Buka https://vercel.com → **Login with GitHub**
2. Authorize Vercel

## Langkah 4.2 — Import Project
1. Klik **Add New → Project**
2. Pilih repo **airoxly**
3. **Framework Preset**: pilih **Other** (Vercel auto-detect Expo)
4. **Root Directory**: klik **Edit** → pilih **`frontend`** (⚠️ WAJIB)
5. **Build & Development Settings** — auto-terisi dari `vercel.json`. Kalau tidak:
   - Build Command: `yarn build:web`
   - Output Directory: `dist`
   - Install Command: `yarn install --frozen-lockfile`

## Langkah 4.3 — Set Environment Variables
Di section **Environment Variables** (sebelum deploy):
| Name | Value |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | URL Railway Anda dari 3.4, contoh: `https://airoxly-production.up.railway.app` |

**PENTING**: TANPA trailing slash, tanpa `/api` (kode auto-append).

## Langkah 4.4 — Deploy!
1. Klik **Deploy** — tunggu 3-5 menit
2. Setelah selesai, Vercel kasih URL: `https://airoxly.vercel.app`
3. **Buka URL di browser HP** → langsung tampil Air OXLY
4. Bawah layar muncul banner **"Pasang Air OXLY ke Home Screen"** — tap untuk install PWA
5. Icon Air OXLY muncul di home screen HP ✅

## Langkah 4.5 — Update CORS di Railway
Setelah dapat URL Vercel, balik ke Railway → Variables → edit `CORS_ORIGINS`:
```
CORS_ORIGINS=https://airoxly.vercel.app
```
(Ganti dengan URL Vercel Anda). Ini biar backend hanya menerima request dari frontend PWA Anda (lebih aman).

Klik Deploy ulang.

✅ **PWA siap! Sales bisa langsung pakai dari HP mereka.**

---

# BAB 5 — Domain Sendiri (Opsional) 🌍

## Langkah 5.1 — Beli Domain
Rekomendasi: **Niagahoster** (`.my.id` Rp 25rb/tahun) atau **Namecheap** (`.com` ~USD 10/tahun).

**Niagahoster** (Indonesia, Rupiah):
1. Buka https://niagahoster.co.id/domain
2. Cari nama misal `airoxly.my.id`
3. Order → bayar (GoPay/OVO/bank transfer)

**Namecheap** (International):
1. Buka https://namecheap.com
2. Cari domain
3. Bayar credit card

## Langkah 5.2 — Connect Domain ke Vercel
1. Vercel Dashboard → project **airoxly** → **Settings → Domains**
2. Isi **Add Domain**: `airoxly.my.id` (atau domain Anda)
3. Vercel kasih 2 DNS records (**A record** atau **CNAME**)
4. Balik ke Niagahoster/Namecheap → Panel domain → **DNS Management**
5. Tambahkan records sesuai instruksi Vercel
6. Tunggu 5-30 menit untuk DNS propagasi
7. Vercel auto-generate SSL (HTTPS) gratis ✅

## Langkah 5.3 — Update CORS lagi
Railway → Variables → `CORS_ORIGINS`:
```
CORS_ORIGINS=https://airoxly.vercel.app,https://airoxly.my.id
```

## Langkah 5.4 — Sales pakai domain baru
Sales buka `https://airoxly.my.id` di HP → install PWA. Lebih profesional!

---

# BAB 6 — Build APK Android (Opsional) 📱

Kalau Admin/Super Admin lebih suka APK native, gunakan Expo EAS Build (**gratis 30 builds/bulan**).

## Langkah 6.1 — Install Node.js di Komputer
1. Download & install Node.js LTS: https://nodejs.org/
2. Restart komputer

## Langkah 6.2 — Install Expo CLI
Buka Command Prompt / Terminal:
```bash
npm install -g eas-cli
eas login
```
(Login pakai akun Expo — daftar gratis di https://expo.dev)

## Langkah 6.3 — Configure Project
Di folder `airoxly/frontend`:
```bash
cd airoxly/frontend
eas build:configure
```
Pilih **Android** saja untuk sekarang.

## Langkah 6.4 — Update app.json untuk Production
Edit `frontend/app.json`:
```json
{
  "expo": {
    "name": "Air OXLY",
    "slug": "airoxly",
    "extra": {
      "eas": {
        "projectId": "AUTO_ISI_SETELAH_CONFIGURE"
      }
    }
  }
}
```
(projectId auto-terisi setelah `eas build:configure`)

## Langkah 6.5 — Set Backend URL untuk Build
```bash
eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "https://airoxly-production.up.railway.app"
```

## Langkah 6.6 — Build APK!
```bash
eas build --platform android --profile preview
```
Tunggu 10-20 menit. EAS beri URL untuk download `.apk` — kirim ke Admin/SuperAdmin via WA.

✅ **APK siap didistribusi.**

---

# BAB 7 — Backup Rutin MongoDB Atlas 💾

Atlas M0 auto-backup tiap 1 hari (tersimpan 2 hari). Untuk backup lebih lama, download manual:

## Langkah 7.1 — Backup Manual
1. Atlas → **Cluster → …** → **Export**
2. Pilih database `airoxly_prod` → **Export All Collections**
3. Download file `.json.gz` → simpan di Google Drive/laptop

**Frekuensi rekomendasi**: mingguan.

## Langkah 7.2 — (Advanced) Automated backup
Kalau mau auto-backup harian ke Google Drive, saya bisa bantu setup Google Apps Script yang jalankan `mongodump` remote. Kabari kalau butuh.

---

# BAB 8 — Update Kode di Masa Depan 🔄

Setiap Anda edit kode di GitHub:
- **Backend**: Railway auto-deploy ulang saat push ke `main` branch
- **Frontend**: Vercel auto-deploy ulang
- **APK**: harus manual `eas build --platform android` ulang & distribusi

Kalau edit langsung di GitHub Web (klik file → Edit): Railway/Vercel tetap auto-detect & rebuild.

---

# BAB 9 — Ganti dari Emergent (Migration Data) 📤

Kalau ada data di Emergent yang perlu dipindah ke Atlas:

1. Login ke Emergent → panel manage → **MongoDB Export** (jika tersedia)
2. Atau: gunakan `mongodump` dari komputer Anda:
   ```bash
   mongodump --uri="URL_EMERGENT_MONGO" --out=./oxly-backup
   mongorestore --uri="URL_ATLAS" ./oxly-backup
   ```
3. Kalau tidak ada akses ke DB Emergent → jalankan aplikasi Emergent → catat semua data penting manual (customer, transaksi) → input ulang di Atlas via Super Admin panel.

---

# 🆘 Troubleshooting

### Backend Railway crash / 500 error
- Cek **Deployments → View Logs**
- 90% kasus: MONGO_URL salah (typo password, cluster URL salah)

### Frontend Vercel blank screen
- Cek **Function Logs** di Vercel
- Cek console browser (F12 → Console)
- 90% kasus: `EXPO_PUBLIC_BACKEND_URL` salah / ada trailing slash

### Login "Username atau password salah"
- Backend fresh → seed users otomatis dibuat
- Coba: `superadmin` / `super123` (case-sensitive)

### CORS error di browser
- Backend `CORS_ORIGINS` tidak match URL frontend
- Set ke `*` sementara untuk debug, lalu lock ke URL Vercel

### Domain custom belum jalan
- Tunggu 30-60 menit untuk DNS propagasi
- Cek di https://dnschecker.org apakah record sudah tersebar

---

# 📞 Support

Kalau stuck di step manapun:
- **MongoDB Atlas**: docs.atlas.mongodb.com atau chat support di dashboard
- **Railway**: help.railway.app atau Discord https://discord.gg/railway
- **Vercel**: vercel.com/help
- **Niagahoster**: chat live 24/7 di dashboard

---

# 🎉 Selamat!

Setelah semua langkah selesai:
- ✅ Backend jalan di Railway (auto-restart bila crash)
- ✅ Frontend PWA jalan di Vercel (auto-HTTPS)
- ✅ Database di MongoDB Atlas (backup harian gratis)
- ✅ Sales pakai PWA di HP, Admin pakai APK
- ✅ **Biaya bulanan: Rp 100-150rb** (vs Emergent 50 credits/bulan)
- ✅ Kontrol penuh atas data & deployment

**Total setup time**: 2-4 jam untuk pemula (1x setup, seterusnya auto).
