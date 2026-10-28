# Audit Remote Control — 28 Oktober 2026

Fokus: workspace desktop yang dibuka lewat Chrome/HP, dari mount renderer,
penyimpanan cache dan pemulihan error sampai streaming, OpenUI, serta input browser.
Alur relay dan snapshot turut dibaca dan dites dengan suite remote yang tersedia.

## Temuan dan perubahan

| Prioritas | Temuan | Penanganan |
| --- | --- | --- |
| P1 | Workspace remote membuat React root sendiri tanpa error boundary. Error render yang lolos dari boundary blok bisa melepas seluruh UI. Boundary Next di halaman induk tidak melindungi root terpisah ini. | Tambah `RemoteWorkspaceBoundary`: tampilkan pemulihan dengan tombol refresh dan catat error beserta component stack di console. Pemulihan tidak menghapus pairing atau riwayat di host. |
| P1 | Proxy `localStorage` meneruskan semua penulisan cache UI ke `sessionStorage`. Penulisan yang melampaui kuota melempar exception ke pemanggil, termasuk pemanggil di effect/render yang tidak menangkap error. | Gunakan cache memori per mount dengan persistensi best effort. Tambahkan dukungan enumerasi dan penghapusan properti agar perilaku proxy konsisten. Scope host dan kredensial pairing tetap terpisah. |
| P2 | Shell fixed dan `overflow: hidden` dari desktop tidak menyediakan alur pull-to-refresh untuk browser HP. | Tambah gesture tarik ke bawah: hanya mulai dari panel yang sudah di atas, gunakan ambang 100 px, beri petunjuk, dan reload saat dilepas. Editor, terminal, dialog, serta gerakan horizontal/multitouch dikecualikan. Gesture yang dibatalkan atau ditarik kembali tidak reload. |
| P2 | Aturan native drag jendela desktop ikut terbawa ke workspace browser, termasuk toolbar. | Paksa `-webkit-app-region: no-drag` khusus subtree remote. Ini menghilangkan semantik native drag yang tidak diperlukan di browser. |

## Batas kesimpulan

- Layar hitam dari sesi pengguna belum direproduksi persis. Tidak ada stack trace
  dari kejadian tersebut. Jalur crash render dan kegagalan kuota adalah temuan
  kode; keduanya belum dapat dinyatakan sebagai penyebab pasti kejadian pengguna.
- OpenUI sudah memiliki `BlockBoundary` di `AssistantResponse` serta boundary
  komponen internal. Belum ada bukti yang menunjuk OpenUI sebagai penyebab utama.
- Tidak ditemukan handler aplikasi yang secara eksplisit membatalkan
  `contextmenu` pada halaman remote. Tes memeriksa pembatalan event pada chat dan
  toolbar, bukan tampilan menu Inspect milik Chrome. Reproduksi pada Chrome asli
  masih diperlukan jika menu tetap tidak muncul.
- Tes touch di Chromium menggunakan event sintetis. Uji gesture fisik di Android
  Chrome dan iOS Safari tetap diperlukan untuk memverifikasi perilaku perangkat.
- Jika persistensi cache gagal, state UI terbaru tersedia di memori selama tab
  itu hidup. Setelah reload, riwayat harus dihidrasi kembali dari desktop; draft
  yang gagal dipersistensikan tidak dijamin bertahan.

## Verifikasi yang disediakan

Hasil: 22 tes remote dan 10 skenario UI lulus. Typecheck, build desktop, build
remote, serta pemeriksaan whitespace diff selesai dengan exit code 0. Tampilan
fixture diperiksa dari tangkapan Chromium offscreen pada 1280×900 dan 390×844:
OpenUI berhasil ditampilkan, UI yang tidak valid memiliki fallback di dalam chat,
dan petunjuk refresh terlihat di atas workspace HP. Ini bukan pengujian di
Chrome/HP pengguna yang tersambung ke desktop produksi.

