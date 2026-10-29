# Const Accounts

[Const Accounts](https://accounts.const.web.id) adalah layanan identitas bersama untuk produk Const. Pengguna dapat masuk dengan Google atau tautan email, lalu kembali ke aplikasi yang memulai sign-in.

## Peran produk

- Sign-in dan pemilihan akun untuk layanan Const.
- Sesi autentikasi bersama melalui backend Convex Auth.
- Pengembalian ke situs Const, client lokal, atau deep link aplikasi yang diizinkan.
- Sign-out dan alur penyelesaian autentikasi.
- Managed OAuth untuk integrasi Google dan GitHub, serta callback integrasi yang didukung aplikasi.

Sign-in Const dan izin integrasi eksternal adalah hal berbeda: login tidak otomatis memberikan akses ke seluruh layanan Google atau GitHub. Integrasi tetap memerlukan consent dan scope yang sesuai.

Accounts bukan password manager atau dashboard billing. Data profil dan autentikasi dikelola bersama backend; secret OAuth tetap berada pada konfigurasi server.

## Menggunakan

Buka Accounts langsung atau ikuti tombol sign-in dari Harness, Learn, atau Router. Setelah autentikasi berhasil, aplikasi mengarahkan kembali ke tujuan yang diizinkan.

## Menjalankan dari source

```sh
pnpm --filter @const/accounts dev
pnpm --filter @const/accounts check-types
pnpm --filter @const/accounts build
```

Perintah dijalankan dari root setelah `pnpm install`. Web memakai port 3001. Setup lokal memerlukan deployment Convex dan konfigurasi autentikasi Google/email di backend. Managed connectors juga memerlukan konfigurasi OAuth server masing-masing; lihat nama environment variable di `src/lib/google-oauth.ts` dan `src/lib/github-oauth.ts`, bukan nilai secret.
