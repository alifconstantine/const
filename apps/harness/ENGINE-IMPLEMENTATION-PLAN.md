# Rencana implementasi engine coding Const Harness

## Target

Bangun runtime coding yang dapat dijalankan dan diuji di Node sebelum terhubung ke Electron. Gunakan loop asli Pi untuk mengatur giliran model, tool call, dan pembatalan. Const menangani transport Router, izin workspace, penyimpanan progres, dan keputusan berhenti berdasarkan hasil verifikasi. Setelah tes engine lulus, sambungkan event ke Working Process, Todo, approval, error, dan background job di Harness.

Fase pertama mencakup coding di workspace, shell, Todo, pertanyaan pengguna, dan background job. Migrasi Browser Use dan Computer Use dilakukan setelah engine memiliki baseline yang bisa diukur. Gunakan profiling untuk menentukan operasi lokal yang layak dipindah ke Rust.

## Source yang diadopsi

| Source | Keputusan |
| --- | --- |
| **Pi Agent Core 1.5.2**, referensi source di checkout `D:/Code/Clone/pi` pada `747c217b81980206063a89e46645b362de7ac8b1` | Gunakan artefak npm Pi 1.5.2 yang dipin di lockfile. Manifest release dan checkout berbeda pada versi SDK Google, jadi checkout tetap dipakai sebagai referensi source. Telusuran impor dari `agent.ts` mencakup empat file lokal dan dua paket eksternal. Entry point publik `index.ts` menambah dua file lokal. |
| **oh-my-pi**, checkout `D:/Code/Clone/oh-my-pi` pada `82429e83d7e80e3ab659bea4f9cea103d93a1e0b` | Gunakan `tool-call-loop-guard.ts` dan `stream-guards.ts` sebagai referensi untuk pengalihan strategi. Gunakan `todo-tracker.ts` dan logika wake source di `agent-session.ts` untuk membedakan Todo terbuka, job yang hasilnya masih ditunggu, dan run yang sudah berakhir. Port aturan yang dibutuhkan beserta skenario tesnya ke Node. |
| **Const saat ini** | Pakai kembali executor file dan shell, `ToolAuthorization`, mutation ledger, job manager, persiapan payload, dan kontrak event Harness. Gunakan perubahan workspace saat ini sebagai baseline replay. Entry point Desktop beralih ke engine baru setelah tes, melalui kontrak yang juga menangani Stop, steering, dan approval. Periksa pemanggil `createConstAgent` di aplikasi lain sebelum menghapus kode lama. |

Empat file yang terjangkau dari `agent.ts` adalah `agent.ts`, `agent-loop.ts`, `types.ts`, dan `stream-fn.ts`. Core memakai `@earendil-works/pi-ai` dan `@earendil-works/pi-schema` versi `1.5.2`. Host perlu menyediakan `streamFn` untuk Router. Integrasi juga membutuhkan adapter untuk tool, event, sesi, dan pengujian. Pakai fasilitas build serta penyimpanan Const yang sudah ada saat kontraknya cocok.

Tentukan cakupan penyalinan setelah perakitan pertama. Jika hook upstream cukup, gunakan paket yang dipin. Jika perubahan source diperlukan, salin unit yang dipakai ke `@const/agent` dalam satu perubahan yang mudah dibandingkan dengan upstream. Sertakan lisensi, catat revisi, periksa resolusi impor dan build ESM, lalu kaitkan setiap penyesuaian dengan tes.

## Status prototipe Node

`@const/harness-engine` mengimpor Pi Core dan Pi AI 1.5.2 langsung. Konfigurasi TypeScript paket ini berdiri sendiri karena konfigurasi lama memetakan nama paket Pi ke source Const. Hook Pi menghubungkan izin workspace dan guard Const. Model dan tool beroperasi lewat adapter OpenAI-compatible dari Pi.

Fixture HTTP lokal menguji pasangan hasil `write` dan `read`, validasi schema dan JSON, pembatalan dan penolakan approval, stream yang tidak mengirim `finish_reason`, serta penawaran harga 503. Prototipe mengharuskan `finish_reason`. Uji Router live perlu memastikan perilaku ini pada profil yang digunakan Harness.

Guard memberi kesempatan mengubah strategi untuk siklus tool yang terkonfirmasi. Fixture siklus A/B berhenti di request ketujuh jika hasil tetap sama. Fixture yang membaca 201 baris berbeda selesai di request ke-202. Pemanggil dapat mengatur `maxTurns` dan membaca `stopReason` untuk membedakan batas eksplisit dari loop. Guard ini masih memakai aturan progres Const sehingga perlu diperluas untuk verifikasi yang terus gagal setelah mutasi.

