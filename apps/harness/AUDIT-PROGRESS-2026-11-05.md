# Audit durasi agent, progres dan verifikasi — 5 November 2026

User meminta pemeriksaan penyebab model terlalu lama/berputar, kemungkinan pengaruh system prompt, serta perbaikan masalah yang terbukti. Audit ini melanjutkan [audit freeze renderer](./AUDIT-FREEZE-2026-11-05.md). Semua perubahan tetap tanpa commit/push.

## Hasil pemeriksaan log

Sesi `session_1793892464117` (**Leon Vasari VHS Shelf**), run `0e4f38d1-a51f-48ef-bc7f-35ad26d86cb4`, akhirnya selesai dengan `run_end.outcome=completed` pada **23:16:08 WIB**. Mulai sekitar **22:28:01 WIB**: durasi **48 menit 7 detik**. Proses ini terus bekerja setelah renderer crash; tidak ada bukti bahwa seluruh waktu itu merupakan loop tanpa kemajuan.

| Pengukuran | Hasil |
| --- | --- |
| Request model | 167; 166 completed, satu kegagalan transport yang berhasil dipulihkan |
| Durasi request yang tercatat | 2.190,214 detik, sekitar 36,5 menit |
| Waktu sampai token pertama | 1.373,385 detik, sekitar 22,9 menit; bagian dari durasi request, bukan tambahan di luarnya |
| Median durasi request | Sekitar 11,1 detik untuk request dengan usage |
| Request paling lama | 225,463 detik; 88.219 karakter reasoning, 26.513 reasoning token sebelum menulis implementasi |
| Tool call | 165: 100 Bash, 26 browser_evaluate, 21 read, dan 18 lainnya |
| Durasi tool yang tercatat | Sekitar 659 detik / 11 menit; 10 hasil tool berstatus error |
| Reasoning | 30.618 event delta, 297.767 karakter; 85.850 reasoning token yang dilaporkan provider |

Angka token berasal dari 166 request yang mempunyai usage. Reasoning token merupakan bagian dari completion accounting; jangan menjumlahkannya lagi sebagai token keluaran tambahan. TTFT mencakup waktu sebelum delta pertama diterima klien; log ini tidak bisa memisahkan antrean provider, prefill dan jaringan secara pasti.

Satu request transport gagal pada 23:12:06, sesudah HTTP 200, selama sekitar sembilan detik. Ini tidak menjelaskan durasi 48 menit. Tidak ada HTTP 413 pada run ini. Context/body masih berada di bawah batas saat dua crash renderer terjadi.

## Penyebab yang didukung bukti

1. **Banyak roundtrip model kecil.** Satu tool dipanggil pada hampir setiap request sukses. Tiap request kembali membayar waktu menunggu token pertama. Log berisi pemanggilan ulang script yang sama dengan `head`, `sed` dan `grep` berbeda untuk membaca potongan hasil pengujian. Pengelompokan pengukuran dan pembacaan output lengkap dapat mengurangi jumlah request.
2. **Analisis implementasi terlalu panjang sebelum aksi.** Respons 225 detik memuat perencanaan/detail kode yang kemudian ditulis lagi ke file. Prompt user memang panjang (28.655 karakter) dan meminta animasi/geometri yang rinci; itu membenarkan analisis serta beberapa iterasi, tetapi bukan alasan untuk terus menduplikasi draf implementasi dalam reasoning.
3. **Verifikasi melebar dan stop criteria kurang tegas.** Terdapat banyak pemeriksaan pixel/geometri, variasi viewport dan script uji sementara, termasuk kegagalan pada script tes sendiri. Sebagian iterasi memperbaiki bug nyata. Sebagian lain hanya memeriksa ulang atau memperbaiki asumsi alat verifikasi. Prompt lama meminta verifikasi, tetapi tidak cukup menjelaskan kapan pemeriksaan sudah memadai, kapan perlu diulang, dan bagaimana mempertahankan integritas assertion.
4. **Guard lama hanya menangkap argumen identik yang berturut-turut.** Pemeriksaan A/B/A/B dan variasi script lolos dari guard. Tidak ada checkpoint progres default untuk run utama; `softTurnBudget` lama hanya berlaku jika dikonfigurasi.
5. **Progres tidak disampaikan kepada user.** Hampir semua event commentary sebelum jawaban akhir kosong. Yang terlihat adalah thinking dan tool activity, kemudian UI membeku. Ini membuat user sulit membedakan pekerjaan yang maju, menunggu provider, atau tidak lagi produktif.

Konfigurasi personalisasi yang diperiksa tidak berisi custom instructions; domain pengguna adalah `Other`. Tidak ditemukan instruksi personal tersembunyi yang memaksa pengulangan. Model tetap `deepseek-v4.1-flash`; audit tidak mengganti pilihan model atau effort pengguna.

