# Retensi Merchant

Dashboard decision-support untuk prioritas retensi merchant EDC dan Livin' Merchant.

## Input data performance

Sumber utama dashboard adalah file Excel per kanal. Pilih **Upload data Excel**, lalu tentukan **Merchant EDC** atau **Livin' Merchant**. Sistem memvalidasi dan menampilkan preview sebelum data dipakai.

Kolom wajib: `Nama Merchant`, `Nomor Rekening`, `Sales Volume YTD`, dan `Average Balance`. Template Excel untuk masing-masing kanal tersedia langsung pada halaman upload. Hasil impor disimpan per browser melalui IndexedDB dan menggantikan dataset kanal terkait setelah dikonfirmasi.

## Menjalankan lokal

Buka folder ini melalui web server statis, misalnya:

```bash
python3 -m http.server 4173
```

Kemudian buka `http://localhost:4173`.

## Database

Data performance hasil impor Excel, potensi merchant, evidence, action log, dan audit trail disimpan dalam IndexedDB bernama `retensi-merchant-db`. Data lama dari `localStorage` dimigrasikan otomatis ketika aplikasi dibuka.

Database ini cocok untuk prototype statis karena tidak memerlukan kredensial atau backend. Data tersimpan per browser/per perangkat. Gunakan menu **Database & backup** untuk membuat file backup JSON atau memulihkan data.

Untuk penggunaan multi-user/produksi, pindahkan implementasi `MerchantDB` di `database.js` ke API backend dengan autentikasi/SSO. Jangan menaruh service key database di repository atau JavaScript browser.

## Website GitHub Pages

Website publik utama tersedia di:

<https://malbae.github.io/retensi-merchant/>

GitHub Pages menyajikan file langsung dari repository ini. Setelah perubahan di-push ke branch `main`, tunggu proses publikasi GitHub Pages selesai lalu muat ulang URL tersebut. Bila browser masih menampilkan versi lama, lakukan hard refresh agar cache asset diperbarui.
