# Tool call Const Harness dan oh-my-pi

Dokumen ini mencatat percobaan integrasi binary oh-my-pi `18.20.3` pada commit `c9e10727`. Runtime Harness Desktop sekarang memakai `@const/agent`. Guard loop, hasil parsial, dan tes kompatibilitas sesi tetap menjadi bagian dari engine Const. [RPC oh-my-pi](https://github.com/can1357/oh-my-pi/blob/v18.20.3/docs/rpc.md)

## Inventaris tool

Perbandingan memakai 64 definisi default Const dan 30 built-in plus 3 tool tersembunyi OMP. Ketersediaan bergantung pada tipe sesi, pengaturan plugin dan platform. Tool MCP dinamis muncul dari koneksi masing-masing workspace. [Definisi Const](../../packages/agent/src/const/tools.ts#L1464) · [Registry OMP](https://github.com/can1357/oh-my-pi/blob/v18.20.3/packages/coding-agent/src/tools/index.ts)

| Kelompok | Tool | Integrasi |
| --- | --- | --- |
| Nama sama di kedua registry | `read`, `write`, `edit`, `bash`, `find`, `grep`, `lsp`, `ast_grep`, `ast_edit`, `eval`, `checkpoint`, `task`, `wait`, `web_search`, `retain`, `recall`, `reflect`, `think` | Nama di schema model diawali `harness_` untuk menghindari tabrakan registry RPC. Activity dan riwayat memakai nama Const. Eksekusi tetap melewati izin dan workspace dari host. |
| Hanya Const, navigasi file dan shell | `ls`, `mkdir`, `powershell`, `apply_patch`, `run_command`, `jfind` | Tool host dengan schema Const. |
| Hanya Const, workflow dan layanan | `todo_write`, `ask_question`, `manage_task`, `agent_status`, `kill_agent`, `restore_checkpoint`, `rollback_mutation`, `web_fetch`, `git_status`, `git_diff`, `git_commit`, `git_log`, `gh` | `todo_write` diganti `todo` OMP. Sisanya memakai executor yang terhubung dengan UI, approval dan mutation ledger. |
| Hanya Const, Browser Use | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_key`, `browser_scroll`, `browser_screenshot`, `browser_console`, `browser_evaluate`, `browser_tabs`, `browser_request_help`, `browser_wait_for`, `browser_verify_text`, `browser_find`, `browser_hover`, `browser_paste` | Host mendaftarkannya saat plugin aktif dan dimuat. |
| Hanya Const, Computer Use | `computer_list_apps`, `computer_list_windows`, `computer_get_app_state`, `computer_click`, `computer_set_value`, `computer_type_text`, `computer_press_key`, `computer_hotkey`, `computer_paste_text`, `computer_scroll`, `computer_drag` | Host mempertahankan controller, izin dan lease desktop. |
| Hanya OMP | `todo`, `ask`, `glob`, `github`, `rewind`, `security_scan`, `debug`, `ida`, `context_notes`, `new_context`, `memory_edit`, `learn`, `manage_skill`, `yield`, `goal` | `todo` aktif dan hasil sukses dikonversi menjadi checkpoint Activity. Built-in lain perlu evaluasi izin dan kompatibilitas sebelum diaktifkan di Harness. |

### Perbedaan kontrak

- **Todo.** Const mengganti seluruh daftar lewat `todo_write({ todos })`. OMP memakai operasi `init`, `start`, `done`, `rm`, `drop`, `append` dan `view`. Nama fase disimpan bersama item, lalu dikembalikan ke OMP pada run berikutnya. Item yang ditinggalkan lewat `drop` dikeluarkan dari checklist aktif. [Implementasi Todo OMP](https://github.com/can1357/oh-my-pi/blob/v18.20.3/packages/coding-agent/src/tools/todo.ts)
- **Tool coding.** OMP memiliki schema dan jalur workspace sendiri untuk read, grep, edit dan shell. Crate Rust-nya menyediakan operasi pencarian, edit, diff dan shell. Perpindahan masing-masing executor perlu mempertahankan path scope, preview diff, pencatatan mutasi dan pembatalan proses milik Const. Penggantian engine ini memakai crate yang dikemas bersama OMP dan mempertahankan executor host untuk tool tersebut. [Crate native OMP](https://github.com/can1357/oh-my-pi/tree/v18.20.3/crates/pi-natives)
- **Model.** OMP menerima model dan endpoint kompatibel OpenAI yang sudah diselesaikan oleh Electron. Runtime menyuntikkan credential lewat environment worker terisolasi. Settings → Models dan alur login provider native memiliki perubahan tersendiri.

## Benchmark dan regresi loop

Perbandingan memakai commit lama `859b4129` dan binary OMP `18.20.3` di Linux x64 dengan server model lokal deterministik. Angka berikut adalah median, tanpa waktu rendering Electron.

| Skenario | Const lama | OMP sebelum perbaikan pembatalan |
| --- | --- | --- |
| Jawaban langsung, 7 pengulangan | 10 ms, 1 request | 1,35 dtk, 1 request |
| Tiga kali baca file, 7 pengulangan | 18 ms, 4 request | 1,07 dtk, 4 request |
| Loop A/B, jeda 150 ms per request, 3 pengulangan | 3,20 dtk, 20 request, 20 aksi | 3,28 dtk, 8 request, 7 aksi |

OMP memulai proses baru per run. Pada benchmark loop, request kedelapan sempat dikirim saat worker sedang dibatalkan. Host kini menyimpan hasil aksi ketujuh dan membatalkan worker sebelum hasil itu memicu turn berikutnya. Tes startup Electron memeriksa tujuh request, hasil tool terakhir yang utuh, dan bukti parsial yang tersimpan. Waktu benchmark di atas mencatat implementasi sebelum perbaikan tersebut. [Regresi Electron](desktop/tests/startup.integration.cjs)

## Pengembangan

Jalankan build desktop dan `pnpm --filter @const/harness-desktop test:startup` untuk menguji engine Const lewat Electron dengan server model lokal. Batas 200 pada integrasi tersebut berasal dari host Harness dan menghitung turn model. Loop utama oh-my-pi memeriksa tool call dan pesan yang masih perlu diproses. Harness sekarang memakai pengaman siklus tanpa progres dan menghormati batas turn yang diberikan pemanggil.
