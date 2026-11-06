# Audit akar masalah durasi agent dan Activity — 6 November 2026

Audit log, transcript tersimpan, konfigurasi terpilih, kode Const Harness, dan referensi lokal oh-my-pi. Waktu di dokumen ini menggunakan WIB. Tidak ada perubahan implementasi runtime, penghentian/restart aplikasi, perubahan Todo pengguna, inference tambahan, commit, atau push selama audit ini. Probe hanya memakai proses lokal dan direktori sementara.

## Hasil utama

Run **Spider Web Curiosity Cabinet** berlangsung **63 menit 55,983 detik**, dengan **147 request model dan 147 tool call**. Activity tidak memulai 147 run: seluruh event memiliki runId yang sama, dengan 147 requestId unik yang masing-masing dimulai sekali. Agent melanjutkan loop setelah hasil tool.

Penyebabnya berlapis: bahan referensi yang dibutuhkan tidak tersedia pada input yang diterima, agent memilih membuat penggantinya sendiri, lalu berulang kali memperbaiki artwork dan fisika/interaksi. Banyak putaran model menambahkan waktu tunggu dan keluaran yang panjang. Pemeriksaan yang lambat serta umpan balik shell yang kurang tegas memperbesar biaya pengulangan. Todo yang tidak dipelihara dan checkpoint yang hanya bersifat anjuran gagal membantu agent mengendalikan pekerjaan.

Run berakhir **09:46:18.509** dengan `outcome: cancelled`, `errorCategory: cancelled`, dan pesan `User cancelled agent execution.` Tidak ada hasil akhir `completed`/`done`. Log tidak merekam sumber abort, sehingga pesan tersebut tidak cukup untuk memastikan apakah penyebabnya tombol Stop, shutdown aplikasi, atau jalur pembatalan lain.

## Sumber dan batas pemeriksaan

- Session: `session_1793929339836`.
- Run: `7a95536f-a2d6-4b10-95d9-64f8fdba809a`.
- Log: `/home/constantine/.const/harness/brain/session_1793929339836/.system_generated/logs/events.jsonl`.
- Workspace agent: `/home/constantine/Code/test-const-harness/Website`.
- Konfigurasi terpilih dibaca tanpa menampilkan key/token. Model aktif `deepseek-v4.1-flash`; custom personalization instructions kosong. Konfigurasi file saat audit tidak membuktikan seluruh pilihan per-request pada saat run dimulai.
- Bukti Todo/database/replay sebelumnya: [AUDIT-TODO-2026-11-06.md](/home/constantine/Code/Clone/const/apps/harness/AUDIT-TODO-2026-11-06.md).
- Scratch analisis: `/tmp/const-duration-audit/analyze.py`, ringkasan JSON, daftar tool CSV, dan `probe.ts`. Klasifikasi berbasis regex di scratch adalah perkiraan; bukan pengukuran pasti jumlah pekerjaan yang sia-sia.

Audit ini tidak mengesahkan seluruh hasil website. Bukti beberapa state berhasil tidak membuktikan semua acceptance terpenuhi, khususnya ketika command terakhir dibatalkan dan tidak ada verifikasi final setelahnya.

## Waktu habis di mana

Rentang run: **08:42:22.526–09:46:18.509**.

| Komponen | Waktu kumulatif | Bagian durasi |
| --- | ---: | ---: |
| Menunggu delta pertama pada request model (TTFT) | 21m 12,901d | 33,2% |
| Setelah delta pertama sampai request selesai | 22m 32,924d | 35,3% |
| Eksekusi tool foreground | 19m 56,639d | 31,2% |
| Selisih di luar interval request/tool yang tercatat | 13,519d | 0,4% |

Total request model **43m 45,825d**. Bagian setelah delta pertama mencakup reasoning, teks dan argumen tool; bukan seluruhnya jawaban kepada pengguna. TTFT mencakup antrean, jaringan, prefill, serta kemungkinan retry sebelum stream; log tidak memisahkan kontribusi masing-masing. Tabel ini bukan pengukuran overhead renderer: renderer berjalan bersamaan dengan agent.

