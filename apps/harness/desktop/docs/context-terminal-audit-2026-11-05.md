# Audit konteks dan terminal Const Harness — 5 November 2026

Audit ini mencocokkan tiga percakapan lokal dengan alur agent desktop, router,
reservasi backend, terminal IPC, renderer, dan konfigurasi packaging. Database
dibuka read-only; percakapan, artefak pekerjaan, dan server pengguna tidak diubah.
Perubahan yang dijelaskan di bawah adalah patch lokal, belum deployment produksi.

## Hasil pemeriksaan log

Waktu di tabel adalah WIB (UTC+7), 5 November 2026.

| Pekerjaan | Conversation ID | Akhir proses | Bukti |
| --- | --- | --- | --- |
| Robot Jellyfish | `session_1793850765959` | 11:00:16, HTTP 400 | `Request exceeds model context window`, tepat setelah membaca screenshot kedua |
| Leon Vasari / VHS Shelf | `session_1793850789991` | 11:00:33, HTTP 400 | Error identik, tepat setelah membaca screenshot |
| Spider / Found | `session_1793850487650` | 11:02:14, dibatalkan | Request terakhir berstatus `cancelled`; event `User cancelled agent execution.` |

Sumber: `~/.const/harness/conversations/conversations.db` dan
`~/.const/harness/brain/<conversationId>/.system_generated/logs/events.jsonl`.
Untuk Jellyfish, pembacaan gambar terakhir ada pada baris 1285 dan 1314,
error pada 1319. Untuk VHS, pembacaan gambar ada pada 13292, error pada 13297.
Jumlah request masing-masing: Jellyfish 26 selesai + 1 gagal; VHS 16 selesai +
1 gagal. Spider memiliki run awal gagal, lalu 34 request selesai dan request
terakhir dibatalkan; pembatalannya tidak membuktikan bug konteks yang sama.

File Jellyfish `robot jellyfish/index.html` masih ada (52.766 byte) di workspace
`~/.const/harness/workspaces/fea7a1ec2bebe1ff19de052a/project/`.
File VHS `shelf hero/src.html` masih ada (39.516 byte) di workspace
`~/.const/harness/workspaces/a65938351c6fb4fa80e76464/project/`.
Ini membuktikan hasil pembuatan file tersimpan, bukan bahwa seluruh verifikasi
visual dan interaksi sudah selesai. Log menunjukkan server preview sudah dibuat
sebelum kedua error.

## P1 — Encoding gambar dihitung sebagai token konteks

Terbukti dari source dan urutan event. `apps/router/src/lib/gateway.ts` semula
menghitung panjang byte JSON seluruh messages sebagai `estimatedInput`, termasuk
data URL base64 gambar. Untuk media, `promptBudget` mengambil nilai maksimum
antara hitungan itu dan sisa window model. Backend
`packages/backend/convex/router/gateway.ts` menolak jika prompt + output melebihi
window; teks error backend persis sama dengan kedua log.

Jellyfish membaca PNG 464,9 KB dan 476,0 KB; dua observasi gambar terbaru
dipertahankan oleh `tool-observations.ts`. Base64 keduanya saja kira-kira
1,28 juta karakter, sebelum teks, tools, dan cadangan output. VHS membaca PNG
641,1 KB; encoding, riwayat, tools, dan cadangan output juga dapat melewati
anggaran reservasi. Indikator UI menggunakan estimasi konteks model, sehingga
tetap menunjukkan sekitar 4–5% saat router menolak encoding transport.

Patch membuat proyeksi teks tanpa payload media untuk pemeriksaan admission.
Reservasi media tetap konservatif sebesar sisa window, provider tetap menerima
gambar asli, dan settlement tetap memakai usage provider. Batas ukuran request
4 MB serta pemeriksaan teks yang terlalu panjang tetap berlaku. Pemeriksaan
combo sebelumnya menghitung encoding yang sama; sekarang memakai proyeksi teks
yang sama. Patch ini tidak mengklaim tokenizer atau estimasi billing fallback
tanpa usage provider menjadi akurat.