- `pnpm --filter @const/harness-desktop test:remote`: relay, snapshot, event
  fragments, database, dan regresi penyimpanan cache.
- `pnpm --filter @const/harness-desktop test:remote:ui`: fixture hasil build
  produksi pada Chromium terisolasi, pengiriman prompt sampai jawaban selesai,
  OpenUI valid/tidak valid, event klik kanan, kuota penyimpanan, gesture refresh,
  dan layar pemulihan crash.
- `pnpm --filter @const/harness-desktop check-types`
- `pnpm --filter @const/harness-desktop build:remote`
- `pnpm --filter @const/harness-desktop build`

## Tindak lanjut audit

1. Reproduksi layar hitam dengan model, jawaban, dan perangkat yang sama.
   Gunakan log `[RemoteWorkspace] Render failed` untuk membedakan crash React
   dari tab yang dihentikan browser karena kehabisan memori.
2. Periksa biaya bundle dan chart pada perangkat dengan memori terbatas. Build
   audit menghasilkan entry remote sekitar 8 MB sebelum kompresi; ukuran ini
   adalah alasan untuk mengukur konsumsi memori, bukan bukti penyebab crash.
3. Uji navigasi antar host pada tab SPA yang sama. Beberapa cache modul desktop,
   termasuk cache percakapan dan model, hidup lebih lama daripada mount React;
   isolasi storage saja tidak mereset cache modul tersebut.

## Tambahan: performa sidepanel desktop

Pengujian memakai `AuthenticatedContent` yang juga digunakan desktop, dengan
IPC tiruan dalam Chromium offscreen pada 1280×900. Beban uji: 12 balasan,
masing-masing 16 paragraf. Penghitungan dilakukan pada pemanggilan parser yang
sesungguhnya selama satu siklus buka/tutup sidepanel.

| Pekerjaan | Sebelum | Sesudah |
| --- | --- | --- |
| Parsing blok Markdown tanpa perubahan isi | 72 | 0 |
| Parsing inline tanpa perubahan isi | 1.152 | 0 |

Perubahan pada renderer bersama:

- Cache token berdasarkan isi Markdown, memo komponen token, dan cache HTML
  inline yang sudah disanitasi. Perubahan isi/streaming tetap memperbarui UI.
- Panel, lebar chat, dan pembatas bergerak sinkron selama 280 ms dengan easing
  `cubic-bezier(0.22,1,0.36,1)`. Lebar chat dianimasikan agar tidak meloncat saat
  panel bergeser. Isi tab panel tetap pada ukuran akhirnya dan tetap terpasang;
  animasi panel memakai transform. Cache Markdown menghindari parsing berulang
  selama layout chat berubah. Panel tertutup inert agar tidak menerima fokus.
- Timer reset ukuran panel dibersihkan saat dibuka kembali atau unmount.
- Pantulan UI host yang sama dengan cache lokal tidak menerapkan ulang tab stack
  dan state animasi panel.

Regresi parsing, layout, dan buka/tutup cepat lulus pada suite UI; 14 tes Markdown
serta typecheck juga lulus. Tampilan panel terbuka diperiksa dari screenshot
fixture. Angka ini membuktikan pengurangan kerja renderer pada beban tersebut,
bukan persentase peningkatan FPS pada perangkat pengguna. Latensi IPC native,
tab browser aktif, dan beban sistem desktop pengguna belum diprofilkan langsung.

Pemeriksaan gerakan setelah penyelarasan transisi mencatat 13 posisi lebar
perantara saat membuka dan 15 saat menutup, dengan deviasi jarak chat/panel
maksimum 0,01 px. Parsing ulang tetap nol. Pembalikan arah buka/tutup pada panel
expanded dan reduced motion juga lulus. Screenshot di tengah kedua transisi
diperiksa pada viewport 1280×900; jumlah sampel bukan jaminan FPS perangkat lain.
