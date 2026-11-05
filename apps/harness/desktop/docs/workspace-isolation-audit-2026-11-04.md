# Audit isolasi sesi desktop — 4 November 2026

> Pembaruan 5 November 2026: pengguna mengklarifikasi bahwa agent harus bekerja
> langsung di folder project yang dipilih, dan direktori internal per chat untuk
> log/metadata. Kebijakan checkout otomatis pada laporan historis ini sudah
> diganti. Lihat [audit folder kerja terbaru](workspace-terminal-audit-2026-11-05.md)
> untuk implementasi akhir, perlindungan konflik file, dan hasil pengujian.

Audit awal membaca database dan empat log terbaru, menelusuri desktop serta runtime `packages/agent`, membandingkan implementasi jobs di `D:/Code/Clone/deepseek-harness`, dan menjalankan reproduksi lokal. Bagian temuan awal di bawah merekam kondisi sebelum perbaikan; nomor baris source merujuk versi tersebut. Hasil implementasi dan audit ulang dicatat pada bagian terakhir. Data aplikasi dibaca tanpa mengubah percakapan atau hasil pekerjaan pengguna; reproduksi file menggunakan direktori sementara.

## Kesimpulan

Empat pekerjaan tersebut adalah **empat percakapan dengan satu folder project fisik**, bukan empat filesystem terisolasi. Semuanya menunjuk ke `D:\Code\tes-const-harness\Engineering`. Pemisahan transcript dan sebagian kontrol job sudah ada, tetapi file, port localhost, storage browser, dan beberapa state global masih dipakai bersama.

Ada bukti langsung file saling tertimpa dan preview mengambil server sesi lain. Tidak ditemukan bukti bahwa `manage_task` dengan `conversationId` yang benar menampilkan atau menghentikan job percakapan lain pada empat log ini. Mengganti global task manager saja tidak menyelesaikan penyebab utama.

## Empat sesi yang diperiksa

Waktu berikut adalah WIB (UTC+7), 4 November 2026. Label A–D hanya untuk laporan ini.

| Label | Conversation ID | Pekerjaan | Rentang event |
| --- | --- | --- | --- |
| A | `session_1793794203186` | Fernhollow pertama | 19:11:04–19:41:09 |
| B | `session_1793794364831` | Fernhollow kedua | 19:12:51–20:10:06 |
| C | `session_1793794390778` | Folio | 19:13:18–19:40:53 |
| D | `session_1793794404566` | Wild | 19:13:31–20:10:03 |

Metadata berasal dari `~/.const/harness/conversations/conversations.db`, dibuka read-only. Bukti event berada di `~/.const/harness/brain/<conversationId>/.system_generated/logs/events.jsonl`; nomor baris di bawah merujuk snapshot file saat audit.

## Temuan utama

### 1. P1 — Sesi menulis file project yang sama tanpa pemeriksaan konflik

**Terjadi dalam log.** B membuat `fernhollow/index.html` pada 19:17:19 (baris 1824), A menimpa file itu pada 19:22:44 (baris 14283), lalu B mengubahnya lagi pada 19:27:15, 19:28:23, dan 19:29:47 (baris 3879, 4477, 4693). B juga menyebut percobaan implementasi lain di folder tersebut dalam jawaban akhirnya. Dua prompt menghasilkan satu folder bernama sama.

`electron/main.ts:1631` menetapkan `targetWorkspace` langsung ke project pengguna. `packages/agent/src/const/tools.ts:5898` membatasi lokasi write terhadap project, lalu menulis file tanpa mengecek versi hasil baca terakhir. Sesi lain pada project yang sama tetap berada di dalam batas lokasi yang diizinkan. Ini bukan isolasi antarpekerjaan.

**Perbaikan:** sediakan working directory per tugas. Untuk repo Git gunakan worktree per tugas dan proses integrasi perubahan; untuk project non-Git seperti kasus ini, gunakan direktori output unik yang dialokasikan host. Bila pengguna memilih berbagi working directory, tampilkan status berbagi dan wajibkan pemeriksaan versi file sebelum write/edit/undo. Lock selama write saja tidak mencegah penimpaan berdasarkan hasil baca yang sudah usang. Jalur shell juga perlu mengikuti kebijakan ini karena shell dapat menulis file langsung.