## P1 — Agent desktop langsung berhenti pada overflow

`ConstAgent` desktop memiliki loop sendiri, terpisah dari runtime harness umum.
HTTP 400 langsung dilempar sebagai error; compaction pada runtime harness umum
tidak otomatis melindungi loop ini. Penanganan SSE sebelumnya juga mengulang
request tanpa mengurangi ukuran untuk error konteks.

Patch mengenali error konteks pada HTTP dan SSE, lalu memberi satu kesempatan
per request yang ditolak dengan proyeksi riwayat lama yang lebih ringkas dan
output maksimum 8.192 token. Keberhasilan request menutup percobaan recovery;
overflow pada langkah berikutnya boleh pulih lagi dengan batas yang sama.
Instruksi pengguna terbaru, pasangan tool call/result, dan bukti tool terbaru
tetap dipertahankan; transcript asli tidak dipotong. Cadangan output normal
dibatasi terhadap perkiraan sisa window dengan margin. Error lain tidak masuk
jalur recovery ini. Jika pengurangan tetap tidak cukup, error tetap ditampilkan;
tidak ada retry tanpa batas atau perpindahan model otomatis.

Ini pemulihan terbatas, bukan pengganti summarization adaptif penuh untuk task
yang benar-benar memenuhi window model. Hitungan byte teks router masih bersifat
konservatif, berbeda dari estimasi token indikator UI.

## Audit lanjutan media native dan capability

Run terbaru VHS `session_1793862076525` membaca PNG 1.201,9 KB pada 14:10:10 WIB,
lalu menerima dua HTTP 400 sebelum berhenti pada 14:10:14. Jellyfish
`session_1793862065762` berhasil memproses PNG 370,8–459,6 KB, pulih dari overflow
pada PNG 488,9 KB, lalu berhenti setelah membaca `sheet.png` 1.452,4 KB pada
14:11:55. Base64 kedua file besar masing-masing 1.640.984 dan 1.982.944 karakter.
Recovery desktop sudah aktif pada run tersebut; patch router belum menjadi
deployment produksi. GitHub mencatat production const-router masih pada commit
`c303262e07a46f78e76f8916426ef6176a2da57b` ketika audit ini dilakukan.

Gambar dari upload composer dan native read dikirim sebagai bagian `image_url`
multimodal. Base64 di dalam data URL adalah encoding transport native, bukan
teks yang disuruh dibaca model. Proyeksi teks hanya dipakai saat admission router;
payload provider tidak diubah. Regresi mencakup kedua gambar besar bersamaan.

Katalog publik `/v1/models` pada 5 November 2026 menyatakan 17 dari 21 model chat
menerima gambar. Empat model text-only: `deepseek-v4-pro`, `qwen-3.8-2.4t-a95b`,
`glm-5.3`, dan `grok-4.7`. Ini verifikasi metadata routing, bukan inference live
berbayar terhadap seluruh provider. Daftar bawaan desktop cocok dengan metadata
tersebut. Tes menjalankan request composer untuk semua 21 model: model vision
mempertahankan bagian gambar; model text-only menerima pemberitahuan eksplisit
agar tidak mengaku melihat gambar. Data upload pengguna tidak diubah.

Kesalahan gambar korup, overflow, atau browser tidak lagi dianggap sebagai bukti
bahwa model tidak memiliki vision hanya karena pesan error menyebut image_url.
Fallback teks dipakai saat capability text-only diketahui atau provider secara
eksplisit menolak input gambar. Recovery direset setelah request sukses sehingga
tidak habis untuk seluruh run; request yang tetap ditolak hanya diulang sekali.

Audit browser capture dan pemilihan shell Fish/Bash ditunda sesuai arahan pengguna.
Perubahan cwd/project dan PTY dari pekerjaan sebelumnya tetap termasuk dalam
commit perbaikan ini; tidak ada perbaikan browser tambahan pada tindak lanjut media.