Sembilan tool inti sudah terhubung. `wait` dan `manage_task` tersedia saat sesi punya job aktif atau riwayat job di proses host. Snapshot memuat fase run, approval atau pertanyaan yang tertunda, Todo, dan status job. Host menerima satu `run_end` per run dan dapat berlangganan event job per sesi.

Todo dipulihkan dari hasil tool di transcript Pi, termasuk checklist yang sengaja dikosongkan. Fixture Stop saat menunggu jawaban membatalkan pertanyaan, lalu `continue()` dari transcript membawa hasil write terdahulu tanpa mengulanginya. Fixture shell menguji exit code, job yang dibatalkan bersama run pemiliknya, dan server lokal yang tetap berjalan setelah run selesai. Pemulihan ini memakai transcript dan job manager di host Node. Penyimpanan sesi desktop dan pemulihan setelah host restart masih perlu disambungkan.

## Urutan implementasi

### 1. Jalankan Pi Core dengan transport Const

- Buat entry point engine yang menerima riwayat, konfigurasi model, registry tool, dan sinyal pembatalan. Verifikasi build Node di workspace Const, lalu gunakan fake provider untuk membuktikan bahwa engine dapat menjawab, memvalidasi argumen tool, menerima hasilnya, dan menyelesaikan run tanpa Electron. Gunakan tes loop dan validasi argumen Pi sebagai pembanding perilaku.
- Masukkan transport Router lewat `streamFn` dan persiapan konteks lewat `prepareRequest`. Pertahankan aturan payload, pairing tool call dan tool result, serta diagnostik request. Beri setiap run, turn, request, dan tool call identitas yang bisa dikorelasikan.
- Hubungkan izin workspace lewat `beforeToolCall`. Jalankan tool berurutan pada fase pertama. Catat hasil dan mutasi sebelum menjadwalkan turn model berikutnya. Saat efek suatu tool belum diketahui setelah gangguan, periksa bukti sebelum mencoba ulang.

### 2. Pasang tool dan lifecycle run

- Aktifkan sembilan tool awal `read`, `write`, `edit`, `bash`, `find`, `grep`, `ls`, `todo_write`, dan `ask_question`. Pertahankan arti `find` sebagai pencarian path. Muat `powershell` sesuai lingkungan, `apply_patch` saat dibutuhkan, dan `wait` serta `manage_task` saat ada job. Tambahkan subagent, web, dan MCP setelah jalur inti lulus.
- Pisahkan status saat model bekerja, tool aktif, approval atau jawaban ditunggu, dan job sedang ditunggu. Tool `wait` memakai event dari job manager. Job yang dimaksudkan terus berjalan, seperti dev server, tetap dapat dikelola dari UI setelah jawaban utama selesai. Run menerima satu status terminal dan Stop menutup permintaan yang masih dimilikinya.
- Simpan Todo, hasil tool, dan bukti verifikasi saat run berlangsung. Saat renderer reload, bangun kembali tampilan dari state host. Saat pengguna melanjutkan setelah gagal, pulihkan hasil sebelumnya tanpa memutar ulang mutasi yang sudah tercatat.

### 3. Perbaiki progres dan recovery

- Gunakan `finishTurn` untuk mengevaluasi hasil sebelum request berikutnya. Pertahankan guard untuk aksi identik. Tambahkan pemeriksaan berdasarkan kriteria tugas dan bukti teramati, seperti hasil tes, kondisi halaman, atau diagnostik yang berubah. Edit sukses memperbarui status aksi. Hasil cek menentukan apakah kriteria tugas membaik.
- Saat cek yang sama berulang kali gagal, minta satu perubahan strategi yang spesifik. Jika cek tetap gagal setelah perubahan strategi, simpan artefak dan bukti terakhir serta tampilkan alasan berhenti. Run yang terus menunjukkan progres dapat berjalan melewati 200 turn. Batas eksplisit pemanggil diuji.
- Bedakan stream yang belum menghasilkan jawaban atau tool call, stream terputus, HTTP 413, dan penolakan penawaran berdasarkan anggaran Router. Untuk stream yang hanya berisi reasoning, gunakan batas waktu terpisah dan maksimal satu retry adaptif pada fase pertama. Untuk 413, retry hanya jika payload berhasil diperkecil. Untuk error penawaran anggaran yang sama, tampilkan penyebabnya sambil menghormati kebijakan harga yang berlaku.

### 4. Sambungkan ke Harness

