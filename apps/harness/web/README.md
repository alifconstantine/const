# Const Harness Web

Situs publik [Const Harness](https://harness.const.web.id): pengenalan workbench, integrasi, ekosistem, dokumentasi penggunaan, download, dan entry point remote control.

## Halaman

| Route                                  | Isi                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/`                                    | Landing page utama dengan aset visual yang sudah tersedia.                               |
| `/product`                             | Alur kerja proyek, tools, dan review.                                                    |
| `/integrations`                        | Models, skills, plugins, MCP, dan browser/computer use.                                  |
| `/ecosystem`                           | Peran Harness, Learn, Router, dan Accounts.                                              |
| `/docs`                                | Indeks panduan dengan tujuh topik penggunaan.                                            |
| `/docs/[slug]`                         | Setup, models, projects, tools, remote, schedules, dan data.                             |
| `/download`                            | Installer yang ditemukan dari aset GitHub Releases, dengan fallback saat tidak tersedia. |
| `/privacy-policy`, `/terms-of-service` | Draf legal dengan identitas operator dan kontak placeholder yang ditandai jelas.         |
| `/r/[sessionId]`, `/remote/*`            | Sesi desktop yang dipasangkan dan bundle aset remote yang dihasilkan build.                                    |

Navigasi dan footer mengikuti lima bahasa situs. Artikel baru saat ini berbahasa Inggris, ditandai `lang="en"`; docs juga menjelaskan ketersediaan bahasanya. Konten docs berada di `src/content/docs.ts`, legal di `src/content/legal.ts`, dan CSS halaman baca di `src/app/content.css`.

Halaman legal **belum final**: ganti email `.example` dengan kanal yang dipantau, finalisasi jadwal retensi dan praktik deployment, lalu tinjau kebijakannya sebelum dipublikasikan sebagai ketentuan resmi. Kedua draf memakai `noindex`.

## Pengembangan

Dari root monorepo:

```sh
pnpm --filter @const/harness-web dev
pnpm --filter @const/harness-web check-types
pnpm --filter @const/harness-web build
```

Dev server berjalan di port 3011. Script dev/build menyiapkan bundle remote dari desktop. Halaman dokumentasi dan produk tidak memerlukan koneksi ke model untuk dirender. Download mengambil metadata rilis publik dengan timeout dan fallback tanpa membuat URL installer yang ditebak.
