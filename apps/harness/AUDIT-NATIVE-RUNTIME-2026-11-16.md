# Audit runtime Const Harness — 16 November 2026

Audit ini mencatat kondisi sebelum migrasi engine di commit `859b4129`. Integrasi yang sudah diterapkan dan hasil pengujian setelah migrasi ada di [perbandingan tool OMP](OMP-TOOL-COMPATIBILITY.md).

Pertahankan Electron untuk workbench, persetujuan dan remote UI. Jalankan Browser Use dan Computer Use melalui executable Rust versi terpin, dengan Harness tetap mengelola izin, sesi, pembatalan dan hasil yang masuk ke chat. Prioritaskan perbaikan lifecycle Coding Agent dan sambungkan Settings → Models ke adapter provider yang sudah ada di monorepo. Pakai oh-my-pi sebagai referensi lifecycle dan uji RPC-nya secara terisolasi sebelum mempertimbangkan penggantian engine.

## Revisi yang diperiksa

| Codebase | Commit | Lingkup |
| --- | --- | --- |
| Const Harness | `859b4129` | Jalur Electron ke agent, SSE, Todo, penyimpanan, Settings → Models, browser guest dan helper desktop |
| [agent-browser](https://github.com/vercel-labs/agent-browser/tree/53384771) | `53384771` | Daemon Rust, sesi CDP, snapshot, streaming dan pembungkus CLI |
| [agent-desktop](https://github.com/vercel-labs/agent-desktop/tree/8ffecc1d) | `8ffecc1d` | CLI JSON, core, adapter OS, FFI, batas input dan capture Wayland |
| [oh-my-pi](https://github.com/can1357/oh-my-pi/tree/67ef5342de) | `67ef5342de` | Siklus turn, pengalihan loop, Todo, provider, RPC dan crate native |

Ketiga repo referensi diperiksa dari checkout lokal. Checkout lama oh-my-pi yang bersih dipindahkan ke Trash sebelum clone ulang.

## Temuan Harness

### Loop tool yang bergantian bisa menghabiskan seluruh turn

Model tiruan mengirim tool call dengan argumen A, B, A, B dan hasil tetap. Dengan batas 10 turn, Harness menjalankan **10 request dan 10 tool call**, mengeluarkan dua checkpoint `repeated_result`, lalu gagal di batas turn. Guard pemblokir hanya melihat panggilan identik berturut-turut. Di chat utama, batas default 200 turn, sementara checkpoint pengulangan bersifat anjuran. [Guard eksekusi](../../packages/agent/src/const/const-agent.ts#L1693) · [Checkpoint](../../packages/agent/src/const/run-progress.ts#L15) · [Batas desktop](desktop/electron/main.ts#L1752)

Tambahkan evaluasi progres per turn berdasarkan pola panggilan, hasil stabil, serta perubahan state yang bisa diverifikasi. Beri kesempatan pengalihan strategi yang terbatas. Jika pola tetap berulang, simpan hasil parsial dan tampilkan alasan berhenti yang spesifik. Polling tersupervisi dan menunggu persetujuan atau jawaban perlu jalur lifecycle sendiri agar pekerjaan yang memang sedang menunggu tetap bisa berjalan. Oh-my-pi punya deteksi lintas turn dan pengalihan ke model. Harness tetap perlu menentukan sendiri kapan percobaan sudah habis. [Oh-my-pi LoopGuards](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/coding-agent/src/session/stream-guards.ts#L200)

### Todo tersimpan, tetapi pembaruannya masih bergantung pada model

Tes restore, kegagalan tool, clear, rejoin dan SQLite lulus. Pada satu sampel log lokal 6 November, run dengan 90 tool call mencatat tiga revisi Todo pada call ke-20, ke-80 dan ke-90. Tracker menaikkan counter stale hanya untuk kategori terminal, Python, dan mutasi file. Run yang banyak membaca, memakai browser, menjalankan MCP atau menunggu hasil subagent dapat menghasilkan sedikit sinyal ke tracker. Oh-my-pi menyediakan tracker dan perubahan Todo terstruktur, termasuk operasi per item dan pemulihan state dari riwayat. [Tracker Harness](../../packages/agent/src/const/todo-tracker.ts#L14) · [Kategori tool Harness](../../packages/agent/src/const/tool-policy.ts#L10) · [Penyimpanan Todo](desktop/electron/main.ts#L1875) · [Tracker oh-my-pi](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/coding-agent/src/session/todo-tracker.ts#L105) · [Operasi Todo oh-my-pi](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/coding-agent/src/tools/todo.ts#L512)

Pertahankan commit Todo dan instruksi rekonsiliasi yang terbatas. Tambahkan revisi per run dan ID item stabil, serta review pada milestone yang relevan. Jadikan keberhasilan test, perubahan state dan hasil subagent sebagai bukti yang bisa diperiksa sebelum checklist diperbarui. Bedakan Todo yang belum dibuat, Todo yang sudah kedaluwarsa, dan Todo yang terbukti tersimpan tetapi belum diterima UI.

### Run yang berhenti punya beberapa jalur diagnosis

Dari dua file log dengan aktivitas terbaru pada 12 November, empat run memiliki event terminal. Dua selesai. Dua gagal di request pertama dengan HTTP 400 karena ID model tidak dikenal atau sudah ditarik dari katalog. Audit 6 November mendokumentasikan kasus berbeda dengan 147 request selama hampir 64 menit, diikuti pembatalan yang sumbernya belum terekam pada versi itu. Keduanya perlu skenario uji sendiri. [Resolusi model Router](../router/src/lib/gateway.ts#L262) · [Audit 6 November](AUDIT-ROOT-CAUSE-2026-11-06.md#hasil-utama) · [Klasifikasi hasil run](../../packages/agent/src/const/const-agent.ts#L2294)

Pisahkan status dan batas waktu untuk respons provider, stream putus, tool timeout, interupsi pengguna, host crash, dan kehabisan turn. Gunakan satu anggaran retry per request logis, simpan checkpoint setelah hasil tool dikomit, dan bedakan aksi yang telah terkirim dari aksi yang aman diulang. Tambahkan uji replay untuk tool yang mengubah file atau GUI dan host mati setelah dispatch tetapi sebelum hasilnya sampai. Harness telah memiliki operasi lane dan SQLite writer lease di paket yang sama. Evaluasi pemanfaatan keduanya untuk checkpoint sebelum menambah penyimpanan baru. [Retry provider](../../packages/agent/src/const/const-agent.ts#L609) · [Deadline stream](../../packages/agent/src/const/chat-stream.ts#L19) · [Runtime lane](../../packages/agent/src/harness/runtime/drive.ts) · [SQLite lease](../../packages/session-backends/sqlite-node/src/sqlite/storage/writer-leases.ts)

### Settings → Models perlu provider registry milik host

Renderer menyimpan provider, protokol dan API key ke `localStorage`. Chat dan scheduled task membaca config Electron yang terpisah. Bila konfigurasi provider model hilang, resolver dapat memasangkan URL khusus model dengan API key dari config fallback Const. `ConstAgent` selalu membentuk URL `/chat/completions`. Pemilihan Anthropic Messages atau OpenAI Responses di UI belum mengubah transport chat. Probe mock juga membuktikan `testEndpointPing` melaporkan sukses untuk 401, 403 dan 404. [Config renderer](desktop/src/lib/models-config.ts#L563) · [Ping](desktop/src/lib/models-config.ts#L639) · [Resolusi chat](desktop/electron/main.ts#L1679) · [Scheduled task](desktop/electron/main.ts#L2735) · [Endpoint agent](../../packages/agent/src/const/const-agent.ts#L877)

**Provider native bisa diimplementasikan di Electron.** `@const/ai` sudah menyediakan adapter OpenAI Completions, Responses, Anthropic Messages dan Google, beserta tipe hasil stream. Monorepo juga punya `ModelRegistry` dan `AuthStorage` pada coding-agent. Gunakan pola oh-my-pi untuk memisahkan katalog, koneksi provider dan penyimpanan credential. Registry host harus memilih pasangan `providerId` dan `modelId`, menyimpan credential lewat OS-backed vault yang tersedia, dan mengirim metadata koneksi teredaksi ke renderer. Migrasikan setelan lama dan gunakan resolver yang sama untuk chat utama, side chat, scheduled task dan model picker. Bedakan hasil koneksi jaringan, validasi credential, discovery model dan stream uji. Mulai dengan Const Router yang sudah digunakan dan Anthropic Messages direct. Tambahkan Responses, Gemini dan login OAuth per adapter setelah kontrak ini teruji. [Adapter Const](../../packages/ai/src/compat.ts) · [ModelRegistry Const](../../packages/coding-agent/src/core/model-registry.ts) · [ModelRegistry oh-my-pi](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/coding-agent/src/config/model-registry.ts) · [Credential store oh-my-pi](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/ai/src/auth-storage.ts)

## Browser Use dan Computer Use native

### agent-browser

Rilis `0.43.0` membuka Chromium terisolasi, mengembalikan snapshot dengan ref, mengklik tombol fixture, lalu mengonfirmasi teks tombol berubah. Daemon Rust sudah menangani CDP, sesi, tab dan streaming. Jalur awal yang paling kecil adalah menjalankan browser automation terkelola per chat dan mengalirkan viewport-nya ke pane Harness. Browser saat ini terhubung ke Electron `webview` via `webContents.debugger`. Memakai daemon untuk guest yang sama memerlukan pembuktian bahwa akses CDP dapat dibatasi ke target itu. Pertahankan kebijakan navigasi, manual takeover, handoff secret, redaksi, pemetaan tab dan cleanup saat Stop. [Arsitektur agent-browser](https://github.com/vercel-labs/agent-browser/blob/53384771/README.md#how-it-works) · [Streaming agent-browser](https://agent-browser.dev/streaming) · [Browser controller Harness](desktop/electron/browser-controller.ts#L297) · [Guest policy Harness](desktop/electron/browser/guest-policy.ts)

Tes integrasi browser yang ada berhenti dua kali pada assertion piksel OTP. Probe sementara mengonfirmasi mask terlihat pada titik lain di bidang yang sama, dengan viewport dan image sama-sama 1000×900. Titik awal mengambil warna `[226,226,226]` dekat teks overlay dan empat titik lain mengambil warna mask `[34,34,34]`. Setelah assertion disesuaikan pada probe, tes berikutnya menemui timeout capture pada guest tersembunyi saat meminta screenshot agent dan remote bersamaan. Baseline browser belum hijau. Tambahkan uji redaksi yang memeriksa area stabil dan uji capture saat pane tersembunyi sebelum memindahkan traffic produksi. [Tes screenshot Harness](desktop/tests/browser.integration.ts#L226) · [Capture Harness](desktop/electron/browser-controller.ts#L2284)

### agent-desktop

Rilis `1.3.1` melaporkan AT-SPI tersedia. Pada fixture GTK4 di Hyprland Wayland, CLI mengambil snapshot berdasarkan window ID, menggunakan ref untuk klik semantik, lalu mengamati perubahan label. Harness sudah punya lease untuk desktop, antrean aksi, cache snapshot dan helper Swift, PowerShell, serta Python. Pasang adapter CLI JSON atau MCP stdio di belakang `ComputerController`. Petakan ref upstream ke snapshot yang benar, pertahankan lease dan hasil delivery, lalu gunakan capability probe untuk menentukan aksi yang tersedia. FFI bisa dipertimbangkan sesudah kontrak CLI teruji pada installer. [agent-desktop](https://github.com/vercel-labs/agent-desktop/blob/8ffecc1d/README.md) · [JSON dan retry](https://agent-browser.dev/desktop/json-output) · [Controller Harness](desktop/electron/computer/computer-controller.ts#L353) · [Helper yang ada](desktop/native/README.md)

Pada mesin ini, portal `org.freedesktop.portal.RemoteDesktop` tidak tersedia. Adapter upstream mengandalkan AT-SPI untuk tindakan semantik dan mendeteksi Mutter khusus untuk jalur keyboard Wayland. Pointer fisik masih terbatas, sementara screenshot Wayland memiliki jalur portal dengan consent. Uji capability per compositor dan OS sebelum menjanjikan klik koordinat, shortcut global atau capture desktop. Windows dan macOS belum diuji langsung. [Matriks Linux upstream](https://github.com/vercel-labs/agent-desktop/blob/8ffecc1d/skills/agent-desktop-linux/SKILL.md#capability-table) · [Backend input Wayland](https://github.com/vercel-labs/agent-desktop/blob/8ffecc1d/skills/agent-desktop-linux/references/display-servers-and-input.md#wayland-keys)

## Batas yang layak untuk Rust dan oh-my-pi

- **Tool native sebagai proses terpisah.** Packaging menyertakan binary dan versi protokol yang diketahui. Harness memvalidasi input, mengendalikan proses, serta menerjemahkan output JSON menjadi hasil tool. Ukur startup, timeout, teardown, ukuran installer dan risiko aksi ganda. Browser daemon dan desktop CLI memberi manfaat Rust sejak awal. Untuk Coding Agent, ukur dulu pencarian repo, operasi edit/diff dan pembatalan process tree sebelum memilih bagian berikutnya. Oh-my-pi memakai crate native untuk operasi seperti ini. [Crate native oh-my-pi](https://github.com/can1357/oh-my-pi/tree/67ef5342de/crates/pi-natives)
- **Coba engine oh-my-pi via RPC hanya sebagai eksperimen kompatibilitas.** RPC sudah punya prompt, steer, abort, terminal result per prompt dan host-tool bridge. Itu cukup untuk membuat prototipe dengan tool yang dikendalikan Harness. Agent-session dan provider upstream membawa asumsi Bun, context, retry dan kredensial sendiri. Uji dulu kemampuannya mempertahankan identitas run, izin, workspace, UI approval, Todo dan keterhubungan remote sebelum memakai hasil perbandingan untuk keputusan migrasi. [RPC oh-my-pi](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/coding-agent/src/modes/rpc/rpc-types.ts) · [Streaming Bun oh-my-pi](https://github.com/can1357/oh-my-pi/blob/67ef5342de/packages/ai/src/stream.ts#L168)
- **Pertahankan layanan cloud Router dan Convex pada fase ini.** HTTP 400, loop tanpa progres, dan Todo kedaluwarsa punya jalur perbaikan di host dan adapter. Migrasi layanan cloud baru layak dipertimbangkan jika profil latensi atau kebutuhan deployment menunjuk ke komponen tertentu.

## Urutan implementasi dan kriteria lulus

1. **Lifecycle dan Todo.** Replay model tiruan untuk loop A/B, stream putus sebelum tool lengkap, Stop saat tool aktif, approval yang menunggu, dan restart di tengah aksi. Setiap run punya satu status terminal dan bukti terakhir tetap tersedia. Todo tetap benar setelah pembatalan dan reload.
2. **Provider registry.** Simpan satu koneksi direct Anthropic, pilih modelnya, dan verifikasi URL, header dan event yang benar dari jalur chat utama dan scheduled task. Uji juga invalid key dan dua provider dengan model ID yang sama. Ulangi kontrak dengan Const Router.
3. **Browser terkelola.** Dua chat dapat melakukan snapshot dan klik pada tab masing-masing. Uji redirect policy, stale ref, Stop, takeover pengguna, secret handoff dan remote viewport. Hilangkan kegagalan baseline capture atau reproduksi dan tangani penyebabnya pada backend baru.
4. **Computer Use.** Uji observasi dan aksi semantik pada Linux Wayland, lalu jalankan fixture OS yang sama pada Windows dan macOS. Status operasi menunjukkan capability, delivery dan apakah retry aman.

## Verifikasi audit

- Desktop typecheck lulus. Sebanyak 61 tes agent terpilih, 18 tes desktop, dan 22 tes helper Linux lulus.
- Smoke agent-browser `0.43.0` berhasil pada halaman lokal terisolasi. Smoke agent-desktop `1.3.1` berhasil melakukan snapshot dan klik semantik GTK4 di Hyprland Wayland. Keduanya menguji rilis paket yang versinya cocok dengan manifest checkout.
- Tes integrasi browser Harness masih gagal. Probe piksel melangkahi assertion awal dan memperlihatkan timeout capture pada tahap berikutnya.
- Koneksi provider diuji dengan respons tiruan. Oh-my-pi diperiksa dari source. Uji OAuth, inference provider langsung, integrasi binary dengan Electron dan build lintas OS masih menjadi pekerjaan implementasi.