## Pemeriksaan hasil halaman

Deliverable `shelf hero/index.html` memang ada. Tampilan awal pada 1440×900 dan 390×844 berhasil dimuat dalam Electron terpisah: aset terlihat, rak/caption tersedia, tidak ada horizontal document overflow, dan rilis tidak mengekspos `window.__vh`.

Klaim akhir agent bahwa 40/40 assertion lulus untuk kedua viewport **tidak dapat dianggap sebagai verifikasi menyeluruh**. Script `_test.html`/`dev/tests.js` memakai rumus H desktop tanpa cabang mobile; pada lebar 390 ia membandingkan H aktual 234 dengan 120,9, padahal spesifikasi mobile memang memakai rumus lain. Script juga mengandalkan banyak fixed sleep dan asumsi pointer. Replay terpisah menghasilkan 27/40 pada desktop dan 31/40 pada viewport sempit di lingkungan tersembunyi/beban mesin saat audit. Angka itu bukan bukti bahwa semua kegagalan adalah bug produk: sejumlah assertion bergantung timing, input dan lingkungan. Ini justru menunjukkan script tersebut belum menjadi bukti portabel yang memadai.

Tidak ada perubahan pada website atau tes milik chat itu. Perbaikan pada Harness mengarahkan model untuk menunggu kondisi nyata, mencocokkan lingkungan uji, tidak melemahkan tes demi pass, serta melaporkan cakupan verifikasi yang benar-benar dijalankan.

## Perbaikan yang diterapkan

- `packages/agent/src/const/prompt-guidance.ts`: aturan menyelesaikan pekerjaan berdasarkan permintaan/acceptance, segera bertindak setelah keputusan jelas, memberi progres pada milestone, mengelompokkan pemeriksaan terkait, menghentikan siklus pemeriksaan yang sudah memadai, dan menjaga integritas tes. Panduan browser hanya disertakan ketika tool browser_evaluate benar-benar tersedia.
- `packages/agent/src/const/run-progress.ts`: checkpoint advisory setiap 20 turn dan deteksi input+hasil identik setidaknya tiga kali dalam window 12 call, termasuk call yang diselingi. Hash argumen mengurutkan key tanpa menghilangkan field semantik; data hasil tidak disisipkan menjadi instruksi. Histori detektor memakai digest dan dibatasi ukurannya.
- `const-agent.ts`: checkpoint hanya menjadi request context, bukan pesan manusia/transcript permanen. Event `progress_checkpoint` disimpan agar audit berikutnya bisa menilai pemicunya. Hasil yang berubah, perubahan file sukses dan steering pengguna mereset deteksi pengulangan. Wait/status dikecualikan. Checkpoint tidak memaksa tugas dianggap selesai, tidak menambah izin, dan tidak mengubah model.
- Guard pengulangan yang sudah ada kini memakai hash argumen kanonis dan histori terbatas, sehingga perubahan urutan key tidak melewati guard lama.
- Perbaikan renderer, pengiriman delta adaptif dan pemulihan native didokumentasikan pada audit freeze yang diperbarui.

Referensi oh-my-pi: `packages/ai/src/utils/tool-call-loop-guard.ts`, `packages/coding-agent/src/session/stream-guards.ts` dan `prompts/system/thinking-loop-redirect.md`. Prinsip yang diambil ialah deteksi lintas turn, argumen kanonis dan redirect yang memberi tindakan berikutnya. Harness tidak mencoba menyimpulkan secara otomatis bahwa variasi perintah shell yang berbeda berarti pekerjaan sudah selesai.

## Validasi

- Enam tes progress: pola interleaved, urutan key, perubahan hasil, reset mutasi/steering, polling, dan request context tanpa perubahan pesan manusia. Integrasi mock model menyelesaikan 22 request setelah menerima checkpoint; tidak dihentikan prematur.
- 47 tes agent/prompt/progress terakhir lulus; 42 tes terkait payload/history/Bash/progress lulus pada pemeriksaan sebelumnya dalam sesi implementasi ini.
- Tujuh unit test renderer/batcher dan lima skenario Electron renderer lulus; 34 unit test Markdown/history/telemetry/outcome dan 34 skenario full UI lulus.
- Agent/desktop build dan desktop typecheck lulus. Production startup juga lulus termasuk reload renderer di tengah request agent tanpa pergantian runId atau eksekusi tool ganda. Stress final dengan thought >1 MiB selama 180 detik lulus pada sekitar 182–297 MiB RSS, tanpa swap atau loop React; rincian dan batas interpretasinya ada di audit freeze.

Perbaikan prompt/guard diuji menggunakan provider mock dan inspeksi request. Belum ada inference berbayar untuk mengukur perubahan perilaku atau latency model nyata; retest pengguna tetap diperlukan untuk membandingkan durasi run berikutnya dengan kompleksitas tugas yang setara.
