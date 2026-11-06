# Audit freeze desktop Harness — 5 November 2026

Status lanjutan: perbaikan lokal sudah diterapkan atas instruksi pengguna. Bagian audit awal di bawah menggambarkan kode sebelum perbaikan; implementasi dan validasi terdapat di bagian terakhir. Audit durasi/model dilanjutkan dalam [AUDIT-PROGRESS-2026-11-05.md](./AUDIT-PROGRESS-2026-11-05.md). Tidak ada commit/push.

Audit diminta setelah UI tidak bisa diklik dan animasi berhenti, sementara aplikasi lain normal. Fokus audit ini berbeda dari kegagalan agent HTTP 413 pada audit sebelumnya. Waktu di bawah memakai WIB (UTC+7).

## Kesimpulan dan tingkat kepastian

**Terbukti: renderer utama Electron crash dua kali.** Proses utama dan agent tetap berjalan. **Dugaan terkuat: kegagalan alokasi/memori di renderer.** Komponen trace menunjukkan alokasi berat saat diperbarui, tetapi belum ada bukti cukup untuk menyebut satu fungsi sebagai sumber kebocoran permanen. Core pertama terpotong dan binary tidak mempunyai simbol yang memadai.

Tidak ada restart manual, penghentian agent, perubahan percakapan, atau perubahan kode runtime dalam audit awal. Eksperimen memakai Electron terpisah dengan profil sementara. Implementasi berikutnya dijelaskan terpisah di akhir laporan; perubahan dari audit sebelumnya tetap disimpan tanpa commit/push.

## Bukti kejadian langsung

| Waktu | Bukti |
| --- | --- |
| 22:26:43 | Main Electron PID 820303 mulai; renderer UI PID 820377 mulai sekitar dua detik kemudian. |
| 22:38:14.407 | Request agent terakhir yang dipersiapkan sebelum crash: 1.420.822 byte, 97 message, dua gambar. Request sebelumnya selesai HTTP 200. |
| 22:38:27 | Kernel/journal dan systemd-coredump mencatat PID 820377 berhenti dengan SIGTRAP (signal 5). |
| Sekitar 22:41 | PID tersebut sedang diproses core dump, bukan renderer sehat yang masih bekerja: `anon_pipe_write`, waktu CPU tidak maju, VmSwap 6.116.456 KiB. Jangan menjumlahkannya dengan sampel RSS dari waktu berbeda. |
| 22:43:23 | Core dump pertama selesai, hampir lima menit sesudah crash. Handler aplikasi kemudian memuat ulang UI; renderer pengganti PID 831564 muncul tanpa tindakan restart dari audit. |
| Setelah reload | Renderer pengganti kembali mengalami tekanan memori: sampel RSS+swap sekitar 1,9 GiB pada umur 2m52s dan 3,2 GiB pada 5m11s. RSS naik/turun karena GC dan paging. |
| 22:58:35 | Journal kembali mencatat SIGTRAP pada PID 831564. Sampel `/proc` saat core dump menunjukkan RSS 4.105.252 KiB dan swap 2.800.824 KiB pada saat yang sama, total sekitar 6,6 GiB. |
| 23:06:33 | Log agent masih mencatat `tool_call`; tidak ada terminal `error`, `done`, atau `run_end` untuk run tersebut sampai titik pemeriksaan ini. |

Sesi: `session_1793892464117`, judul **Leon Vasari VHS Shelf**. Run: `0e4f38d1-a51f-48ef-bc7f-35ad26d86cb4`.

Sumber lokal:

- `~/.const/harness/brain/session_1793892464117/.system_generated/logs/events.jsonl`.
- `journalctl --since '2026-11-05 22:35:00' --grep='820377|831564'`.
- `coredumpctl info 820377`: executable Electron 44.1.1, core terpotong, native PC pada offset `0x92e7568`.
- `/proc/<pid>/status` dan daftar proses pada saat audit. VmSize yang sangat besar tidak dipakai sebagai ukuran konsumsi RAM.