- Tool: **115 Bash, 22 read, 9 write, 1 todo_write**.
- Median request **11,477 detik**, P95 **45,879 detik**, maksimum **207,740 detik**.
- Usage melaporkan **205.162 completion tokens**, termasuk **96.390 reasoning tokens**. Keduanya tidak boleh dijumlahkan. Event reasoning berjumlah sekitar **348.457 karakter**.
- Semua 147 request berstatus akhir `completed`, tetapi ada **satu reconnect `ECONNRESET` pada 09:18:45** yang berhasil pulih. Status completed berlaku untuk request logis; tidak berarti setiap HTTP attempt pasti berhasil. Tidak ada pola kegagalan request berulang yang menjelaskan satu jam ini.
- Payload request **64.806–1.558.486 byte**, maksimum dua gambar, maksimum 316 message. Context estimator akhir **116.687/1.000.000 token (12%)**; usage provider request terakhir melaporkan 157.806 prompt tokens. Estimator dan token aktual berbeda, tetapi tidak ada bukti run ini berhenti karena 413/message-limit/context overflow.
- **120 request memuat image parts** menurut telemetry. Screenshot yang dibaca tidak sekadar berupa nama file dalam request. Ini belum membuktikan ketepatan interpretasi visual oleh model.

Pembagian fase berikut berdasarkan timestamp dan isi pekerjaan dominan; beberapa command melakukan beberapa jenis pekerjaan sekaligus.

| Rentang | Pekerjaan dominan | Tool call |
| --- | --- | ---: |
| 08:42–08:58 | Inventaris, font, generator aset, HTML/JS dan server | 37 |
| 08:58–09:14 | Screenshot, perbaikan aset, penggantian sebagian artwork dengan SVG | 42 |
| 09:14–09:46 | Pengukuran, debugging rest/sleep/catch, responsive dan revisi visual lanjutan | 68 |

## Akar masalah dan faktor penguat

### 1. Input utama tidak tersedia, tetapi agent mengambil strategi pengganti yang mahal

Prompt yang diterima menyatakan ada bagian HTML sumber dengan **18 gambar embedded** sebagai sumber kebenaran. Message tersimpan sepanjang **20.540 karakter** tidak memuat HTML tersebut: tidak ada attachment, `data:image`, `base64,`, `<!doctype`, `<html`, atau code fence. Empat URL yang ada mengarah ke font/radio, bukan HTML/aset referensi.

Model sudah menyadari ketidaktersediaan HTML/aset pada awal run. Inventaris awal workspace hanya menemukan proyek `robot jellyfish` dan `shelf hero`; tidak ada sumber untuk tugas baru. Agent kemudian memilih membuat sendiri 18 aset menggunakan Pillow/prosedur gambar, lalu mengganti sebagian dengan SVG yang dirender Chromium. Todo awalnya bahkan memasukkan pembuatan 18 aset pengganti sebagai pekerjaan utama.

Ini mengubah tugas dengan kebutuhan visual spesifik menjadi pembangunan ulang artwork dan mesin interaksi tanpa referensi implementasi lengkap. Sebagian generator melewati 1.000 baris, mengalami error dan memerlukan banyak revisi. Ketidakcocokan visual terus ditemukan karena aset pengganti memang tidak sama dengan sumber yang dimaksud.

**Kesimpulan kausal:** kegagalan menangani prasyarat yang hilang adalah akar masalah strategi paling kuat pada kasus ini. Bukti ini menunjukkan sumber tidak sampai pada input tersimpan/yang dikenali model; tidak membuktikan pengguna tidak pernah mencoba menyertakannya. Jalur kirim yang diperiksa (`chat-card.handleSend`, `App.handleSend`) tidak menunjukkan pemotongan prompt pada 20.000 karakter. Belum ada bukti bahwa bug composer membuang HTML.

