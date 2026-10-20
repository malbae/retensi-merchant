# Database bersama Cloudflare

Mode yang diminta pengguna: prototype publik dengan pilihan role demo. Semua pengunjung yang memiliki link dapat memilih role demo dan berbagi database yang sama.

Database D1 `retensi-merchant`: `8992a1a2-7b04-4de9-9ed2-1f47c3f1eb3b`. Binding `DB` dan `PUBLIC_PROTOTYPE=true` dideklarasikan pada `wrangler.jsonc`. Tabel dibuat menggunakan migrasi 0001 melalui D1 Console.

## Infrastruktur

1. Buat D1 `retensi-merchant`, jalankan `migrations/0001_shared_database.sql` melalui D1 Console.
2. Tambahkan binding D1 bernama `DB` pada proyek Pages `retensi-merchant` (production).
3. Untuk penggunaan terbatas nanti, ubah `PUBLIC_PROTOTYPE` menjadi `false` dan buat aplikasi Cloudflare Access untuk seluruh domain `retensi-merchant.pages.dev`, termasuk `/api/*`. Gunakan login email OTP dengan daftar email yang diizinkan.
4. Tambahkan variabel Pages:
   - `ACCESS_TEAM_DOMAIN`: domain tim Cloudflare Access.
   - `ACCESS_AUD`: audience dari aplikasi Access.
   - `USER_ROLES`: JSON pemetaan email lowercase ke `BM`, `RM`, atau `OPS`.
5. `shared-database.js` otomatis terhubung sebelum login di domain produksi. Untuk mode Access, gunakan identitas server untuk role dan hapus login demo dari UI.
6. Event `merchantdb:sync` memuat ulang portfolio dan ranking; draft formulir dipertahankan, dan perubahan bersamaan pada merchant sama meminta pengguna membuka ulang detail.

## Perilaku

- Data performance, periode, registrasi, dan potensi menggunakan database pusat.
- Pada prototype publik, role dikirim dari pilihan login demo. Potensi hanya dapat diubah dengan role RM; role ini bukan mekanisme otorisasi produksi karena semua pengunjung dapat memilihnya.
- Polling perubahan setiap lima detik hanya mengambil record dengan versi berbeda.
- Patch per bagian digabungkan jika tidak bentrok; perubahan bersamaan pada field sama ditolak dengan pesan konflik.
- Perubahan baru dianggap berhasil setelah server menyimpan. Koneksi gagal tidak boleh dilaporkan sebagai sukses atau disimpan diam-diam sebagai data bersama.
- Data lokal lama tidak diupload otomatis. Ekspor backup lokal terlebih dahulu; pilih sumber data awal dengan pengguna lalu import satu kali.
- API menolak akses selama konfigurasi autentikasi belum lengkap.