Validasi tindak lanjut: 69 tes router, 51 tes agent (core, recovery, media,
isolasi sesi), typecheck router/desktop, dan build desktop production lulus.
Tes capability mencakup semua 21 model katalog tanpa inference berbayar ke setiap
provider. Log build: `/tmp/const-native-media-build-2026-11-05.log`.

## P1 — Terminal Windows dijalankan dengan pipe, tanpa console interaktif

Terbukti dari source; belum direproduksi pada Windows native. Handler sebelumnya
menjalankan `cmd.exe`/PowerShell dengan `stdio: pipe` dan `windowsHide`, lalu
meneruskan karakter xterm mentah. Tidak ada PTY/ConPTY atau jalur resize.
Ini dapat menghasilkan prompt, echo, Enter, Ctrl+C, dan program interaktif yang
tidak berperilaku seperti terminal. Kegagalan create yang dikembalikan sebagai
`{success:false}` juga diabaikan renderer. Pada pemasangan ulang komponen,
output prompt yang sudah keluar tidak diputar kembali.

Patch mengganti proses dengan `node-pty` 1.1.0 (PTY Unix, ConPTY Windows sesuai
platform), tanpa shell wrapper berbasis string. Native addon dimuat saat create,
agar kegagalan load tidak menggagalkan startup seluruh aplikasi. Resize melewati
bridge dan allowlist remote, dengan validasi owner dan dimensi. Create paralel
untuk ID yang sama menghasilkan satu proses; shutdown membatalkan create yang
masih pending. Kontrol dan event tetap memiliki conversation owner.

Output terakhir dibatasi 65.536 karakter dan dikembalikan saat reattach dengan
nomor urut, sehingga renderer dapat memulihkan prompt tanpa menggandakan event
yang sudah termasuk snapshot. Error start dan exit dilokalkan ke lima bahasa.
Addon tetap eksternal dari bundle Vite dan di-unpack dari ASAR untuk packaging.
Build script native diizinkan eksplisit dalam `pnpm-workspace.yaml`.

Referensi API: [Microsoft node-pty](https://github.com/microsoft/node-pty).

## Validasi

- `pnpm --filter @const/router test`: 68 tes lulus, termasuk screenshot besar,
  payload gambar tetap utuh, teks berlebih ditolak, dan jalur combo.
- `pnpm --filter @const/router check-types`: lulus.
- Tes agent terfokus: 41 lulus di `const-context-recovery`, `const-agent`,
  `tool-observations`, dan `const-agent-telemetry`.
- `pnpm --filter @const/harness-desktop test:terminal`: 6 tes lulus, termasuk
  PTY nyata di Linux yang menerima input dan resize 111 × 33, ownership,
  deduplikasi create, reattach, dan load addon gagal.
- `pnpm --filter @const/harness-desktop check-types`: lulus, exit 0.
- `pnpm --filter @const/harness-desktop build`: lulus, exit 0; log build lokal
  di `/tmp/const-harness-audit-build-2026-11-05.log`. Peringatan ukuran chunk dan
  anotasi dependency masih ada; build tidak gagal.
- `pnpm --filter @const/harness-desktop test:startup`: lulus menggunakan bundle
  production Electron, preload, renderer, dan IPC nyata dengan profil sementara.
  Terminal menjalankan `echo`, menerima resize, memutar kembali output, dan
  menolak kontrol owner lain. Probe IPC memakai `/bin/sh` di Unix karena tidak
  memasang xterm untuk menjawab query kapabilitas fish/zsh. Ini tidak menggantikan
  pengujian UI Windows native.
- `git diff --check`: lulus.

## Penerapan dan batas audit

Router harus dideploy ulang agar endpoint produksi memakai perhitungan baru.
Perubahan agent dan terminal memerlukan build/update desktop; binary yang sedang
berjalan tidak otomatis berubah karena source diedit. Build installer Windows
x64/ARM64 dan smoke test native masih diperlukan: buka terminal, ketik perintah,
uji Enter/backspace/arrow/Ctrl+C, resize, tutup/buka panel, lalu pindah percakapan.
Audit pada host Linux tidak membuktikan semua perilaku Windows sudah benar.