- Petakan event engine ke `AgentEventMap` dan alur Desktop yang sudah dipakai Working Process, Todo, approval, error, dan background job. Tambahkan indikator menunggu dan retry sesuai status engine.
- Batch delta teks, reasoning, dan log job. Segera teruskan event struktural seperti approval, Stop, hasil tool, dan status akhir. Uji beberapa percakapan aktif, termasuk reload saat write atau approval sedang berlangsung.
- Jalankan fixture Electron terhadap engine baru terlebih dahulu. Alihkan main chat, side chat, dan scheduled task setelah kontrak sesi lulus. Catat alat yang tersedia pada setiap mode, termasuk side chat dan scheduled task, sebelum mengganti jalur produksi.

## Pengujian dan hasil yang diharapkan

Gunakan respons SSE fixture, jam virtual, dan workspace sementara. Bentuk replay dari pola pada log 16 November. Rekam hasil engine lama dan baru pada fixture yang sama. Replay Reelmark di fase ini memakai fixture hasil verifikasi agar guard bisa diuji sebelum integrasi Browser Use.

| Skenario | Kriteria lulus yang diusulkan |
| --- | --- |
| Coding normal dan run panjang | Tugas membuat dan mengedit file, menjalankan tes, lalu mengembalikan status selesai dengan hasil tes. Fixture progres melewati 200 turn. Batas yang diberikan pemanggil menghasilkan status dan hasil parsial yang tepat. |
| Siklus identik dan pola Reelmark | Replay A/B berhenti dalam paling banyak tujuh request seperti baseline. Replay edit dengan argumen berubah dan hasil verifikasi tetap sama berhenti setelah paling banyak tiga kegagalan pada cek yang sama, termasuk satu kesempatan mengganti strategi. Artefak terakhir tersimpan dan cek tetap tercatat gagal. |
| Stream reasoning saja dan stream putus | Jam virtual membuktikan batas reasoning berjalan sejak respons mulai, termasuk saat reasoning terus mengalir. Setelah batas tercapai ada paling banyak satu retry yang mengubah pendekatan, misalnya dengan mengurangi budget reasoning pada profil yang mendukungnya. Tool call yang belum lengkap tidak dieksekusi. Setiap request dan hasil akhir tercatat. |
| 413 dan 503 kebijakan harga | Untuk 413 yang bisa dipulihkan, body retry lebih kecil, riwayat lengkap tetap bisa dibaca, dan tool yang menghasilkan output hanya dijalankan sekali. Fixture 503 penawaran harga menampilkan kategori khusus tanpa mengirim ulang request identik. |
| Stop, approval, dan pemulihan | Stop sebelum approval selesai menghasilkan nol write. Pembatalan saat tool aktif menutup run sekali dan menyimpan bukti yang sudah ada. Reload dan continue tidak menduplikasi write yang telah tercatat. |
| Todo dan background job | Todo dipulihkan sebelum dan sesudah reload, termasuk daftar yang sengaja dikosongkan. Job dapat ditunggu lewat event, status exit muncul di UI, dan dev server yang sengaja dijalankan terus tidak menahan finalisasi chat. |
| Working Process di Electron | Burst 1.000 delta pada satu stream tetap utuh dan berurutan, dengan pembaruan mendekati 30 kali per detik selama stream kontinu. Event approval dan terminal tetap diproses ketika renderer sibuk. Hasil dan status berasal dari percakapan yang benar. |

Untuk baseline yang dapat direproduksi, build paket AI memakai katalog yang sudah tersimpan di Git. Jalankan suite Vitest headless dan regresi `run-progress`, `chat-stream`, `request-payload`, `approval-flow`, dan `background-jobs`.

```text
pnpm --filter @const/telemetry build
pnpm --filter @const/ai build:offline
pnpm --filter @const/agent build
pnpm --filter @const/harness-engine build
pnpm --filter @const/harness-engine check-types
pnpm --filter @const/harness-engine test
pnpm --filter @const/agent test
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-desktop build
pnpm --filter @const/harness-desktop test:startup
pnpm --filter @const/harness-desktop test:renderer
pnpm --filter @const/harness-desktop test:side-chat
pnpm --filter @const/harness-desktop test:payload
pnpm --filter @const/harness-desktop test:remote
```

Suite agen penuh memiliki kegagalan baseline pada import lama dan symlink Windows. Catat kegagalan yang direproduksi di baseline agar penggantian engine tetap dinilai dari regresi pada jalur yang berubah.

Sebelum cutover, lakukan smoke test Windows dengan Router live untuk coding sederhana, prompt panjang yang pernah menghasilkan stream reasoning saja, dan background job. Bandingkan request, token input termasuk cache, token output, TTFT, durasi tool, dan status akhir. Targetnya lebih sedikit putaran yang gagal memperbaiki hasil, recovery yang mengubah strategi, dan UI yang bisa dibuka kembali dengan progres yang sama. Tetapkan batas waktu reasoning dari hasil pilot per profil model. Angka tujuh request, tiga cek gagal, dan satu retry adalah target awal untuk skenario regresi di atas.
