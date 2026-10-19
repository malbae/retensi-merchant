# Retensi Merchant

Dashboard decision-support untuk prioritas retensi merchant EDC dan Livin' Merchant.

## Menjalankan lokal

Buka folder ini melalui web server statis, misalnya:

```bash
python3 -m http.server 4173
```

Kemudian buka `http://localhost:4173`.

## Database

Input potensi merchant, evidence, action log, dan audit trail disimpan dalam IndexedDB bernama `retensi-merchant-db`. Data lama dari `localStorage` dimigrasikan otomatis ketika aplikasi dibuka.

Database ini cocok untuk prototype statis karena tidak memerlukan kredensial atau backend. Data tersimpan per browser/per perangkat. Gunakan menu **Database & backup** untuk membuat file backup JSON atau memulihkan data.

Untuk penggunaan multi-user/produksi, pindahkan implementasi `MerchantDB` di `database.js` ke API backend dengan autentikasi/SSO. Jangan menaruh service key database di repository atau JavaScript browser.

## Deploy dari GitHub

Repository tetap dapat digunakan sebagai sumber deploy Netlify. `netlify.toml` mempublikasikan root repository sehingga setiap push ke branch deploy akan membangun versi terbaru tanpa langkah build tambahan.
