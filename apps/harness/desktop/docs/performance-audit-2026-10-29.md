# Audit performa desktop — 29 Oktober 2026

Audit mencakup `apps/harness/desktop` dan runtime `packages/agent/src/const`. Temuan dicocokkan dengan implementasi, bukan dianggap benar berdasarkan laporan sebelumnya. Tidak ada pemanggilan model berbayar dalam pengujian ini.

## Penilaian laporan sebelumnya

| Temuan | Hasil pemeriksaan | Keputusan |
| --- | --- | --- |
| `appendFileSync` untuk setiap event stream | Benar; jalur token melakukan pengecekan direktori dan append sinkron di main process. Frekuensinya mengikuti delta SSE, bukan pasti satu event per token model. | Ganti dengan batch JSONL asinkron. |
| IPC untuk setiap delta | Benar; tidak ada batching pada jalur main chat. Klaim 100+ event/detik perlu pengukuran model yang dipakai. | Gabungkan delta berurutan selama 16 ms. |
| Memo pesan gagal | Benar; banyak callback berubah setiap render dan timer diberikan ke semua baris. React tetap melakukan reconciliation; kalimat “render ulang dari nol” tidak tepat untuk semua DOM. | Stabilkan callback dan batasi props yang berubah ke pesan terkait. |
| Biaya Markdown/DOMPurify | Parser dan sanitasi memang bekerja saat paragraf aktif berubah. DOMPurify memakai DOM browser; bukan membangun keseluruhan virtual DOM aplikasi. | Teks polos dirender melalui escaping React; Markdown/HTML tetap disanitasi. |
| OpenUI selalu masuk prompt | Benar; kode lokal memuat 38.059 karakter, bukan tepat 40.000. | Pindahkan ke referensi skill dalam plugin Intelligence UI. |
| Semua cache selalu gagal | Terlalu mutlak. Prefix yang masih sama bisa dipakai ulang. Peringatan budget juga hanya aktif setelah ambang budget, bukan otomatis di setiap turn. | Pindahkan reminder dinamis ke pesan system sementara di akhir request. |
| Semua tool browser/computer tetap terkirim walaupun nonaktif | Tidak benar untuk kode saat audit: filter skema dan pemeriksaan sebelum eksekusi sudah ada; pengaturan global dan plugin juga sudah disinkronkan. Yang masih boros adalah tool plugin yang aktif selalu diiklankan. | Tambahkan pemuatan skema sesuai kebutuhan. |
| Skema native 6–8 ribu token | Tidak cocok dengan estimasi kode saat ini: 64 skema sekitar 13.094 token memakai estimator karakter/4. Ini bukan tokenizer provider. | Kurangi skema awal dan ukur ukurannya secara reproduktif. |
| Retensi output tool besar | Benar untuk recent window. Namun memangkas hasil sebelum dibaca model dapat menghilangkan bukti yang diperlukan. | Pertahankan seluruh batch yang belum dilihat model; batasi output `read`/shell yang sudah diamati. |
| Serialisasi percakapan ke localStorage | Benar, termasuk checkpoint dan telemetry. Telemetry bukan event setiap token. Kegagalan kuota juga sebelumnya dapat melewati penyimpanan SQLite karena keduanya berada dalam satu `try`. | Gunakan cache memori + SQLite/host sebagai sumber utama desktop. |
| Mermaid dimuat eager | Benar. Excalidraw dan IntelligenceBlock sendiri sudah memakai lazy loading. Angka ukuran Mermaid perlu merujuk hasil build, bukan asumsi paket. | Lazy-load komponen Mermaid. |
| Sidebar/toolbar besar tanpa memo | Ada potensi biaya, tetapi ukuran file bukan ukuran biaya render. Menambah memo tanpa menstabilkan props tidak cukup. | Fokus pada jalur pesan; evaluasi panel lewat profiler sebelum refactor lebih luas. |
| Preview file membuat semua baris DOM | Benar. Baris bisa membungkus dan mendukung folding, sehingga virtualisasi dengan tinggi tetap bisa mengubah perilaku. | Dicatat sebagai pekerjaan lanjutan; belum diubah. |

