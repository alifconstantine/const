# Const Harness

[Const Harness](https://harness.const.web.id) adalah workbench AI desktop untuk mengerjakan coding, riset, dokumen, dan pekerjaan kreatif dengan konteks file dan tools yang sama.

Percakapan berada di samping file preview, diff, terminal, browser, dan hasil kerja. Hubungkan proyek, pilih model, beri tugas yang jelas, lalu periksa perubahan dan output sebelum digunakan.

## Yang bisa dikerjakan

- Membaca proyek, mengedit file, menjalankan perintah, dan memeriksa hasil lewat diff dan tests.
- Menggunakan browser untuk riset dan memverifikasi situs yang sedang dibuat.
- Menghubungkan model reasoning, speech, image, dan video sesuai protokol yang didukung.
- Menambahkan plugins, reusable skills, dan MCP servers.
- Mendelegasikan pekerjaan independen ke subagents dengan jejak eksekusi.
- Menjalankan tugas berulang saat aplikasi desktop dan komputer tetap berjalan.
- Mengendalikan workspace desktop melalui sesi remote yang dipasangkan dari browser atau ponsel.

Computer use bergantung pada sistem operasi, helper, dan izin yang dikonfigurasi. Remote control memerlukan host yang aktif; client web tidak menjalankan agent lokal secara mandiri. Installer yang tersedia ditentukan oleh aset rilis, bukan sekadar target build.

## Permukaan produk

| Folder               | Peran                                                                                |
| -------------------- | ------------------------------------------------------------------------------------ |
| [desktop](desktop/)  | Aplikasi Electron/Vite untuk Windows, macOS, dan Linux; pemilik runtime kerja lokal. |
| [web](web/README.md) | Situs produk, download, docs, halaman legal, dan entry point remote.                 |

Harness berfokus pada desktop dan remote web. Stub CLI lama sudah dihapus. Library terminal di `packages/` tetap terpisah karena masih dipakai oleh paket coding-agent.

## Mulai menggunakan

Buka [Downloads](https://harness.const.web.id/download), lalu ikuti [Your first task](https://harness.const.web.id/docs/getting-started). Untuk provider sendiri atau Const Router, gunakan Settings → Models. Tambahkan MCP lewat Settings → MCP servers.

Local-first berarti workspace disimpan di perangkat. Permintaan ke model, integrasi, dan remote relay memiliki alur data sendiri; lihat [Privacy & data](https://harness.const.web.id/docs/privacy-and-data).

## Menjalankan dari source

Dari root monorepo setelah `pnpm install`:

```sh
pnpm --filter @const/harness-desktop dev
pnpm --filter @const/harness-web dev
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-web check-types
```

Script dev/build web menyiapkan bundle remote dari desktop terlebih dahulu. Web memakai port 3011. Konfigurasi provider dan layanan account/backend diperlukan untuk fitur terhubung; jangan memasukkan secret ke repository.