Perbaikan: sebelum implementasi mahal, periksa referensi yang dinyatakan tersedia. Jika sumber pokok tidak ditemukan, laporkan blocker dan minta sumber/keputusan tentang substitusi. Jangan diam-diam menganggap aset buatan sendiri setara dengan sumber yang diwajibkan. Pemeriksaan ini harus berdasarkan dependensi tugas, bukan sekadar regex yang memblokir semua prompt dengan kata HTML/gambar.

### 2. Banyak perbaikan nyata, tetapi strategi verifikasi dan kriteria berhenti lemah

147 call bukan 147 eksekusi identik. Ada implementasi dan bug yang benar-benar diperbaiki. Namun, fase verification berulang memakai banyak helper baru, crop, pengukuran dan perubahan kecil pada rest/sleep/kaki/face. Setiap putaran menambahkan request model, reasoning/argumen baru, lalu proses browser lain.

Dua contoh paling mahal:

- **09:25:35**: `node states.mjs 2>&1 | tail -30`, **162,876 detik**.
- **09:32:54**: script sama dengan `tail -22`, **162,563 detik**.

Keduanya secara eksplisit diberi timeout shell 300/400 detik; ini bukan bukti timeout 60 detik di executor diabaikan. Helper `/tmp/pupp/states.mjs` menunggu berbagai kondisi, dengan deadline per kondisi sampai **90 detik**, lalu hanya mencetak `TIMEOUT` dan melanjutkan. Hasil kedua call memuat timeout rest, sleep dan catch, tetapi exit code tetap nol. Dua call itu saja memakai **5m 25,439d**.

Log belakangan menunjukkan perbaikan nyata: rest menjadi aktif; sleep mencapai 1; catch menjadi true; thread lama memudar setelah Delete. Jadi tidak tepat menyebut semua pengujian sia-sia. Akan tetapi output diagnostik dan screenshot belum menjadi suite acceptance dengan assertion/failure yang tegas. Perbaikan visual terakhir masih berlangsung ketika run dibatalkan.

Perbaikan: susun pemeriksaan dari acceptance yang jelas; gunakan deadline pendek yang sesuai perilaku, assertion dan exit code nonzero untuk kegagalan. Setelah gagal, ambil diagnostik terarah, perbaiki penyebab, lalu ulangi cakupan terkait. Jangan menambah banyak helper hanya untuk variasi output. Untuk state tertunda, simpan bukti kondisi/timeout yang membuat hasil `passed`, `failed`, atau `unverified` jelas.

### 3. Umpan balik shell dapat menyamarkan kegagalan; guard juga menolak kode yang sah

**Pipeline menutupi error.** Pada **08:46:41**, `python3 tools/gen_assets.py 2>&1 | tail -40 && ls -la assets` menghasilkan traceback, tetapi `tool_result.isError` false. Bash melaporkan status command terakhir, dan executor memakai exit code shell tersebut. Ada sepuluh hasil bertanda sukses yang berisi traceback; setidaknya satu di antaranya memang script diagnostik yang menangkap exception, sehingga jumlah ini bukan berarti sepuluh bug executor.

Probe memakai executor asli membuktikan:

```text
python3 -c "raise RuntimeError('AUDIT_ONLY')" 2>&1 | tail -3
→ isError: false

set -o pipefail; python3 -c "raise RuntimeError('AUDIT_ONLY')" 2>&1 | tail -3
→ isError: true
```

Ini sesuai semantik Bash biasa, tetapi tidak cukup sebagai kontrak keberhasilan verifikasi untuk agent. Hasil nol tidak boleh langsung dianggap semua subcommand lulus. Jangan memperbaikinya dengan menganggap kata `Traceback` selalu gagal atau mengaktifkan strict flags tanpa menilai kompatibilitas: pipeline `head`/SIGPIPE dan pencarian dengan hasil kosong perlu perlakuan yang benar.