Angka “3–5× lebih cepat”, “TTFT 2 detik menjadi 300 ms”, “hemat biaya 80%”, dan “stabil 60 FPS” belum dibuktikan. Perubahan ini mengurangi pekerjaan aplikasi dan ukuran input; throughput keluaran model tetap dipengaruhi provider, model, jaringan, dan reasoning.

## Perubahan yang diterapkan

### Stream dan persistensi

- `TranscriptWriter` mengumpulkan JSONL selama 50 ms atau sampai 64 Ki karakter, lalu melakukan append asinkron berurutan per file. Event mentah tetap disimpan untuk diagnostik.
- Run utama, side chat yang melalui runtime utama, dan scheduled task melakukan flush saat selesai, gagal, atau dibatalkan. Shutdown aplikasi juga menunggu flush log yang sudah dibuffer.
- Delta `token`/`thinking` yang berurutan digabung dalam jendela 16 ms. Pergantian jenis, reset, tool call/result, error, dan done menjadi batas yang mem-flush delta sebelumnya. Identitas run/conversation tidak dicampur.
- Snapshot host diperbarui sebelum IPC dikirim. Delta terakhir juga di-flush sebelum autosave membaca snapshot.
- Desktop tidak lagi menyalin seluruh daftar percakapan ke localStorage. Fallback browser tanpa host tetap berfungsi. Data legacy hanya dihapus setelah impor dan pembacaan database berhasil.
- Telemetry dari host memperbarui cache renderer tanpa mengirim seluruh transcript kembali ke SQLite. Checkpoint transcript tetap berjalan seperti sebelumnya.

Batch log bukan `fsync`: buffer yang belum tersimpan dapat hilang pada process kill/crash mendadak. Snapshot SQLite dan checkpoint chat adalah jalur persistensi terpisah.

### Skill dan plugin sesuai kebutuhan

- Plugin bawaan baru `intelligence-ui` menyediakan skill singkat dan `references/openui.md`. Katalog hanya memasukkan nama, deskripsi, dan lokasi skill. Referensi lengkap dibaca saat respons interaktif dibutuhkan.
- Generator OpenUI menulis referensi skill dari sumber library yang sama dengan fixture kontrak renderer, sehingga kedua format tidak perlu dipelihara manual secara terpisah.
- Plugin dipasang melalui mekanisme default plugin yang sudah ada pada startup berikutnya; pengaturan nonaktif dan penghapusan eksplisit tetap mengikuti mekanisme registry.
- Main chat dan scheduled task mengaktifkan `deferNativeTools`. Skema browser/computer baru muncul setelah `load_plugin_tools` atau pembacaan skill plugin tersebut. Membaca skill yang sama menghindari satu roundtrip loader tambahan.
- Menonaktifkan plugin menghapus skemanya pada request berikutnya. Pemeriksaan runtime sebelum eksekusi tetap berlaku bila pengaturan berubah ketika model masih menjawab.
- Child agent mewarisi opsi deferred, batas tool per role, dan pemeriksaan enablement dari parent. Learn dan pemakai runtime lain mempertahankan default kompatibilitasnya.
- MCP desktop mengiklankan dua gateway discovery/call tanpa menunggu discovery server. Koneksi dan skema lengkap dicari ketika model menggunakan pencarian tool. Trust, approval, autentikasi, dan pemeriksaan koneksi nonaktif tetap berlaku.
- Skema hasil discovery MCP diurutkan agar urutannya tidak bergantung pada urutan selesainya koneksi paralel.

### Prefix request dan context

