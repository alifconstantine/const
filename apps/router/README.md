# Const Router

[Const Router](https://router.const.web.id) menghubungkan aplikasi ke model AI melalui API yang kompatibel dengan format OpenAI. Dashboard menyatukan model, API keys, combos, kuota, penggunaan, dan kredit.

## Yang tersedia

- Katalog model dan konfigurasi provider.
- API keys dengan pengaturan akses serta batas penggunaan.
- Combos untuk merangkai pilihan model dan strategi eksekusinya.
- Playground generation dan riwayat percakapan.
- Log request, metrik penggunaan, kuota, dan catatan kredit.
- Endpoint pencarian web, ekstraksi halaman, transkripsi audio, dan transkrip YouTube.

Ketersediaan model, akses gratis/berbayar, dan saldo mengikuti katalog serta konfigurasi layanan. Halaman kredit/deposit bukan janji adanya metode pembayaran otomatis tertentu.

## API

Base URL: `https://router.const.web.id/v1`. Kirim API key melalui `Authorization: Bearer <key>` pada endpoint yang memerlukan autentikasi.

| Method | Endpoint                   | Kegunaan                                                       |
| ------ | -------------------------- | -------------------------------------------------------------- |
| POST   | `/v1/chat/completions`     | Chat, streaming, tool calls, dan combos.                       |
| GET    | `/v1/models`               | Katalog publik; autentikasi dapat menambahkan combos pengguna. |
| POST   | `/v1/audio/transcriptions` | Transkripsi audio.                                             |
| POST   | `/v1/search`               | Pencarian dan riset web.                                       |
| POST   | `/v1/fetch`                | Ekstraksi konten URL publik.                                   |
| POST   | `/v1/transcript`           | Ekstraksi caption YouTube publik.                              |

Lihat [API Docs](https://router.const.web.id/docs) untuk payload dan contoh penggunaan. Kontrak route yang dipakai dashboard berada di `src/lib/api-contract.ts`.

## Data dan kontrol

Request dikirim ke provider yang digunakan. Router menyimpan metrik dan catatan operasional; pengaturan payload logging dapat menyimpan prompt yang dipotong, sedangkan pengaturan telemetry memengaruhi penyimpanan IP/user agent. Jangan mengasumsikan seluruh request bersifat tanpa log.

## Menjalankan dari source

```sh
pnpm --filter @const/router dev
pnpm --filter @const/router check-types
pnpm --filter @const/router test
pnpm --filter @const/router build
```

Web memakai port 3002. Diperlukan backend Convex, autentikasi Accounts, dan konfigurasi provider di sisi layanan. Jangan menyimpan API key atau encryption secret dalam source.