**False positive background guard.** Pada **09:16:14**, `&` bitwise di dalam heredoc Python ditolak sebagai shell background. Probe berikut juga ditolak oleh executor asli:

```python
python3 - <<'PY'
print(True & False)
PY
```

`hasDetachedShellCommand` di [bash-interceptor.ts](/home/constantine/Code/Clone/const/packages/agent/src/const/bash-interceptor.ts:116) memahami quote sederhana tetapi tidak batas heredoc. Penolakan server dengan `&` pada 08:58:20 memang benar; agent kemudian memakai managed async server pada 08:58:31. Kedua kasus ini berbeda.

Perbaikan: analisis operator shell dengan pemahaman heredoc/quote/comment yang cukup dan regression cases nyata, sambil mempertahankan task ownership. Sediakan kontrak verifikasi yang meneruskan status kegagalan command penting. Ini faktor penguat dan bug yang perlu dibenahi, bukan penjelasan tunggal 64 menit.

### 4. Todo dan checkpoint belum menjadi pengendali progres

Todo hanya ditulis sekali pada **08:44:27**, delapan item: **0 completed, 1 in_progress, 7 pending**. Tidak ada update lain sampai cancel. Item pertama tentang folder/font tetap aktif walaupun pekerjaan sudah jauh melampauinya.

Activity menghitung deklarasi tersebut dengan benar. Panel Todo bukan scheduler yang menjalankan delapan langkah, dan pembukaan/penutupannya tidak memanggil model. Masalahnya adalah state rencana tidak dipelihara atau direkonsiliasi oleh runtime.

Tujuh checkpoint benar-benar dikirim pada turn **20, 40, 60, 80, 100, 120, 140**. Semua `kind: review`; tidak ada `repeated_result`. Jadi bukan sekadar versi checkpoint belum berjalan. `RunProgress` mendeteksi kombinasi argumen dan hasil identik; script/threshold/output yang terus berubah tidak memenuhi kondisi itu. Review generik juga tidak membawa snapshot Todo aktif atau bukti acceptance yang sudah selesai.

Dua bug Activity lain tetap berlaku: legacy fallback mempercayai raw args Todo terakhir yang bisa gagal/malformed, dan pencocokan substring `write` membuat `todo_write` menerima metadata mutation file. Bukti lengkap ada di audit Todo. Keduanya perlu diperbaiki; tidak ada bukti mereka memicu 147 request pada run ini.

Perbaikan: state Todo kanonis yang dipersist/restore, commit hanya hasil sukses, reminder terbatas saat state tertinggal, rekonsiliasi sebelum final, dan pemisahan pending/blocked/unverified. Jangan menandai selesai otomatis dari exit code atau menghentikan tugas hanya karena mencapai jumlah tool tertentu.

### 5. System prompt dan pemilihan tool berkontribusi, tetapi bukan satu penyebab tunggal

Prompt saat ini sudah meminta checklist diperbarui, analisis proporsional, pemeriksaan terarah, dan berhenti ketika acceptance terpenuhi. Run ini memperlihatkan instruksi tersebut belum cukup mengubah keputusan model. Kekurangan paling relevan adalah penanganan sumber wajib yang hilang serta tidak adanya state progres terstruktur pada checkpoint.

Browser-use dan computer-use pada konfigurasi/registry **saat audit** enabled/effective, termasuk untuk workspace ini. Namun run mencatat **nol `load_plugin_tools` dan nol native browser call**. Semua pemeriksaan memakai Chromium/Puppeteer lewat Bash, termasuk instalasi/penulisan helper. Kode desktop memang menunda native tools sampai loader dipanggil. Data ini menunjukkan jalur shell yang dipilih agent, tetapi tidak merekam inventory tool historis lengkap pada setiap request, sehingga tidak membuktikan bug loader atau capability pada awal run.

Guidance browser khusus juga baru muncul ketika `browser_evaluate` berada pada active tools. Ini celah discoverability yang layak dibenahi. Jangan memaksa native browser untuk semua pekerjaan: resize/multi-viewport dan instrumentasi test tertentu bisa memang membutuhkan runner lain. Gunakan jalur yang sudah tersedia dan cocok; buat keputusan eksplisit sebelum membangun helper baru.