### 2. P1 — Readiness job bisa mengakui port milik sesi lain sebagai servicenya sendiri

**Terjadi dalam log dan direproduksi.** A menjalankan `fernhollow-server` pada port 4173. C kemudian mencoba `folio-server` pada port yang sama:

- 19:31:54: tool mengembalikan `Background service started successfully and verified readiness`, `status="running"`, URL `http://localhost:4173` hanya dalam 7 ms (C, baris 18688).
- 19:33:01: browser C membuka URL itu dan mendapat judul **Fernhollow** (baris 18706), dengan tab ID berbeda dari tab A.
- 19:35:15: `manage_task` melaporkan proses C gagal dengan `EADDRINUSE :::4173` (baris 18923). File `~/.const/tasks/task_1793795514404_p4f2.log` menyimpan kegagalan yang sama.

`packages/agent/src/const/tools.ts:5043` hanya memeriksa apakah TCP port terbuka dan task masih berstatus running. Proses baru belum sempat melaporkan kegagalan bind, sementara port proses A sudah terbuka. Fungsi juga mengembalikan `ready: true` ketika timeout habis selama proses masih hidup (`:5069`), meskipun syarat readiness eksplisit belum terpenuhi.

Reproduksi: server A mendengarkan pada port acak; proses B hanya menjalankan timer tanpa server. `waitForReady(B, { port })` tetap menghasilkan `ready: true`.

**Perbaikan:** alokasikan port per job, kaitkan endpoint preview dengan pemilik job, dan verifikasi identitas service melalui handshake/token atau kepemilikan proses yang sesuai platform. Port terbuka saja tidak cukup. Timeout readiness eksplisit harus menghasilkan belum siap/gagal, bukan sukses. Worktree terpisah tidak memisahkan jaringan localhost.

### 3. P1 — Rollback dan checkpoint menggunakan ledger seluruh proses

**Direproduksi; tidak terlihat dipanggil dalam empat log ini.** `packages/agent/src/const/checkpoint.ts:58` menyimpan `mutationHistory` dan `checkpoints` sebagai array global, tanpa pemilik percakapan/run. Rollback tanpa file mengambil mutation terakhir seluruh proses (`:200`). Checkpoint mengumpulkan semua mutation (`:305`), restore tanpa ID mengambil checkpoint global terakhir (`:404`), dan restore memutar balik semua mutation sesudah indeks tersebut (`:421`).

Reproduksi dengan dua folder terpisah:

```json
{"callerWorkspace":"A","reverted":["B"],"A":"A new","B":"B old"}
```

Jadi masalah ini juga dapat menyeberang ke project berbeda. Tambahan lagi, `mutation-ledger.ts:36` menghapus file create dan `:52` memulihkan isi lama tanpa membandingkan isi sekarang dengan hasil mutation. Undo A dapat menghapus atau menimpa perubahan B yang lebih baru. IPC `agent:rollback-file` di `electron/main.ts:2309` meneruskan record yang diterima langsung ke rollback.

**Perbaikan:** ledger dan checkpoint harus memiliki owner percakapan/run serta workspace yang divalidasi host. Undo memerlukan pemeriksaan versi/hash isi sekarang, dan menolak perubahan yang sudah disentuh pihak lain. `newContent` saja belum cukup jika pemeriksaannya tidak atomik dengan write. Jangan menandai rollback berhasil sebelum operasi file berhasil.

### 4. P1 — Perubahan urutan tab dapat menghancurkan guest browser yang sedang digunakan

**Gejala terlihat dalam log; mekanisme DOM direproduksi pada Electron lokal.** `src/components/right-pane/right-pane.tsx:223` merender tab aktif dahulu, lalu tab browser latar. Saat pindah A ke B, urutan bisa berubah dari `[A, B]` menjadi `[B, A]`. `retainBrowserTabs` juga menghapus lalu menambahkan kelompok owner yang diperbarui (`src/lib/browser-pane-state.ts:23`). React key menjaga identitas komponen, tetapi pemindahan node DOM webview tetap memiliki efek lifecycle Electron.

Probe dua webview, tanpa menutup tab secara eksplisit, memindahkan wrapper webview A dengan `appendChild`:

```json
{"test":"reorder existing webview wrapper","oldGuest":2,"newGuest":4,"destroyed":true}
```

