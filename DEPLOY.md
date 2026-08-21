# Deploy Air OXLY Admin ke Vercel (sub-path /admin)

Tujuan: web admin tampil di `https://<domain-utama>/admin` tanpa menabrak PWA Expo yang ada di root domain.

## Arsitektur deploy

- Repo ini (folder `frontend`) → project Vercel **terpisah**, mis. `oxly-admin.vercel.app`
- Project Vercel **PWA utama** menambahkan rewrite `/admin/*` → deployment admin
- Build admin memakai `PUBLIC_URL=/admin` (inline di script `build` pada package.json — craco mengabaikan PUBLIC_URL dari `.env.production`) sehingga aset diminta dari `/admin/static/...`; dev/preview tetap di root via `PUBLIC_URL=/` di `.env`
- Router memakai `basename` dari `PUBLIC_URL` — otomatis "/" saat dev/preview, "/admin" saat build produksi

## Langkah 1 — Project admin (repo ini)

1. Import repo ke Vercel → pilih root directory `frontend`
2. Framework preset: **Create React App** (build `yarn build`, output `build`)
3. Environment variable (atau sudah tercakup via `.env.production`):
   - `REACT_APP_AIROXLY_API_URL=https://oxly-crm.emergent.host`
4. Deploy → dapat URL, mis. `https://oxly-admin.vercel.app`
5. `vercel.json` di repo ini sudah berisi: paksa yarn (`installCommand`/`buildCommand`), rewrite `/admin/static/* → /static/*` (agar URL standalone `*.vercel.app/admin` langsung berfungsi), dan SPA fallback ke `index.html`

## Langkah 2 — Project PWA utama (repo airoxly Expo/web)

Tambahkan rewrite di `vercel.json` milik project PWA (domain utama):

```json
{
  "rewrites": [
    { "source": "/admin", "destination": "https://oxly-admin.vercel.app/" },
    { "source": "/admin/:path*", "destination": "https://oxly-admin.vercel.app/:path*" }
  ]
}
```

Alur: browser minta `/admin/customers` → rewrite → admin deployment `/customers` → SPA fallback → `index.html`. Aset `/admin/static/...` → rewrite → `/static/...` (file ada di output build CRA).

## Langkah 3 — Service worker PWA (WAJIB dicek)

Service worker PWA root (scope `/`) bisa menangkap navigasi ke `/admin`. Di konfigurasi PWA:

- Workbox: tambahkan `/^\/admin\//` ke `navigateFallbackDenylist`
- Atau daftarkan SW dengan scope lebih sempit bila memungkinkan

Uji: buka `https://<domain>/admin` dalam mode penyamaran (tanpa cache) dan pastikan tidak di-serve oleh SW PWA.

## Langkah 4 — Verifikasi

| Cek | Cara |
|---|---|
| `/admin` membuka halaman login | browser |
| Login superadmin → dasbor | kredensial di `/app/memory/test_credentials.md` |
| Refresh di `/admin/transactions` tidak 404 | browser refresh |
| Aset termuat dari `/admin/static/...` | DevTools → Network |
| API mengarah ke `oxly-crm.emergent.host` | DevTools → Network |
| PWA root `/` tidak terganggu | browser |

## Troubleshooting build Vercel (semua sudah teratasi di repo)

1. **Gagal ~6 detik setelah "Installing dependencies" tanpa pesan** → pin `packageManager: yarn@...` memicu corepack download yang gagal. Sudah dihapus dari package.json.
2. **Gagal build ±1 menit, log berhenti di tengah** → Vercel menset `CI=true`; CRA mengubah warning ESLint jadi error. Semua warning sudah dibersihkan (terverifikasi `CI=true yarn build` lolos 0 warning).
3. **`Error: Command "npm run build" exited with 1` + stack `ajv-keywords`/`schema-utils`/`terser-webpack-plugin`** → Vercel memakai npm (yarn.lock tidak ikut ter-push) dan pohon npm kena konflik ajv@8 vs ajv-keywords@3. Sudah dipaksa yarn via `installCommand: "yarn install"` + `buildCommand: "yarn build"` di `frontend/vercel.json`.
4. **Deploy Ready tapi halaman blank (console: `Unexpected token '<'`)** → aset dibangun dengan prefix `/admin/static/*` (PUBLIC_URL) tapi file fisik ada di `/static/*`; rewrite SPA yang rakus mengembalikan index.html untuk request aset. Sudah diperbaiki dengan rewrite eksplisit `/admin/static/:path* → /static/:path*` (+ manifest/favicon) sebelum fallback `index.html`.

## Catatan

- CORS backend airoxly sudah `allow-origin: *` — tidak perlu perubahan.
- Preview environment Emergent (`oxly-admin.preview.emergentagent.com`) tetap berjalan di root — `basename` dinamis menjaga keduanya.