Pengaturan effort/max output aktual per request belum dicatat sebagai telemetry. Nilai file config yang tidak ada tidak membuktikan pilihan UI tidak dikirim. Karena itu audit ini **tidak menyimpulkan model berjalan dengan effort maksimum**, atau mengganti model pengguna. Waktu dan jumlah token yang terukur sudah cukup menjelaskan dampak 147 putaran serial.

## Hubungan dengan freeze aplikasi

Kasus SIGTRAP renderer pada 5 November tetap merupakan insiden tersendiri, dibahas di [audit freeze](/home/constantine/Code/Clone/const/apps/harness/AUDIT-FREEZE-2026-11-05.md). Pada run 6 November ini tersedia **128 sample health** sepanjang run dengan PID renderer yang sama; file log tersebut tidak mencatat crash/reload/unresponsive event dalam rentang itu.

- Working set renderer terukur **426,6–1.457,7 MiB**; puncaknya sekitar **08:44:06**, lalu pada sample akhir run sekitar **513,9 MiB**. Ini tidak menunjukkan kenaikan monoton sepanjang satu jam.
- Heap **248,2–500,4 MiB**, node DOM **2.283–3.382**, long task terpanjang terukur **405 ms**, usia heartbeat maksimum **13,759 detik**.

Masih ada jank dan penggunaan memori yang patut dipantau; sampling ini bukan bukti aplikasi bebas freeze atau profil alokasi yang menjelaskan semua memori native. Namun durasi request/tool yang tercatat sudah menjelaskan hampir seluruh durasi run. Tidak ada bukti bahwa Activity menahan agent satu jam. Jangan menyamakan pemeriksaan responsivitas renderer dengan penilaian kualitas strategi agent.

## Perbandingan dengan oh-my-pi

Referensi lokal `/home/constantine/Code/Clone/oh-my-pi` memberi pola yang berguna:

- [session/todo-tracker.ts](/home/constantine/Code/Clone/oh-my-pi/packages/coding-agent/src/session/todo-tracker.ts:81) memiliki state kanonis, restore dari branch, successful-result accounting, mid-run nudge setelah aktivitas mutasi dan completion reminders dengan budget. Mid-run nudge maksimum dua per cycle; reminder memiliki pengecualian ketika menunggu pengguna/async.
- [tools/todo.ts](/home/constantine/Code/Clone/oh-my-pi/packages/coding-agent/src/tools/todo.ts:36) membedakan hasil yang benar-benar mengomit state dari hasil gagal/view. Ini menghindari pemulihan state dari raw args yang belum berhasil.
- [tools/bash-interceptor.ts](/home/constantine/Code/Clone/oh-my-pi/packages/coding-agent/src/tools/bash-interceptor.ts:7) menggunakan segment/token handling. Namun [shell-tokenize.ts](/home/constantine/Code/Clone/oh-my-pi/packages/coding-agent/src/tools/shell-tokenize.ts:9) sendiri menyatakan heredoc di luar cakupan parser kecilnya. Menyalin parser itu mentah-mentah belum membuktikan false positive Python kita selesai.

Prinsip yang perlu diikuti adalah state yang benar, pengingat berbasis kejadian dengan budget, dan pemulihan yang aman. Tidak ada bukti dari audit ini bahwa oh-my-pi pasti menyelesaikan brief yang kehilangan aset ini lebih cepat; hal tersebut memerlukan perbandingan input/model yang sama.

## Urutan solusi yang disarankan

