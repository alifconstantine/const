# Audit folder kerja agent dan terminal — 5 November 2026

Kebijakan final mengikuti klarifikasi pengguna: ketika Project dipilih, agent,
terminal, file tools, integrasi MCP, dan scheduled task bekerja langsung di folder
project tersebut. Direktori internal per chat menyimpan log dan metadata sesi.
Outside Project tetap menggunakan direktori kerja mandiri milik percakapannya.

Ini menggantikan kebijakan checkout tugas otomatis pada audit sebelumnya dan
patch antara yang hanya memindahkan terminal manual ke source project.

## Penyebab screenshot masih salah

Startup agent masih memanggil `TaskWorkspaces.resolve(project, conversationId)`
untuk menyalin project/membuat Git worktree, lalu memasang `isolateWorkspace: true`.
Prompt bahkan memerintahkan model membuat hasil di salinan itu dan memperlakukan
project asli sebagai referensi. Mengubah cwd terminal manual saja tidak mengubah
cwd agent. Jawaban model pada screenshot sesuai konfigurasi yang salah tersebut.

## Perubahan akhir

- `WorkingDirectories.resolve` mengembalikan realpath project yang dipilih untuk
  semua chat. Tidak ada alokasi salinan, worktree, atau branch Git otomatis.
  Project yang hilang atau berupa file menghasilkan error, bukan fallback diam-
  diam ke Outside Project.
- Startup agent utama dan companion memakai resolver yang sama dengan terminal
  dan IPC workspace. Project yang tersimpan pada percakapan tetap digunakan
  ketika payload tidak mengirim workspacePath. Project payload yang bertentangan
  dengan project percakapan ditolak.
- Scheduled task memakai resolver yang sama, termasuk konfigurasi direktori
  default untuk Outside Project. Model dan MCP menerima cwd project sebenarnya.
- Instruksi sistem menyebut cwd saat ini dan memisahkan lokasi log. Petunjuk lama
  tentang checkout per chat tidak lagi menjadi direktori output yang berlaku.
- Opsi terminal project/tugas yang sempat ditambahkan dihapus. Tombol `+` kembali
  membuat terminal di folder kerja aktif. PTY, resize, replay, dan kontrol sesi
  tetap memeriksa conversation ID. Callback UI yang terlambat tidak menambahkan
  terminal pada chat lain.
- Terminal dengan metadata cwd salinan lama milik chat itu dapat dibuka ulang pada
  project asli. Pembacaan binding lama tidak membuat atau memindahkan file; path
  salinan chat lain dan symlink yang keluar tetap ditolak.
- ConversationDatabase tetap menyimpan event/transcript di
  `~/.const/harness/brain/<conversationId>/.system_generated/logs/`. Riwayat
  mutation/undo, background jobs, dan subagent tetap memiliki pemilik sendiri.

## File bersama dan perlindungan konflik

Beberapa chat dalam project yang sama sekarang melihat filesystem project yang
sama, sesuai permintaan. Agent diarahkan menggunakan subfolder berbeda untuk
hasil pekerjaan yang berbeda dan memeriksa isi terbaru sebelum mengedit.

Native write/edit/patch memakai lock penulis serta pemeriksaan versi file yang
sudah dibaca oleh chat tersebut. Pengujian empat create bersamaan pada satu path
menghasilkan satu keberhasilan; tiga penulis lainnya menerima konflik. Setelah
keempat chat membaca versi yang sama, empat edit bersamaan juga hanya menerima
satu penulis. Undo chat A tidak membatalkan file milik B/C/D.

Kontrol job dibatasi conversation ID, termasuk pencarian menggunakan nama yang
sama. Menghentikan job A tidak menghentikan tiga job lain. Pemeriksaan readiness
juga tidak menerima port milik proses asing sebagai bukti server tugas baru.

Pemeriksaan versi berlaku pada native file tools; perintah shell atau program
arbitrer yang sengaja menulis path yang sama tetap dapat mengubah file bersama.
Direktori project bersama bukan isolasi filesystem. Tidak ada klaim bahwa setiap
perintah shell atau editor eksternal dapat dicegah menimpa file yang sama.

## Validasi akhir

- Typecheck desktop: exit 0.
- 18 tes direktori kerja, terminal, label, dan native PTY lulus. Termasuk beberapa
  chat di project asli, branch/status Git tetap, alias symlink project, project
  hilang, Outside Project, dan pembacaan binding lama tanpa alokasi baru.
- 49 tes agent pada session-isolation/background-jobs/service-readiness/
  checkpoint-rollback/subagent lulus. Termasuk empat hasil di subfolder berbeda
  pada project yang sama, konflik create/edit bersamaan, undo per pemilik, serta
  empat job bernama sama dengan output dan penghentian terpisah.
- Build desktop production: exit 0. Log:
  `/tmp/const-direct-project-build-2026-11-05.log`.
- Startup Electron production: exit 0. Menggunakan provider tiruan lokal, empat
  agent asli menjalankan command untuk memeriksa cwd lalu menulis HTML ke
  subfolder project asli. Log masing-masing tetap di brain per chat. Outside
  Project, companion, scheduled task, pembatalan startup, dan empat PTY nyata
  juga lulus. Sepanjang pengujian tidak terbentuk direktori hidden workspaces.
  Log: `/tmp/const-direct-project-startup-2026-11-05.log`.
- 33 pemeriksaan Chromium pada fixture App melalui Vite development server
  lulus, termasuk perpindahan chat saat resolusi cwd tertunda dan tombol `+`
  yang membuka terminal kedua pada project yang sama. Screenshot diperiksa di
  `/tmp/const-direct-project-ui-2026-11-05/terminal-shared-project-directory.png`.
  UI fixture development dan startup bundle production merupakan dua pemeriksaan
  terpisah; keduanya tidak memakai project atau provider produksi pengguna.
- `git diff --check`: lulus.

Pemeriksaan resolver read-only terhadap project pengguna mengembalikan
`/home/constantine/Code/test-const-harness/Website` untuk beberapa conversation ID.
Output di checkout lama tetap ada pada path semula. Tidak ada migrasi/merge hasil
lama secara otomatis dan tidak ada job pengguna yang dihentikan selama audit.

## Referensi dan penerapan

Referensi DeepSeek Harness dibaca di
`/home/constantine/Code/Platform/const-harness`: `docs/subsystems/workspace.md`,
`docs/subsystems/terminal.md`, `packages/fs/tool-fs/src/session-cwd.ts`, dan
`packages/jobs/jobs-local/src/index.ts`. Cwd berasal dari sesi yang dipilih,
sementara operasi job/terminal memeriksa pemilik sesi; data log tidak menentukan
lokasi file project.

Patch dan build tersedia secara lokal. Aplikasi yang sudah berjalan harus memuat
build terbaru; sesi agent/terminal lama masih mempertahankan cwd lama sampai
berakhir/dibuka ulang. Windows native belum diuji langsung pada host Linux.