- Recovery, pemilihan plugin eksplisit, dan peringatan budget menjadi reminder system di akhir request. Reminder tidak disimpan sebagai pesan pengguna atau transcript permanen.
- Prefix stabil selama konteks workspace, konfigurasi skill/plugin, dan tool yang tersedia tidak berubah. Pemuatan tool plugin memang mengubah tool set; ini tradeoff yang disengaja untuk mengurangi biaya request biasa.
- Output tool dari batch paling baru tidak dipangkas sebelum model melihatnya, termasuk batch dengan lebih dari empat hasil. Output `read`/shell besar yang sudah diamati dibatasi di recent window menjadi head/tail sekitar 16 ribu karakter dengan petunjuk membaca ulang bagian yang hilang. Riwayat tersimpan tidak dimutasi.
- Tidak ada klaim bahwa perubahan ini mengaktifkan seluruh jenis prompt cache. Dukungan, batas minimum, TTL, dan penagihan tetap bergantung provider/gateway.

Dokumentasi primer: [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) menjelaskan penggunaan ulang prefix yang sama; [Claude prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) menjelaskan urutan tools/system/messages dan invalidasi cache. Memindahkan suffix dinamis membantu mempertahankan prefix; tidak menjamin cache hit untuk semua request.

### Renderer

- Handler pesan memakai callback stabil dengan dependency yang relevan. Handler edit mengambil snapshot pesan terbaru melalui ref agar identitas handler tidak berubah setiap delta.
- Timer hanya diberikan ke pesan aktif. Status copy/expand hanya diberikan ke baris terkait, dan approval hanya ke baris terakhir.
- Mermaid diimpor dinamis saat blok diagram dirender. Fallback menampilkan sumber diagram selama modul dimuat.
- Teks inline tanpa sintaks Markdown, HTML, entity, atau autolink langsung menggunakan escaping React. Jalur teks kaya tetap memakai parser dan DOMPurify, termasuk selama streaming.

## Pengukuran lokal yang dapat diulang

Jalankan dari root repository:

```powershell
pnpm --filter @const/harness-desktop exec tsx scripts/measure-chat-context.ts
```

| Komponen | Sebelum | Sesudah / pengurangan |
| --- | ---: | ---: |
| Referensi OpenUI dalam prompt default | 38.059 karakter | Dikeluarkan; sekitar 9.515 token menurut karakter/4 |
| Jumlah skema native awal, kedua plugin aktif | 64 | 38 (37 tool inti + 1 loader) |
| Skema browser/computer yang ditunda | 0 | 27 |
| Estimasi ukuran skema native | 13.094 token | 7.166 token; berkurang 5.928 |

Angka skema mengecualikan metadata approval lokal, tool MCP, personalization, konteks project, history, dan deskripsi skill baru. Angka ini tidak boleh dijumlahkan lalu dipresentasikan sebagai persentase tagihan akhir.

Replay sintetis 1.000 delta pada interval 1 ms menghasilkan 63 pengiriman batch dengan teks akhir identik. Ini pengujian pengurangan jumlah event, bukan benchmark FPS atau latency provider.

## Verifikasi

Pengujian mencakup ordering flush yang overlap, isolasi conversation/run, token reset, error/done, migrasi legacy gagal, persistensi transcript besar tanpa mirror Web Storage, pemuatan plugin melalui skill, disable ketika request masih berjalan, recovery tanpa mengubah permintaan pengguna, dan budget output setelah model melihat hasilnya.

Suite MCP juga menguji discovery sesuai kebutuhan melalui SDK sungguhan, eksekusi tool setelah discovery, penolakan setelah koneksi dinonaktifkan, autentikasi, approval, MCP Apps, serta isolasi dokumen. Suite Markdown memeriksa bahwa HTML, entity, link, dan formatting tetap masuk jalur sanitasi. Tes lama output shell diperbarui mengikuti kontrak spooling yang sudah ada dan kini memastikan output lengkap masih dapat dibaca dari artifact.

