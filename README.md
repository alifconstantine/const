# Const

Const adalah ekosistem produk AI untuk membuat sesuatu, memahami materi, dan menghubungkan model dengan alat kerja. Monorepo ini berisi aplikasi produknya beserta paket yang dipakai bersama.

## Produk

| Produk                                    | Untuk apa                                                                                                                            | Source                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| [Harness](https://harness.const.web.id)   | Workbench desktop untuk coding, riset, dan pekerjaan kreatif: percakapan, file proyek, tools, browser, dan review dalam satu tempat. | [apps/harness](apps/harness/README.md)   |
| [Learn](https://learn.const.web.id)       | Workspace belajar berbasis sumber, percakapan, dan artefak seperti kuis, flashcard, mind map, laporan, dan presentasi.               | [apps/learn](apps/learn/README.md)       |
| [Router](https://router.const.web.id)     | Gateway AI dengan API kompatibel OpenAI, model combos, API keys, kuota, kredit, dan log penggunaan.                                  | [apps/router](apps/router/README.md)     |
| [Accounts](https://accounts.const.web.id) | Identitas dan sign-in bersama untuk layanan Const serta alur OAuth integrasi yang didukung.                                          | [apps/accounts](apps/accounts/README.md) |
| [Const](https://const.web.id)             | Portal pengenalan ekosistem.                                                                                                         | [apps/landing](apps/landing/README.md)   |

Harness menyimpan workspace secara lokal. Penggunaan model, tools, dan layanan yang terhubung tetap dapat mengirim konteks ke penyedia terkait. Learn memiliki aplikasi desktop, client mobile Android, dan situs pengenalan; ketersediaan installer mengikuti rilis yang dipublikasikan.

## Di dalam monorepo

`apps/` berisi produk dan situsnya. `packages/` berisi backend Convex, UI bersama, runtime agent dan model, protokol/client/server, remote transport, telemetry, session storage, serta konfigurasi TypeScript. Paket terminal seperti `packages/tui` adalah library internal, bukan janji adanya produk Harness TUI.

Panduan penggunaan Harness tersedia di [Docs](https://harness.const.web.id/docs). Kontrak endpoint Router tersedia di [Router Docs](https://router.const.web.id/docs). README masing-masing produk menjelaskan fitur dan cara menjalankannya dari source.

## Menjalankan dari source

Gunakan Node.js yang didukung oleh versi Next.js/Vite di workspace dan versi pnpm pada field `packageManager` di [package.json](package.json).

```sh
pnpm install
pnpm --filter @const/harness-web dev
```

Jalankan produk yang dibutuhkan, bukan semua workspace sekaligus:

```sh
pnpm --filter @const/landing dev
pnpm --filter @const/accounts dev
pnpm --filter @const/router dev
pnpm --filter @const/learn-web dev
pnpm --filter @const/harness-desktop dev
pnpm --filter @const/learn-desktop dev
```

Layanan terhubung memerlukan konfigurasi backend dan kredensial masing-masing. Backend dapat dijalankan dengan `pnpm --filter @const/backend dev` setelah deployment Convex dan autentikasinya dikonfigurasi. Jangan menaruh secret di source atau README.

Untuk verifikasi, gunakan `pnpm --filter <nama-paket> check-types` dan script build/test paket terkait. `pnpm build` menjalankan pipeline monorepo melalui Turborepo.
