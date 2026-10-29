# Const Learn

[Const Learn](https://learn.const.web.id) adalah workspace belajar yang berangkat dari materi milik pengguna. Kumpulkan sumber, ajukan pertanyaan, lalu ubah materi menjadi artefak yang membantu memahami dan mengingatnya.

## Alur belajar

1. Buat workspace belajar dan kelompokkan materi dengan collections.
2. Tambahkan sumber melalui format dan koneksi yang didukung client.
3. Bahas materi bersama model AI yang dikonfigurasi.
4. Buat artefak studio: kuis, flashcard, mind map, cheatsheet, laporan, presentasi, audio, atau video sesuai model dan tools yang tersedia.
5. Buka hasilnya, periksa kembali terhadap sumber, lalu revisi atau ekspor lewat kontrol yang tersedia.

Hasil AI tetap perlu diperiksa. Dukungan generasi media bergantung pada provider, kredensial, tools, dan platform; tidak semua koneksi model menyediakan semua jenis output.

## Aplikasi

| Folder              | Peran                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| [desktop](desktop/) | Workspace Electron/Vite dengan local project context dan penyimpanan lokal. |
| [mobile](mobile/)   | Client React/Vite dan Capacitor Android untuk alur belajar mobile.          |
| [web](web/)         | Situs publik untuk mengenalkan Learn.                                       |
| [skills](skills/)   | Instruksi pendukung workflow, termasuk presentasi.                          |

Workspace dan artefak lokal memakai penyimpanan client. Fitur akun dan records terhubung juga memiliki backend Convex. Permintaan ke model dan integrasi dapat mengirim materi ke penyedia terkait; local storage tidak berarti semua pemrosesan berjalan offline.

## Menjalankan dari source

```sh
pnpm --filter @const/learn-web dev
pnpm --filter @const/learn-desktop dev
pnpm --filter @const/learn-mobile dev
pnpm --filter @const/learn-desktop check-types
pnpm --filter @const/learn-mobile check-types
```

Jalankan dari root setelah `pnpm install`. Situs web memakai port 3006. Fitur terhubung memerlukan konfigurasi akun, backend, dan model. Client Android dapat disinkronkan dengan `pnpm --filter @const/learn-mobile sync:android` setelah toolchain Android tersedia. Ketersediaan installer mengikuti rilis yang dipublikasikan.