Pada D, tab ID yang sama tercatat dengan `guestContentsId: 10` pada 19:35:49 dan `18` pada 20:06:19. Log D mencatat `Browser tab was closed while the operation was running` (baris 12863, 12924) dan `Object has been destroyed` (12872). A juga mengalami kegagalan screenshot karena tab tertutup (14351). Ini mendukung masalah lifecycle guest; audit belum merekam urutan klik pengguna untuk mengatribusikan setiap error ke perpindahan tertentu.

**Perbaikan:** gunakan host webview permanen dengan urutan pemasangan stabil; ubah visibilitas saja saat berpindah sesi. Jangan memindahkan node guest yang hidup mengikuti urutan tab aktif. Tambahkan pengujian renderer nyata yang berpindah A→B→C→D sambil tool berjalan, dan memastikan guest ID serta state halaman tetap sama. Tes helper array belum memeriksa lifecycle guest.

### 5. P1 — Scope yang hilang masih berarti akses global pada API kontrol

**Dikonfirmasi dari source dan reproduksi manager; belum terbukti sebagai penyebab lintas job pada log ini.** `BackgroundProcessManager.listTasks/getTask/killTask` menerima `conversationId?`; tanpa ID, semua task dapat diakses (`packages/agent/src/const/tools.ts:5072`, `:5090`). Scoped lookup A atas task B ditolak, tetapi lookup tanpa owner mengembalikannya.

Desktop meneruskan sifat ini melalui `tasks:list`/`tasks:kill`. `tasks:get-output` sama sekali tidak menerima owner (`electron/main.ts:1559`). `subagents:kill` juga tidak memvalidasi owner (`:1564`). `TaskOutputTab` meminta daftar dan output tanpa ID percakapan (`:24`, `:32`) dan memiliki fallback kill tanpa scope (`:69`). Event task hanya memuat `taskId`, tanpa `conversationId`/`runId` (`tools.ts:4917`), lalu disiarkan ke renderer.

Ada masalah kontrol terkait pada `agent:update-mode` (`electron/main.ts:2146`): bila ID A diberikan tetapi A sedang idle dan hanya B aktif, fallback memilih B. Mengubah mode A dapat mengubah izin B. Payload tanpa ID juga memperbarui semua sesi. Ini berdasarkan source, bukan kejadian yang ditemukan dalam log.

**Perbaikan:** API sesi wajib menerima dan memvalidasi owner; owner hilang atau salah harus ditolak. Operasi global administratif harus merupakan API berbeda yang eksplisit. Bawa owner/run dalam event, output, tab task, cancel, dan kontrol subagent. Jangan memilih sesi lain ketika target eksplisit tidak sedang berjalan. Pertahankan operasi global untuk shutdown melalui jalur internal yang jelas.

### 6. P2 — Empat penyimpanan memory paralel dapat kehilangan tiga entri

**Direproduksi; bukan penyebab yang terlihat dalam empat log.** `packages/agent/src/const/memory.ts:198` membaca indeks, memodifikasi salinan lokal, lalu menulis ulang indeks di `:268` tanpa serialisasi. Penulisan `MEMORY.md` juga memakai read-modify-write (`:242`, `:249`). Scope project memang sengaja dibagi, tetapi penyimpanannya belum aman untuk konkurensi.

Reproduksi empat `executeRetain` bersamaan dengan filename berbeda pada project sementara:

```json
{"test":"four concurrent project memory writes","expected":4,"actual":1}
```

**Perbaikan:** antrekan transaksi per lokasi storage atau database transaksional. Atomic rename saja menghindari file parsial, tetapi tidak mencegah hilangnya update dari penulis lain. Jika mendukung beberapa proses aplikasi, lock harus bekerja antarproses.

## Risiko terkait dan batas bukti