Hasil verifikasi:

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm --filter @const/harness-desktop check-types` | Lulus, exit 0 |
| `pnpm --filter @const/harness-desktop build` | Lulus, exit 0; renderer, main, dan preload terbangun |
| Runtime agent: system prompt, compaction, telemetry, native tool, registry, browser/computer, dan subagent | Lulus |
| `test:mcp` | 58 tes lulus |
| `test:markdown` | 16 tes lulus |
| `test:telemetry` | 13 tes lulus |
| `test:remote` | 22 tes lulus |
| `test:intelligence-ui` | 27 tes lulus |
| Tes transcript writer/history, stream batcher, dan conversation store | Lulus, termasuk flush sebelum penghapusan conversation |
| Validasi skill dengan `quick_validate.py` | Lulus |
| `git diff --check` | Lulus |

Build mengeluarkan `mermaid-block` sebagai chunk terpisah sekitar 593 KB, beserta dependency diagramnya. Entry renderer masih sekitar 5 MB; ini menunjukkan masih ada pekerjaan bundle lain, bukan bukti startup sudah optimal. Build juga memberi peringatan annotation dependency, ukuran chunk, dan opsi plugin Vite. Tidak ada perubahan dependency atau konfigurasi bundler dalam perbaikan ini.

## Audit ulang sebelum commit

Review kedua menemukan dan memperbaiki celah berikut:

1. **Penghapusan conversation bertabrakan dengan penulisan asinkron.** Event baru atau checkpoint lama dapat datang saat flush menunggu disk. Database sekarang menandai ID yang dihapus sebelum `await`, menolak event dan autosave terlambat selama proses tersebut hidup, lalu menghapus record dan log setelah penulisan yang sudah diterima selesai. Tes mencakup event/checkpoint selama dan setelah penghapusan.
2. **Migrasi belum memeriksa penolakan host.** Promise impor yang selesai dengan nilai `false` kini tetap mempertahankan salinan legacy. Salinan baru dibuang setelah host mengonfirmasi `true` dan daftar database berhasil dibaca. Kegagalan akses Web Storage juga tidak lagi menghalangi pembacaan host.
3. **Shutdown dapat meninggalkan event yang muncul selama disconnect.** Integrasi MCP kini diselesaikan lebih dahulu, kemudian logger ditutup terhadap append baru dan seluruh batch yang sudah diterima ditunggu. Permintaan quit berulang ditahan sampai drain selesai. Tes writer mencakup batch yang sedang ditulis, batch yang masih pending, dan append setelah penutupan.
4. **Satu jalur callback masih membatalkan memo pesan.** Submit OpenUI sebelumnya bergantung pada `handleSendMessage` yang dibuat ulang tiap render. Callback sekarang memanggil handler terbaru melalui ref dengan identitas tetap. Callback pembuka subagent juga mengambil inventory terbaru lewat ref, sehingga pembentukan ulang inventory dari history tidak mengubah prop setiap delta.

Pengujian ulang runtime agent mencakup 8 file / 107 tes lulus. Suite MCP kembali lulus 58 tes, dan suite writer/history/batching/store lulus 10 tes. Pemeriksaan renderer, telemetry, remote, typecheck, dan build produksi juga dijalankan ulang sebelum commit.

## Batas audit dan prioritas berikutnya

Belum ada profiler CPU/heap, benchmark cold start, pengukuran FPS, atau TTFT terhadap provider live. Tidak ada angka peningkatan kecepatan produksi yang diklaim.

Prioritas berikutnya setelah mendapatkan profil penggunaan nyata:

1. Virtualisasi preview file dengan pengukuran tinggi baris, folding, pencarian, dan perilaku seleksi/copy yang tetap benar.
2. Memindahkan state streaming keluar dari orchestrator `App.tsx` bila profiler masih menunjukkan biaya root render besar; lalu stabilkan props dan memo panel yang terbukti mahal.
3. Evaluasi checkpoint SQLite/transcript snapshot pada history sangat panjang dan biaya scan registry filesystem per request.
4. Evaluasi pruning adaptif terhadap context window kecil. Batch tool terbaru tetap harus dibaca utuh atau dibatasi pada sumbernya secara eksplisit; pemangkasan diam-diam sebelum observasi bukan solusi aman.
5. Ukur cache-read tokens, input tokens, TTFT, dan waktu render dengan model/provider yang benar-benar dipakai pengguna. Tool activation dan pemangkasan history dapat mengubah kecocokan cache meskipun ukuran input lebih kecil.