1. **P0 — tangani prasyarat dan kriteria penerimaan.** Deteksi sumber wajib yang belum ditemukan; tanyakan keputusan substitusi sebelum membangun pengganti mahal. Catat acceptance, blocker dan bukti pemeriksaan yang benar-benar ada.
2. **P0 — benahi lifecycle Todo.** Persist/restore state tervalidasi, gunakan hasil sukses, betulkan atribusi mutation, dan bawa state ke reminder terbatas serta final reconciliation mengikuti prinsip oh-my-pi.
3. **P1 — perbaiki kontrak shell/verifikasi.** Heredoc-aware background detection; status pipeline yang eksplisit; test runner gagal secara tegas pada deadline/assertion. Pertahankan managed background job dan pembatalan.
4. **P1 — arahkan ulang setelah kegagalan berulang pada tujuan sama.** Sertakan acceptance yang belum terpenuhi, perubahan yang dicoba dan hasilnya. Beri checkpoint strategi dengan budget; jangan mengandalkan hash command identik atau hard cap tool yang mengklaim selesai secara palsu. Batch pengukuran independen dan gunakan kembali runner/browser yang cocok.
5. **P2 — lengkapi observability.** Rekam effort/output limit, tool inventory/plugin load, sumber cancel, attempt/retry latency, dan ringkasan progres tanpa secret/payload gambar. Lanjutkan soak test realistis dengan banyak tool/media serta pengukuran heap/native memory; stress reasoning 3 menit sebelumnya belum menguji semua pola run satu jam.

Menambah instruksi “jangan lama” atau menurunkan batas turn saja tidak menyelesaikan prasyarat yang hilang dan feedback verifikasi yang ambigu. Sebagian task memang memerlukan banyak call; checkpoint harus menilai kemajuan terhadap tujuan.

## Validasi audit

- Probe executor asli mereproduksi false positive `&` heredoc serta perbedaan status pipeline biasa/`pipefail` tanpa menyentuh workspace agent.
- Registry diperiksa read-only pada scope user dan workspace; plugin native enabled/effective saat audit.
- **27 tes existing** pada `bash-shell`, `run-progress`, dan `const-system-prompt` lulus. Tes existing ini belum mencakup bug heredoc/pipeline yang direproduksi; kelulusan bukan bukti bug tersebut sudah diperbaiki.
- `pnpm --filter @const/harness-desktop check-types` lulus, exit 0.
- Tidak ada perubahan implementasi baru pada audit ini. Perbaikan dari sesi sebelumnya tetap uncommitted dan belum dipush.

## Implementasi setelah instruksi Continue — 6 November 2026

Bagian audit di atas mencatat keadaan sebelum perbaikan. Setelah pengguna meminta Continue, perbaikan berikut diterapkan pada source lokal, tanpa commit atau push.

### Progres dan Activity

- `todo-state.ts` menjadi validator bersama untuk executor, restore history dan Activity. Payload tidak valid ditolak seluruhnya tanpa mengganti state sebelumnya. Parameter yang tidak diberikan juga ditolak; clear harus berupa array kosong eksplisit.
- `todo-tracker.ts` menyimpan plan yang berhasil dikomit dan memulihkannya dari metadata history. Setelah 12 aksi tanpa pemeliharaan plan, runtime menyisipkan review dengan state Todo, jumlah aksi/kegagalan, dan arahan memeriksa acceptance/strategi. Maksimum dua review per cycle, serta satu final reconciliation. Klarifikasi/menunggu pengguna dan cancel tidak dipaksa menjadi penyelesaian task.
- Todo disimpan sebagai metadata message, bukan hasil tebakan dari raw argumen call terbaru. Create/update/clear ikut snapshot, reload dan serialization untuk continue. Clear tidak menghidupkan kembali plan lama. Metadata lokal tidak ikut dikirim sebagai field provider yang tidak dikenal.
- Host melakukan checkpoint ke SQLite pada update Todo, termasuk ketika run belum selesai. Checkpoint renderer yang tertinggal selama run tidak boleh menimpa plan host. Pemilihan autosave mempertahankan trace UI yang lebih lengkap sambil membawa plan terbaru pada turn yang sama.
- Mutation event membawa toolCallId. Consumer memasang record ke file tool yang tepat; Todo tidak lagi ikut karena substring `write`. Untuk event legacy tanpa ID, fallback memilih satu file tool terakhir.

