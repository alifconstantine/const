# Audit Activity / Todo — 6 November 2026

Audit baca-saja atas log aktif, database percakapan dan kode saat ini. Tidak ada perubahan runtime, restart aplikasi, penghentian agent, atau pengubahan status task pengguna. Larangan commit/push tetap dipertahankan.

## Kesimpulan

Transport dan tampilan Todo bekerja untuk input normal, tetapi daftar pada chat yang diperiksa sudah tidak mencerminkan progres pekerjaan. Model membuat rencana sekali dan belum memperbaruinya. Selain celah pemeliharaan rencana ini, ditemukan dua bug data pada pemulihan Todo dan pengaitan perubahan file.

## Bukti live

Chat **Spider Web Curiosity Cabinet**, session `session_1793929339836`, run `7a95536f-a2d6-4b10-95d9-64f8fdba809a`.

- Pada **08:44:27.520 WIB**, tool `todo_write` menerima delapan item: satu `in_progress`, tujuh `pending`, nol `completed`.
- Di timestamp yang sama ada `todo_update` dengan delapan item yang sama. `tool_result` pada 08:44:27.522 menyatakan berhasil: `0 completed, 1 in progress, 7 pending (8 total)`.
- Pada pemeriksaan **09:40:34 WIB**, masih hanya ada **satu** pemanggilan/update Todo. Database menyimpan status yang sama. Counter Activity yang diharapkan dari data itu adalah **0/8**; panel tidak kehilangan event status selesai karena event tersebut memang belum dikirim.
- Pekerjaan sudah maju: generator aset dan font tersedia; `src/page.html`, `src/app.js`, `build.mjs` serta `index.html` sudah dibuat. Pada **08:58:31 WIB**, job `spider-web-server` menjalankan server port 8931. Sesudahnya agent berkali-kali memeriksa dan memperbaiki perilaku spider lewat browser/script.
- Sampai pemeriksaan tersebut, ada 132 request dan enam `progress_checkpoint`, tetapi tidak ada `done`, `error` terminal atau `run_end`. Checkpoint implementasi sebelumnya sudah berjalan; checkpoint itu belum membawa state Todo aktif sebagai bahan rekonsiliasi khusus.
- Pemeriksaan penutup **09:43:49 WIB**: Todo masih satu update dengan satu `in_progress` dan tujuh `pending`; checkpoint bertambah menjadi tujuh dan belum ada terminal event.

Keberadaan file/server tidak membuktikan seluruh acceptance sudah dipenuhi. Namun, kemajuan yang teramati cukup menunjukkan bahwa daftar awal tidak lagi menjadi catatan progres yang dipelihara. Status task tidak boleh ditebak otomatis dari sekadar exit code atau keberadaan file.

Sumber: `~/.const/harness/brain/session_1793929339836/.system_generated/logs/events.jsonl` dan database SQLite yang dibuka read-only.

## Temuan

### 1. Pemeliharaan rencana belum terhubung ke runtime — dampak utama pada kasus ini

`packages/agent/src/const/tools.ts:6611` memvalidasi/menormalisasi daftar dan memanggil `onTodoUpdate`. `const-agent.ts` meneruskan callback sebagai event `todo_update`. Activity menghitung completed berdasarkan status item, bukan berdasarkan jumlah tool yang telah berhasil.

Ini benar sebagai mekanisme publikasi state. Kekurangannya: ConstAgent belum memiliki pengelola state Todo kanonis yang ikut dimasukkan ke checkpoint dan diperiksa ketika model mengakhiri pekerjaan. Instruksi generik untuk memperbarui checklist sudah ada pada `prompt-guidance.ts`, tetapi perilaku live menunjukkan instruksi itu belum cukup. Status delapan item tetap tertahan pada deklarasi awal.

Todo adalah catatan rencana yang dideklarasikan model; ia bukan scheduler yang menjalankan delapan langkah tersebut secara otomatis. Run juga dapat berakhir dengan item masih terbuka karena saat ini tidak ada rekonsiliasi khusus sebelum final.

### 2. Fallback UI memakai argumen tool mentah, termasuk call yang gagal

`desktop/src/App.tsx:1765` mengutamakan map Todo non-kosong; jika tidak ada, ia mencari `traceSteps` terbaru dan langsung mengembalikan `st.args.todos as TodoItem[]`. Jalur ini tidak memeriksa keberhasilan call atau memvalidasi array/item. `FloatingWorkbenchCard` kemudian langsung memanggil `.filter` dan membaca `todo.status`.

Replay terpisah menghasilkan keadaan berikut:

1. Plan valid berhasil dipublikasikan; host `live.todos` benar.
2. Model mengirim `todo_write` dengan `todos` berupa object, bukan array.
3. Executor menolak call tanpa mengirim update baru; state kanonis tetap plan valid.
4. Trace terbaru tetap memuat argumen call yang gagal itu. Fallback UI setelah pemulihan dapat memilih object mentah tersebut, bukan state tervalidasi.

Akibat yang mungkin adalah daftar salah atau error rendering untuk payload malformed. **Payload malformed ini tidak terlihat pada run live yang sedang diaudit**; temuan ini adalah bug jalur pemulihan yang dibuktikan lewat replay dan inspeksi consumer, bukan penyebab status 0/8 pada kasus live.

Database message saat ini tidak menyimpan field Todo kanonis terpisah; pemulihan bergantung pada trace. Selain itu, reducer Todo memperbarui entry Todo pertama, sedangkan fallback mencari entry terakhir, sehingga hasil normalisasi dan raw input dapat berbeda.

### 3. `todo_write` keliru mendapat metadata perubahan file — terlihat di data live

`desktop/src/App.tsx:2803` dan `desktop/electron/remote-session-state.ts:75` mengaitkan file mutation ke semua step yang namanya mengandung `write`, `edit` atau `replace`. Nama `todo_write` ikut memenuhi kondisi itu.

Pada message tersimpan dari chat ini, step Todo memiliki `mutation.targetFile = spider web/tools/gen_assets.py`. Replay dengan satu `todo_write` diikuti satu `write` juga memasang record file yang sama ke **keduanya**.

Ini mencampur metadata trace. Angka Todo 0/8 tetap berasal dari status item; mutation yang salah tempel bukan penyebab counter tersebut. Daftar Changes memakai koleksi mutation tersendiri, sehingga bug asosiasi step tidak berarti semua daftar perubahan file salah.

## Perbandingan oh-my-pi

Referensi lokal `/home/constantine/Code/Clone/oh-my-pi` mempunyai pengelola khusus di `packages/coding-agent/src/session/todo-tracker.ts`:

- Menyimpan state kanonis dan memulihkannya dari branch/transcript.
- Menghitung aktivitas sejak Todo terakhir disentuh, lalu memberi mid-run nudge dengan budget terbatas.
- Memeriksa item terbuka pada terminal assistant turn dan memberi completion reminder yang dibatasi; melewati kondisi menunggu jawaban pengguna/async wake tertentu.
- `tools/todo.ts:36` hanya mengambil state yang benar-benar dikomit oleh hasil sukses; failed/view tidak menjadi revisi baru. Batch yang gagal mempertahankan state sebelumnya.

Ini lebih lengkap daripada satu event ke UI ditambah instruksi generik. Reminder tetap perlu dibatasi agar checklist tidak menciptakan loop baru.

## Rencana perbaikan

1. Buat satu state Todo kanonis per conversation/run: update sukses, revisi/timestamp, persist, restore dan snapshot. UI memakai state ini; legacy fallback hanya menerima data yang valid dan berhasil. `[]` tetap bermakna clear.
2. Hubungkan state tersebut ke pengingat progres dan rekonsiliasi sebelum final, mengikuti prinsip oh-my-pi. Model diminta menandai pekerjaan yang benar-benar selesai atau menjelaskan sisa/blocker. Batasi reminder, hormati cancel/menunggu pengguna, dan pertahankan informasi task yang belum selesai.
3. Korelasikan file mutation ke toolCallId yang benar dan klasifikasi tool file yang eksplisit; Todo tidak termasuk file mutation.
4. Verifikasi create/update/clear, call gagal/malformed, reload/reconnect, pergantian chat, continue, serta run selesai/gagal/cancelled dengan item terbuka. Tambahkan pemeriksaan khusus bahwa Todo tidak mendapat metadata file.

## Pemeriksaan yang dijalankan

- Executor asli: create, update, clear berhasil mengirim state; input non-array ditolak tanpa update baru.
- Reducer host asli: bug mutation salah tempel berhasil direproduksi, serta state host valid dapat berbeda dari raw args call gagal terakhir.
- Sembilan tes snapshot/Activity yang sudah ada lulus. Cakupan ini belum membuktikan lifecycle Todo lengkap; mayoritas tes Activity saat ini berfokus pada source/media/changes.
- `pnpm --filter @const/harness-desktop check-types` lulus.

Probe sementara berada di `/tmp/const-todo-audit/probe.ts`. Tidak ada inference, event buatan pada chat live, atau perubahan sumber implementasi selama audit ini.