- **Browser storage bersama:** semua guest memakai `persist:const_browser` (`browser/guest-policy.ts:3`, `browser-tab.tsx:1087`). Tab/control sudah dipisah per sesi melalui `BrowserSessionState`, tetapi cookie dan localStorage untuk origin yang sama tetap dibagi. Kasus Folio/Fernhollow berasal dari server yang sama, bukan tab ID yang sama. Tentukan apakah login memang ingin dibagi; bila perlu isolasi, gunakan partition per sesi dan perbarui kebijakan guest secara bersamaan. Partition terpisah tetap tidak mengatasi benturan port.
- **Proses shell yang tidak tercatat sebagai job:** D menjalankan server dengan shell `&` tanpa `async: true`; log D tidak memiliki event `task_started`. Artinya server itu tidak terdaftar pada manager, sehingga kontrol status/stop berbasis manager tidak dapat diandalkan untuknya. Belum dibuktikan bahwa proses tersebut masih hidup setelah sesi berakhir. Arahkan server melalui satu supervisor, dengan kepemilikan process tree dan kebijakan bertahan setelah turn yang jelas.
- **Browser latar belum andal:** log A merekam `document.visibilityState: visible`, tetapi rAF tidak berjalan dalam 1,2 detik (baris 14530). C mendapat screenshot kosong/tidak tersedia (18741). Mount permanen perlu diuji bersama rendering dan visibilitas, bukan hanya registrasi tab. Audit belum menetapkan penyebab tunggal rAF/screenshot ini.
- **Kegagalan hasil tidak semuanya berasal dari isolasi:** A mengalami provider 530 lalu context-window 400, C provider 520, sedangkan B dan D berakhir karena cancel pengguna pada 20:10. Pisahkan error provider/context dari error file, job, dan guest agar diagnosis tidak menyatukan semuanya.

## Perbandingan dengan DeepSeek Harness lokal

Referensi yang dibaca adalah source checkout lokal, bukan klaim mengenai versi online terbaru:

- `packages/jobs/jobs-local/src/index.ts:406` memvalidasi akses job terhadap owner. Caller tanpa owner tidak otomatis memperoleh owned job; ini berbeda dari manager Const saat ini.
- File yang sama mengikat lifecycle job ke objek Agent pemilik dan memasang cleanup owner (`:640`), sehingga teardown tidak bergantung pada pencarian global berdasarkan nama.
- `packages/jobs/jobs-local/src/events.ts` merutekan event melalui subscription dengan filter owner/scope.

Pola yang dapat diambil adalah kepemilikan eksplisit, validasi di penyedia service, routing event berdasarkan owner, dan cleanup berdasarkan lifecycle pemilik. Registry global sendiri bukan bug jika semua aksesnya diperiksa. Pola jobs tersebut juga tidak otomatis mengisolasi file atau port.

## Urutan perbaikan yang disarankan

1. Tutup operasi lintas sesi yang berpotensi merusak: scope ledger/checkpoint/undo, pemeriksaan versi file, dan hapus fallback mode ke sesi lain.
2. Tetapkan hubungan `project → task working directory → conversation → run → resource`. Alokasikan folder output unik untuk project non-Git; dukung worktree untuk repo Git. Shared directory harus menjadi pilihan yang jelas, dengan deteksi konflik.
3. Perbaiki readiness, kepemilikan port/endpoint preview, dan supervisor proses; gagal bind harus terlihat sebagai kegagalan job yang sama.
4. Stabilkan pemasangan webview dan pisahkan kebijakan browser storage dari kepemilikan tab.
5. Wajibkan scope di API/event kontrol dan buat penyimpanan memory transaksional.
6. Jalankan skenario empat sesi nyata, termasuk dua prompt dengan nama folder sama, port sama, perpindahan chat cepat, cancel satu sesi, serta undo saat sesi lain menulis.