Disassembly di sekitar PC pertama memperlihatkan jalur crash eksplisit (`int3`/`ud2`), konsisten dengan fatal check/alokasi; tanpa simbol dan stack lengkap, ini tidak membuktikan nama fungsi tertentu. [Dokumentasi Chromium tentang OOM](https://chromium.googlesource.com/chromium/src/+/main/docs/memory/oom.md) menjelaskan bahwa kegagalan alokasi bisa membunuh satu proses meski sistem/aplikasi lain masih berjalan. Kasus ini sangat mengarah ke masalah memori, tetapi belum membedakan kebocoran, retensi allocator, lonjakan alokasi, atau bug native Electron/Chromium.

## Lima temuan utama

1. **P1 — Crash berada di renderer UI, bukan lifecycle agent.** Main Electron tetap hidup dengan RSS sekitar 80–100 MiB dan log agent terus maju melewati dua crash. Browser guest awal yang diperiksa juga jauh lebih kecil, sekitar 70 MiB RSS. Ini mempersempit fokus ke UI utama; belum sepenuhnya mengesampingkan interaksi GPU/browser. Jangan mengirim ulang pekerjaan karena mengira agent sudah berhenti.

2. **P1 — Trace tertutup tetap dipasang ke DOM.** `desktop/src/components/workbench/execution-trace.tsx:55–76` hanya melipat dengan CSS grid/opacity. Isi Markdown, tool output, ScrollArea dan observer tetap hidup. Snapshot replay dari chat yang sama berisi 197.326 karakter thinking, 154 trace step, 86 tool call; satu thought mencapai 88.219 karakter. Snapshot ini diambil setelah crash pertama, bukan salinan persis keadaan pada detik crash. Dalam replay statis, DOM tetap sekitar 16 ribu node setelah GC walaupun sebagian besar detail tertutup.

3. **P1 — Update streaming menyentuh pohon trace besar tanpa anggaran render adaptif.** Batcher default 16 ms (`desktop/src/lib/stream-batcher.ts:4`). Cabang thinking memperbarui message dan trace array di `desktop/src/App.tsx:2693–2711`; `ExecutionTrace` memetakan seluruh langkah dan komponen item belum dimemo. `MarkdownContent` sudah mememo lexer untuk konten yang sama, tetapi konten aktif berubah terus dan perlu diproses ulang; ThoughtItem juga belum meneruskan `isStreaming`. Ini jalur beban yang terbukti relevan, bukan bukti bahwa Markdown adalah satu-satunya penyebab crash.

4. **P1 — Pemulihan hanya reload otomatis dan dapat mengulang beban.** `desktop/electron/main.ts:728` mencetak `render-process-gone` ke console lalu reload untuk semua alasan non-clean. UI baru dapat memuat kembali trace berat yang sama. Core dump pertama menunda keluarnya proses hampir lima menit; selama itu frame terakhir bisa tampak membeku. Tidak ditemukan handler `unresponsive`/`responsive`, tampilan pemulihan ringan, atau pembatas percobaan reload di jalur ini.

5. **P2 — Observabilitas renderer belum cukup untuk memastikan sumber alokasi.** Telemetri agent/request sekarang tersedia, tetapi jalur crash renderer belum menyimpan statistik memori per proses, jenis WebContents, heartbeat/long task, dan sebab crash secara terstruktur. Log console saja sulit dipakai setelah kejadian. Core terpotong membuat identifikasi native stack tidak tuntas.

Request sebelum crash kedua hanya 573.261 byte/240 message. Tidak ditemukan 413 atau terminal model error pada run ini. Bukti tersebut tidak mengarah ke batas body 4 MB atau kehabisan context sebagai penyebab freeze ini.

## Eksperimen terpisah dan batas interpretasi

Fixture di `/tmp/const-freeze-audit` memakai komponen asli, React dan Electron yang sama, profil sementara, tanpa model network/browser guest. Data chat hanya dibaca; raw transcript tidak disalin ke repository. Tiap proses fixture dibatasi waktunya dan mempunyai guard memori.

| Eksperimen | Hasil |
| --- | --- |
| Trace statis | Setelah GC, JS heap sekitar 20 MiB, RSS sekitar 249 MiB, sekitar 16.355 DOM node. |
| Update prop thinking sekitar 31 kali/detik, langkah terakhir tetap tool | RSS sekitar 296 → 601 MiB dalam pengamatan 12 detik. Ini uji render ulang, bukan pengukuran parsing thought aktif. |
| Mount isi hanya ketika terbuka | DOM turun ke sekitar 1.545 node setelah GC, tetapi pertumbuhan RSS tetap terjadi. |
| Tambahkan thought aktif, kode asli | RSS sekitar 281 → 537 MiB pada sampel awal/akhir 12 detik. |
| Thought aktif + lazy mount + memo item | RSS tetap tumbuh; tidak cukup untuk menyatakan perbaikan. |
| Varian di atas dengan thought berupa teks biasa | RSS sekitar 212 → 542 MiB; heap kembali sekitar 13 MiB setelah GC, tetapi RSS tidak kembali ke baseline. Jadi Markdown saja belum menjelaskan seluruh pertumbuhan. |
| Kontrol tambahan: varian teks biasa memakai wrapper div pengganti ScrollArea hanya di fixture, lalu prop mutations dibuat stabil | RSS tetap tumbuh (sekitar 209 → 586 MiB pada varian prop stabil). Ini belum mendukung tuduhan bahwa Radix ScrollArea sendiri adalah sumber masalah. |
| Kontrol React sederhana, update data yang sama tanpa ExecutionTrace | RSS sekitar 120 → 124 MiB; DOM/listener stabil. |

Angka berasal dari proses berbeda; startup/waktu GC dan jumlah tick yang berhasil berbeda, sehingga bukan benchmark perbandingan kinerja yang terkontrol penuh. Fixture menggunakan hidden offscreen window dan bukan seluruh aplikasi. Pertumbuhan RSS singkat serta penurunan heap saat GC belum membuktikan kebocoran permanen. Jangan menyatakan lazy mount, memo, atau plaintext sebagai fix yang sudah tervalidasi.

## Perbandingan dengan oh-my-pi

Referensi lokal: `/home/constantine/Code/Clone/oh-my-pi`.

- `packages/tui/src/tui.ts:930`: cadence dasar 30 fps; `:2784` menambahkan penundaan adaptif berdasarkan biaya frame, prioritas kesempatan input, dan backlog output. Const baru membatasi delta dengan timer tetap 16 ms.
- `packages/tui/src/tui.ts:2713`: render dibatasi viewport, blok history yang sudah retired tidak terus dirender. Padanan desktop adalah virtualisasi/windowing dan melepas isi panel tertutup sambil mempertahankan data lengkap.
- `packages/tui/src/components/markdown.ts:813`: cache render mempunyai batas jumlah dan ukuran; `:1857` menyimpan prefix streaming yang sudah stabil agar tidak terus memproses seluruh buffer.

oh-my-pi adalah TUI; implementasi terminalnya tidak bisa disalin langsung menjadi komponen Electron. Yang relevan adalah batas kerja per frame, cache dengan batas, pemisahan history stabil dari tail aktif, dan kontrol tekanan output.

## Rencana solusi dan urutan validasi

1. **Tambahkan bukti alokasi dan kesehatan renderer terlebih dahulu.** Catat secara terstruktur `render-process-gone` (reason/exitCode), identitas main UI versus guest, statistik RSS/private memory/JS heap, heartbeat dan long task dengan frekuensi rendah. Gunakan fixture dengan profiler heap/native untuk mencari alokasi yang bertambah sesudah GC. Bandingkan development dan production; uji versi Electron lain hanya sebagai eksperimen terkontrol jika bukti mengarah ke runtime/dependency.
2. **Batasi kerja UI dengan prinsip oh-my-pi.** Coalesce tampilan sekitar 30 fps dan adaptasikan ke biaya render; pertahankan urutan/reset/error/completion sebagai barrier. Pisahkan state agent dari render seluruh App. Memo langkah lama; tampilkan window item yang relevan dan lepaskan body panel tertutup. Data asli tetap lengkap dan detail bisa dibuka sesuai kebutuhan.
3. **Perbaiki jalur alokasi berdasarkan profil.** Profilkan ScrollArea/Radix, listener/ref/observer, Markdown/sanitizer/highlighter dan retensi native secara terpisah. Jangan hanya memperbesar heap, menghapus reasoning, atau mengganti seluruh Markdown menjadi teks biasa. Gunakan prefix/tail processing dan cache terbatas ketika relevan. Radix ScrollArea tetap mengikuti aturan desain repository.
4. **Pulihkan UI ke keadaan ringan.** Main process menangani unresponsive/crash, mencatat sebab, membatasi reload berulang, lalu memuat tampilan ringkas yang dapat menyambung ke run yang masih hidup. Jangan langsung memasang seluruh detail chat berat. Main agent, tool, job dan runId tidak boleh dimulai ulang atau digandakan.
5. **Uji ketahanan sebelum pengguna retest.** Replay trace chat ini dan thought panjang dengan banyak code fence selama 20–30 menit; bandingkan RSS+swap dan heap sesudah GC pada siklus berulang, respons input, node/listener hidup, dan jumlah render langkah lama. Uji expand/collapse, pergantian chat, browser, serta simulasi crash pada fixture; pastikan event terminal tidak hilang, agent tetap berjalan dan pemulihan tidak berputar. Jalankan typecheck serta tes terarah setelah implementasi.

Typecheck `pnpm --filter @const/harness-desktop check-types` lulus pada audit awal. Pengguna kemudian mengizinkan implementasi perbaikan di bawah.

## Implementasi lanjutan

Investigasi komponen menemukan dua jalur tambahan yang tidak tampak dari core terpotong:

- React **19.2.8 development** mencatat props yang berubah ke `PerformanceMeasure.detail`. Sumber lokal `react-dom-client.development.js`, fungsi `logComponentRender`, memasukkan diff props ke `performance.measure`. Pada replay terdapat lebih dari 44 ribu measure dalam beberapa detik. Data ini berada di luar angka JS heap sederhana dan perlu dibatasi. Ini bukti penyumbang beban, bukan identifikasi simbol native crash yang masih tidak lengkap.
- Soak awal masih menangkap `Maximum update depth exceeded` pada jalur thinking/scroll yang terus diperbarui. Lazy mount/memo saja belum cukup. Uji singkat dua menit yang tampak membaik tidak dijadikan bukti perbaikan selesai. Preview yang berubah tiap delta kemudian dipisahkan dari full scroll view yang stabil.

Perubahan:

1. `execution-trace.tsx`: body accordion dilepas setelah animasi 220 ms; default trace menampilkan 60 langkah terakhir dengan tombol membuka langkah sebelumnya. Item stabil dimemo dan default array dibuat stabil. Teks/hasil/tool history lengkap tetap disimpan.
2. Thinking aktif memakai preview yang dibatasi; reasoning panjang menampilkan tail 4.000 karakter. Tampilan lengkap menangkap teks saat dibuka agar bisa dibaca tanpa perubahan ukuran setiap delta; tombol kembali ke live disediakan. Full/completed reasoning memakai Radix ScrollArea. Preview terpotong tidak mempunyai scrollbar native. ResizeObserver hanya aktif ketika full view benar-benar terbuka; preview/media tertutup tidak terus menjalankan observer atau membaca gambar.
3. `markdown-content.tsx`: code highlighting berat ditunda ketika konten masih streaming. Gaya thinking dan kemampuan membuka reasoning lengkap dipertahankan.
4. `src/lib/renderer-health.ts`: props snapshot pada timing React development dihilangkan sebelum native Performance.measure menserialisasikannya, lalu entry React dibersihkan dari timeline melalui observer. Timing/track, argumen dan return API, serta pengukuran aplikasi lain dipertahankan; opsi React tidak dimutasi. Cleanup HMR mengembalikan method semula. Heartbeat memuat ukuran heap, jumlah node dan long task; tidak memuat isi chat/props.
5. `stream-batcher.ts` dan main: cadence default sekitar 30 fps, dengan penundaan adaptif sampai 200 ms saat renderer melaporkan long task. Reset/tool/error/completion tetap menjadi barrier langsung. Main dan scheduled task memakai kebijakan yang sama.
6. `electron/renderer-health.ts`: log JSONL main-process untuk attach/load/sample/unresponsive/responsive/crash, identitas renderer, native memory/CPU dan heartbeat terakhir. Log dibatasi sekitar 1 MiB dengan satu file rotasi. Sample disaring menjadi field numerik; isi chat atau field tak dikenal tidak disimpan.
7. Reload otomatis tanpa batas diganti pemulihan melalui dialog native yang tetap dapat ditangani main. Gangguan singkat tidak menampilkan prompt; pilihan Wait tidak memunculkan prompt berulang untuk stall yang sama. Reload menyambung ke run yang hidup. Native dialog dan label preview tersedia dalam lima bahasa.

## Validasi implementasi

- Tujuh unit test cleanup/batching dan lima skenario Electron renderer lulus, mencakup timing tanpa props besar, akses history/reasoning lengkap, detached DOM setelah GC, streaming, completion, diagnosa aman, deduplikasi pemulihan dan Wait. Skenario crash pada suite ini disimulasikan melalui event; bukan bukti core dump native berhasil direproduksi dan disimbolkan.
- 34 skenario full UI dan 34 unit test Markdown/history/outcome/telemetry lulus dalam sesi ini.
- Build desktop production dan agent lulus. Production startup dengan main/preload/renderer asli lulus, termasuk request model yang sengaja ditahan ketika renderer di-reload: runId tetap sama, dua tool dieksekusi sekali, tiga request model, dan outcome completed.
- Stress final 180 detik memakai trace dari chat yang diaudit ditambah thought aktif 1.114.112 karakter. Lulus dengan 5.638 update, 179 sample, RSS 186.708–304.308 KiB (sekitar 182–297 MiB), sample terakhir 253.316 KiB, swap nol, dan 642 DOM node setelah warm-up. Tidak ada forced GC selama stress dan tidak ada Maximum update depth. Data tersedia sementara di `/tmp/const-freeze-audit/large-soak-samples.json`. Fixture memakai instance/profil terpisah tanpa inference atau perubahan data pengguna; bukan seluruh aplikasi.
- Pengamatan sebelumnya berjalan sekitar sepuluh menit setelah preview dipisahkan dan tidak lagi mencatat loop React, tetapi berakhir pada watchdog runner saat sampling/props diagnostik masih mahal. Itu tidak dicatat sebagai soak yang lulus. Uji berikutnya memakai batas durasi berdasarkan wall clock, props diagnostik dihilangkan sebelum serialisasi, dan thought besar dimuat sejak awal; hasil final di atas adalah pemeriksaan yang selesai sukses. Candidate sebelumnya yang memicu memory guard/loop update juga ditolak.

Core asli masih terpotong; sebab alokasi native spesifik belum bisa dinyatakan pasti. Fix ditujukan pada beban/retensi dan loop UI yang berhasil diukur serta mekanisme pemulihan yang bermasalah. Tidak ada perubahan konfigurasi OS, pilihan model, commit atau push.