### Input, tool dan diagnosis

- Instruksi eksekusi sekarang meminta pemeriksaan sumber/aset wajib sebelum implementasi mahal, serta permintaan sumber atau keputusan substitusi bila prasyarat hilang. Tidak ada regex yang otomatis memblokir semua brief dengan kata HTML/gambar. Keputusan mengenali prasyarat masih dilakukan model, sehingga perilaku ini perlu diuji kembali dengan model pengguna.
- Workflow browser tersedia sejak loader browser-use yang enabled diiklankan; guidance verifikasi tidak menunggu seluruh native browser tool dimuat. Runner terpisah tetap diizinkan untuk instrumentasi yang memang tidak tersedia di native tools.
- Background guard memahami delimiter heredoc, quote/comment dan pemisahan body dari operator shell. Reproduksi Python `print(True & False)` sekarang berjalan, sementara detached job setelah heredoc, di command substitution, atau pada command line-nya tetap ditolak. Scanner ini bukan parser POSIX lengkap; bentuk kompleks tetap ditangani konservatif.
- Bash menyediakan **`verify: true`** untuk foreground build/test/check. Mode ini mengaktifkan `pipefail`, sehingga exception yang dipipe ke `tail` tercatat gagal. Bash biasa tetap memakai semantik semula, termasuk pipeline `head` yang sengaja mengakhiri producer. `verify` tidak dapat mengubah script yang hanya mencetak TIMEOUT namun sengaja keluar nol menjadi assertion yang benar; guidance mengharuskan helper mengembalikan status kegagalan dan menjalankan satu check/chain `&&`.
- Request diagnostics sekarang mencatat effort terpilih/default, batas output aktual, nama tool aktif, plugin native yang dimuat dan jumlah retry, tanpa key/header/payload gambar. `run_end` mencatat sumber abort yang diketahui: user Stop atau shutdown; caller lain tetap unknown. Latency tiap HTTP attempt belum dipisahkan dari request logis.

### Bukti pengujian implementasi

- **124 tes agent terpilih lulus**: 85 untuk Todo/Bash/prompt/progress/history/payload; 39 untuk isolation/background/readiness/vision/retry.
- Model tiruan menjalankan 27 request dengan executor asli: dua review stale plan, satu final reconciliation, update menjadi completed yang eksplisit, dan tidak ada metadata internal pada payload provider. Tidak ada inference berbayar.
- **31 tes state, SQLite, transcript dan telemetry desktop lulus**, termasuk reopen setelah failure, late checkpoint, malformed Todo, clear, pemisahan chat, dan atribusi mutation.
- **34 pemeriksaan Chromium UI lulus**, termasuk Activity 1/2 yang tetap benar meskipun trace terbaru berisi Todo malformed yang gagal, serta mobile/lima bahasa/media.
- Skenario produksi Electron lulus: plan sudah ada di SQLite saat request berikutnya masih menunggu, stale renderer save tidak menimpa plan host, clear tersimpan, dan reload mempertahankan runId serta mengeksekusi tool tepat sekali. Pemeriksaan startup, payload failure/recovery, cancellation dan project isolation juga lulus.
- Build agent, build produksi desktop dan desktop typecheck lulus. `git diff --check` bersih. Perbaikan tidak mengubah model pilihan, proyek website pengguna, atau konfigurasi OS.

Sebelum tes manual, tutup lalu buka kembali Harness agar main process/renderer memakai build terbaru. Gunakan prompt serupa; jika HTML/aset sumber memang belum tersedia, perilaku yang diharapkan adalah agent menyebut prasyarat yang hilang dan meminta sumber/keputusan substitusi. Durasi/latency model nyata dan soak satu jam belum diuji ulang dalam implementasi ini; tidak ada klaim bahwa seluruh freeze atau jumlah iterasi pasti hilang.