## Verifikasi audit

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm --filter @const/harness-desktop check-types` | Lulus, exit 0 |
| `pnpm --filter @const/agent exec vitest --run test/background-jobs.test.ts` | 12 tes lulus |
| `pnpm --filter @const/harness-desktop exec tsx --test src/lib/browser-pane-state.test.ts` | 4 tes lulus |
| Probe rollback dua workspace sementara | Panggilan A memulihkan B |
| Probe readiness terhadap port server lain | Melaporkan siap meskipun job tidak mendengarkan |
| Probe pemindahan wrapper webview di Electron | Guest lama hancur, guest ID berubah |
| Probe empat penulisan memory bersamaan | Indeks hanya menyimpan 1 dari 4 entri |

Probe dijalankan sebagai skrip sementara, bukan regression test permanen. Percobaan awal probe webview gagal karena deklarasi variabel renderer berulang; setelah skrip dibungkus dalam fungsi, reproduksi lifecycle di atas berhasil. Suite browser integration lengkap dan alur empat sesi melalui UI produksi belum dijalankan. Tes yang lulus saat ini membuktikan perilaku scope/helper yang dicakupnya, bukan isolasi seluruh resource.

## Perbaikan dan audit ulang

Implementasi berikut dilakukan setelah audit awal, pada branch `codex/workspace-isolation`.

| Temuan | Perbaikan | Bukti setelah perubahan |
| --- | --- | --- |
| File output dipakai bersama | `TaskWorkspaces` mengalokasikan checkout persisten per project dan percakapan. Repo Git menggunakan branch/worktree tersendiri; folder biasa disalin. Source tidak menjadi direktori output. | Empat percakapan membuat `fernhollow/index.html` masing-masing dengan isi berbeda tanpa mengubah source, termasuk melalui IPC bundle produksi. Resolusi ulang setelah restart mengembalikan direktori yang sama. |
| Readiness salah mengakui port lain | Port harus dimiliki process tree job. Timeout menjadi kegagalan readiness. Jika pemeriksaan kepemilikan tidak tersedia, readiness gagal dengan error. | Job timer B ditolak saat port A terbuka; service dengan socket milik child sendiri diterima. |
| Undo/checkpoint global | Pemilihan mutation/checkpoint dibatasi owner dan workspace. Undo membandingkan isi terakhir, memakai lock yang sama dengan native writer, dan menolak konflik. Restore tidak melakukan `git stash apply` atas seluruh project. | Undo A tidak memilih B, checkpoint eksplisit B ditolak di A, perubahan manual dipertahankan dan dilaporkan sebagai konflik. |
| Guest browser rusak saat berpindah chat | Browser dirender dalam stack permanen terpisah dengan urutan ID stabil. Visibilitas aktif tidak memindahkan node guest. | Empat guest React di Electron mempertahankan ID dan state saat berpindah A→B→C→D→A. Guest latar tetap menjalankan rAF dan menghasilkan screenshot. |
| Kontrol tanpa owner | IPC task, output, subagent, terminal, mode, abort, dan undo membawa target eksplisit. API task/subagent tanpa owner tidak lagi menjadi akses global ke owned resource. Inventaris administratif menggunakan metode terpisah. | Bridge mempertahankan owner, lookup/kill tanpa owner ditolak untuk job milik B, mode A yang idle tidak mengubah B, terminal B tidak dapat ditulis/dihentikan dari A. |
| Memory kehilangan update | Lock lintas proses dengan `proper-lockfile`, pembaruan file melalui temporary file dan rename, serta pembacaan indeks rusak yang gagal secara eksplisit. Memory project tetap dibagi melalui source project, dengan akses write yang diserialkan. | Empat retain bersamaan mempertahankan empat entri. Smoke test tambahan menggunakan empat proses Node independen juga mempertahankan semuanya. |
| Storage browser bersama | Partition cookie/localStorage berbeda per percakapan, dengan kebijakan guest tetap dipasang sebelum attach. | Empat guest pada origin yang sama menyimpan cookie dan localStorage berbeda. |
| Server shell tidak tercatat | Detachment shell yang dikenali diarahkan ke foreground command dengan `async: true`, sehingga supervisor memegang prosesnya. Shutdown membatalkan sesi interaktif terdaftar, terminal, dan background job yang dimiliki aplikasi. | Shell `&`/`nohup`/`Start-Process` ditolak, sedangkan kutipan ampersand, redirection, dan invocation PowerShell tetap diterima. |

Audit ulang juga memperbaiki race yang ditemukan selama implementasi:

- Terminal menentukan cwd melalui host setelah workspace siap, memeriksa owner saat reattach/write/destroy, serta menolak startup baru ketika aplikasi sedang shutdown.
- Command background baru dikirim ke stdin shell setelah registrasi owner dan handler abort selesai. Uji cancel segera memastikan file marker dari command tidak pernah dibuat.
- Pembatalan saat checkout sedang disiapkan mencegah agent terlambat mulai. Uji bundle produksi menggunakan server model lokal membuktikan tidak ada request model setelah pembatalan itu.
- Hydration side-chat memeriksa ID snapshot sebelum mengambil run atau pesan; snapshot parent yang tidak sesuai tidak boleh membekukan composer side-chat.
- Perubahan mode selama persiapan diterapkan ke startup yang benar. Startup duplikat pada percakapan yang sama ditolak.
- Undo yang selesai setelah pengguna berpindah chat memperbarui cache/transcript pemiliknya. Regenerasi pesan berhenti jika undo mengalami konflik.
- Snapshot menyalin isi directory link tanpa mempertahankan akses tulis ke target source, dan menolak link direktori rekursif yang bisa menyalin workspace ke dalam dirinya sendiri.
- Native write/edit/patch memakai versi isi yang telah dibaca percakapan tersebut. Write dengan hasil baca usang ditolak. Jalur mutasi yang melewati symlink ke luar workspace juga ditolak.
- Mutation untuk undo diambil dari ledger host atau event log milik percakapan, bukan mempercayai path/content yang dikirim renderer. Record lama tanpa metadata owner tidak otomatis dipercaya.

### Pemeriksaan akhir

`pnpm --filter @const/harness-desktop test:isolation` menyediakan satu perintah regresi yang menjalankan 46 tes runtime, 12 tes workspace/database/bridge, dan 41 pemeriksaan integrasi browser Electron. Seluruhnya lulus.

Pemeriksaan lain yang lulus: typecheck desktop, build `@const/agent`, build produksi desktop, 34 tes remote, dan smoke test startup bundle produksi. Smoke test startup memeriksa main/preload/renderer, empat direktori task, kontrol terminal lintas owner, serta cancel selama alokasi workspace. Smoke memory empat proses juga lulus.

Pemeriksaan `test:side-chat` akhirnya juga lulus. Percobaan awal memperlihatkan runner yang bergantung pada executable `chromium` dan fixture yang memberikan snapshot parent saat side-chat meminta snapshotnya sendiri. Audit menambahkan pemeriksaan ID snapshot di `SideChatTab`, lalu runner memakai Electron bawaan secara default (override `CHROME_BIN` tetap didukung). Fixture membuktikan composer tidak dibekukan oleh snapshot percakapan lain, response tetap tersedia setelah remount, dan instruksi/receipt tetap menuju parent serta run yang benar.

### Perilaku dan batas yang perlu diketahui

- Direktori kerja baru berada di `~/.const/harness/workspaces/<project-conversation-hash>/project`. Hasil tugas tetap di direktori tersebut dan tidak otomatis digabung ke source. Repo Git mempunyai branch `codex/task-<hash>` untuk integrasi perubahan. Folder biasa mempertahankan salinan terpisah.
- Worktree mengambil HEAD ditambah isi tracked yang berubah, file untracked yang tidak di-ignore, dan tracked deletion saat alokasi. Folder biasa tidak menyalin `.git` atau `node_modules`; dependency perlu dipasang dalam task yang membutuhkannya. Checkout parsial akibat crash tidak digunakan diam-diam.
- Direktori persisten mencegah benturan output normal; ini bukan sandbox OS untuk shell atau kode arbitrer. Proses masih memiliki izin OS pengguna. Shell dapat sengaja mengakses path absolut atau jaringan di luar task; isolasi keamanan penuh memerlukan provider sandbox tersendiri.
- Port yang sudah ditempati tidak disulap menjadi server task yang baru. Agent harus memilih port lain atau meminta service mendengarkan pada port dinamis. Pemeriksaan memakai `Get-NetTCPConnection`/process tree pada Windows, `/proc` pada Linux, dan `lsof` pada macOS. Pengujian runtime pada audit ini dilakukan di Windows.
- Checkpoint memulihkan mutation native milik sesi dengan pemeriksaan konflik. Snapshot tidak dipakai untuk menimpa perubahan tak teratribusi. Shell/kode arbitrer yang tidak membuat mutation record tidak dijamin dapat di-undo melalui ledger.
- Cookie/login browser baru tidak lagi dibagi antarpercakapan. Partition lama tetap disimpan; data browser pengguna tidak dihapus.
- File hasil empat sesi lama yang sudah tertimpa tidak dipulihkan otomatis. Error upstream provider 520/530 dan penolakan context window merupakan masalah terpisah dari isolasi; laporan ini tidak mengklaim memperbaiki layanan model tersebut.
