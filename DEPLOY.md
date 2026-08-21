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
5. `vercel.json` di repo ini sudah berisi SPA fallback (`/(.*)` → `/index.html`)

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

## Catatan

- CORS backend airoxly sudah `allow-origin: *` — tidak perlu perubahan.
- Preview environment Emergent (`oxly-admin.preview.emergentagent.com`) tetap berjalan di root — `basename` dinamis menjaga keduanya.
