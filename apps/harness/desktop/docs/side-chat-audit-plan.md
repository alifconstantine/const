# Audit dan rencana perbaikan side chat

Tanggal: 27 Oktober 2026, Asia/Jakarta.

Ruang lingkup: `apps/harness/desktop`, beserta runtime `ConstAgent` di
`packages/agent/src/const` yang dipakai melalui Electron. Temuan di bawah
menjelaskan kondisi saat audit, sebelum implementasi lanjutan.

Pembaruan implementasi: render loop diputus; companion menggunakan profil tanpa
tool coding dengan batas retry/deadline; snapshot parent dan jalur steering dengan
receipt `queued/consumed/plan_updated/expired` tersedia; side chat menyimpan checkpoint dan
memulihkan jawaban setelah tab dipasang ulang. Fixture browser mencakup alur ini.
`consumed` berarti arahan masuk ke konteks agent. `plan_updated` berarti agent
kemudian memancarkan pembaruan todo, bukan bukti bahwa seluruh arahan telah diadopsi.
Pengukuran performa production, tampilan isi revisi plan, virtualisasi,
dan migrasi penuh side history dari localStorage masih belum dikerjakan. Receipt
disimpan terpisah, tetapi status `applied` belum tersedia.

Audit dilakukan dengan membaca alur renderer, IPC, sesi agent, prompt, tool,
steering, dan penyimpanan. Belum ada reproduksi UI, flamegraph, pengukuran FPS,
atau percobaan provider/model live. Temuan alur kode dibedakan dari dugaan
kontribusi terhadap waktu respons. Nomor baris merujuk source saat audit.

## Hasil utama

1. Ada siklus pembaruan React saat side chat terpasang yang bisa terus
   memperbarui seluruh workbench meskipun pengguna belum mengirim pesan.
2. Side chat menggunakan coding agent lengkap. Instruksi companion hanya
   ditambahkan ke history, tanpa profil eksekusi khusus atau pembatasan tool.
3. Sebagian kondisi yang terlihat seperti looping sebenarnya dapat berupa
   menunggu approval/pertanyaan yang kontrol jawabannya tidak tersedia di side chat.
4. Main chat dan side chat dapat berjalan bersamaan karena sesi dipisahkan per
   conversation ID. Namun konteks status main chat belum memadai dan side chat
   belum tersambung ke steering.
5. Steering sudah tersedia tetapi masih berupa antrean dalam memori. Status
   diterima belum berarti arahan sudah dibaca atau rencana sudah diperbarui.

## Temuan dan bukti

### F1 — P1: siklus render dari sinkronisasi model

Rantai dependensi yang ditemukan:

```text
ChatCard effect melaporkan currentModelItem
  → SideChatTab.handleModelSelect
  → onUpdateTab(tab.id, { model })
  → App.handleUpdateTab membuat array dan object tab baru
  → SideChatTab render ulang, membuat handleModelSelect baru
  → dependency onModelChange pada effect ChatCard berubah
  → effect kembali melaporkan model yang sama
```

Bukti:

- `src/components/workbench/chat-card.tsx:904`: effect bergantung pada
  `currentModelItem` dan `onModelChange`.
- `src/components/right-pane/side-chat-tab.tsx:159`: callback dibuat ulang di
  setiap render, selalu memanggil `onUpdateTab`, tanpa memeriksa kesamaan model.
- `src/App.tsx:1173`: updater selalu membuat state baru walaupun nilai sama.
- `src/App.tsx:778` dan `:363`: perubahan state tab juga memicu serialisasi dan
  penulisan right pane ke localStorage secara sinkron.

Siklus ini terlihat langsung dari source dan merupakan kandidat utama untuk lag
yang muncul segera saat panel dibuka. Besar dampaknya pada CPU/input/scroll perlu
diukur dalam reproduksi UI. Memperbaiki batching token saja tidak memutus siklus ini.

### F2 — P1: companion masuk ke runtime coding dengan tool lengkap

- `side-chat-tab.tsx:443–511`: framing meminta jawaban langsung, tetapi request
  tetap masuk ke `sendMessage` tanpa jenis sesi companion atau kebijakan tool.
- `electron/main.ts:1419–1435`: semua request dibuat dengan preset `harness`,
  native/MCP tools, dan default maksimum 200 turn.
- `packages/agent/src/const/const-agent.ts:1014–1042`: tools coding dimuat dan
  setelah dua planning turn tertentu runtime menambahkan instruksi wajib memakai
  tool untuk membuat perubahan konkret.
- `const-agent.ts:570–575`: prompt coding membatasi jawaban percakapan untuk
  permintaan pembuatan/perubahan kode. Ini dapat bertabrakan dengan diskusi
  implementasi di side chat.

Tidak ditemukan `tool_choice: required` di request (`const-agent.ts:1142`).
Jadi bukan setiap pertanyaan diwajibkan secara protokol memanggil tool. Masalahnya
adalah profil agent, prompt, dan recovery yang berorientasi eksekusi, sementara
framing side chat hanya berupa instruksi tambahan. Penyebab suatu kegagalan
provider tertentu belum dapat dipastikan tanpa trace request tersebut.

Pembatasan `tools: []` saja juga belum cukup sebagai batas eksekusi:
`extractFallbackToolCalls` menerima nama dari daftar global OR declared tools
(`const-agent.ts:214–216`), lalu dipanggil pada jawaban teks (`:1559`). Contoh JSON
tool dalam diskusi berpotensi diperlakukan sebagai panggilan tool. Profil companion
harus menonaktifkan ekstraksi ini atau membatasinya secara ketat, serta memvalidasi
allowlist tepat sebelum dispatch untuk native call maupun fallback call.

### F3 — P1: menunggu input yang tidak dapat dijawab dari side chat

- Listener side chat (`side-chat-tab.tsx:168–383`) tidak menangani
  `approval_request`, `approval_resolved`, atau `ask_question`.
- `ExecutionTrace` di side chat (`:649`) tidak menerima `onAnswerQuestion`;
  panel approval juga tidak dirender di sana.
- Runtime benar-benar menunggu promise approval (`const-agent.ts:1996–2034`)
  atau jawaban pertanyaan (`electron/main.ts:1436`).
- Listener global App mencatat permintaan tersebut, tetapi UI aktif memilih
  approval/pertanyaan berdasarkan ID main conversation (`App.tsx:1661–1668`).
  Ini tidak menyediakan kontrol untuk side conversation yang berbeda ID.

Akibatnya agent dapat terlihat terus bekerja tanpa jalan melanjutkan. Mengubah
mode ke full access bukan penyelesaian yang tepat; kontrol dan kebijakan tool
harus sesuai jenis sesi.

### F4 — P1: pencegah loop belum mengakhiri run tanpa progres

`const-agent.ts:1836–1882` mendeteksi panggilan identik dan mengembalikan error,
tetapi `continue` tersebut melanjutkan loop tool; model masih dapat dipanggil lagi
pada turn berikutnya. Variasi argumen atau pola A → B → A juga tidak tertangkap
oleh pemeriksaan identik berurutan ini. Default 200 turn memperpanjang dampaknya.

Ada budget retry lain untuk koneksi, respons kosong, dan planning
(`:932–941`, `:1161`, `:1603–1659`). Jadi bukan loop tak terbatas secara umum,
tetapi batasnya terlalu longgar untuk companion dan beberapa jenis retry tidak
mengonsumsi conversational turn. Side chat tidak menampilkan sebagian besar
status retry sehingga pengguna sulit membedakan retry, blocked, dan working.

### F5 — P1: belum ada jembatan side chat ke steering main chat

- `side-chat-tab.tsx:726–731` meneruskan jawaban lewat `onInsertToMainPrompt`.
- `App.tsx:4676` hanya mengubah `editingPrompt`; tidak mengirim arahan ke run.
- IPC `agent:steer` sudah tersedia (`electron/main.ts:1581`) dan memanggil
  `ConstAgent.steer` (`const-agent.ts:865`).
- Runtime mengonsumsi antrean sebelum turn berikutnya (`:954`) atau setelah
  generasi jawaban tanpa tool selesai (`:1732`).
- App saat ini mengubah `steer_message` menjadi user bubble + assistant placeholder
  (`App.tsx:2855`), sehingga menyambungkan API saja belum memenuhi keinginan
  pengguna agar percakapan sampingan tidak memenuhi main chat.

Steering tidak membatalkan proses main chat. Namun arahan juga tidak langsung
mengubah request model atau tool yang sudah berjalan. Saat ini antrean baru dibaca
pada batas generasi/turn, bukan sebelum setiap tool dalam satu batch. Promise
approval/pertanyaan yang sedang menunggu juga tidak dibangunkan oleh steering.
Antrean dihapus saat run berakhir (`const-agent.ts:2426`), tanpa receipt per arahan.

### F6 — P1/P2: konteks progres kehilangan informasi pelaksanaan

`side-chat-tab.tsx:454–477` menyalin seluruh pesan user/assistant parent sebagai
role percakapan biasa, tetapi hanya mengambil `content`. Trace tool, hasil tool,
todo, status running/waiting, dan identitas run tidak ikut menjadi konteks.
History side chat sendiri juga dikirim ulang sebagai teks saja (`:480`).

Side chat dapat membaca teks terbaru saat submit, tetapi tidak memiliki snapshot
terstruktur untuk menjawab “sedang mengerjakan apa?” dengan andal. Tool yang sedang
berjalan bisa tidak tercermin dalam teks. Seluruh history juga memperbesar payload
seiring percakapan bertambah panjang, dan batas parent versus percakapan sampingan
tidak dinyatakan sebagai dua sumber yang terpisah.

### F7 — P2: render dan discovery memperbesar biaya setelah F1

- Setiap token/thinking memanggil `commitMessages` langsung (`side-chat-tab.tsx:241`,
  `:264`); semua pesan dirender dengan `messages.map` (`:604`).
- `MarkdownContent` melakukan lexing saat render (`markdown-content.tsx:123`);
  belum ada batas memo pada baris pesan side chat yang sudah selesai.
- Right pane tetap memasang semua tab, termasuk yang disembunyikan dengan CSS
  (`right-pane.tsx:214–235`), sehingga listener, composer, dan lifecycle tetap hidup.
- Mount composer meminta file, model, plugin, dan skill. Pemindaian file memakai
  `readdirSync` rekursif di Electron main hingga 5.000 entri/depth 10
  (`electron/main.ts:2000–2125`). Sudah ada cache 15 detik; ini bukan scan tiap token.
- Editor menserialisasi DOM dan menyalin range sampai caret saat input
  (`rich-mention-editor.tsx:336–361`); ukur pengaruhnya pada draft panjang.

Ini adalah titik biaya yang perlu diprofilkan, bukan klaim bahwa semuanya sama-sama
menjadi penyebab lag. Prioritaskan F1 sebelum refactor performa yang luas.

### F8 — P2: lifecycle, persistence, model, dan lampiran belum konsisten

- State pesan/run dimiliki komponen. Remount hanya memuat pesan tersimpan dan
  menginisialisasi `isExecuting=false`; tidak rehydrate sesi aktif
  (`side-chat-tab.tsx:100–105`). Electron melewati final autosave conversation
  untuk side chat (`electron/main.ts:1529`), sehingga stream saat tab unmount
  berisiko tidak tersimpan lengkap di side store.
- Listener hanya menyaring conversation ID, tanpa `runId`. `done` mengaktifkan
  input sebelum backend selesai melepas sesi. Respons `alreadyRunning` tidak
  memiliki `error`, sehingga cabang error side chat melewatkannya (`:513`).
  `finally` run lama juga belum dilindungi identitas run.
- Finalisasi dan penyimpanan dapat terjadi melalui beberapa completion event
  dan `finally`; side store menulis ulang seluruh kumpulan side chat parent
  secara sinkron (`conversation-store.ts:609–623`). Error hanya memunculkan toast,
  belum menyimpan status kegagalan yang jelas pada pesan.
- Composer tidak diberi `initialModel={activeModel}` (`side-chat-tab.tsx:751`),
  sementara pemilihan model composer membaca/menulis pilihan global/workspace
  (`chat-card.tsx:825`, `:2009`). Model side tab yang dipersist belum menjadi
  sumber tunggal pilihan composer. Mode tersimpan juga tidak direstore saat mount.
- Lampiran masuk UI/persistence (`side-chat-tab.tsx:406`), tetapi payload model
  (`:498`) tidak menyertakan isi dokumen/image parts atau path lampiran.
- Jika mengirim lagi saat side agent berjalan, composer dapat membersihkan draft
  sebelum menemukan bahwa callback antrean/steer tidak disediakan
  (`chat-card.tsx:1126–1151`). Perlu perilaku eksplisit agar draft tidak hilang.

## Perilaku yang dituju

Side chat menjadi tempat bertanya, mengecek progres, dan menyampaikan koreksi ke
pekerjaan parent. Defaultnya menjawab dari konteks yang diberikan tanpa tool
coding. Pertanyaan yang memang butuh sumber tambahan dapat memakai kemampuan baca
yang dibatasi atau menawarkan pemeriksaan tambahan, tanpa mengubah model pilihan
pengguna. Permintaan eksekusi workspace tidak otomatis membuka kemampuan agent
penuh di side chat; arahan yang ditujukan ke pekerjaan parent dikirim ke main run.

Contoh alur:

1. Main chat sedang mengerjakan tugas A; side chat dibuka tanpa menghentikannya.
2. Pengguna bertanya “kamu sedang mengerjakan apa?”. Backend menyediakan snapshot
   terbaru A; side chat menjelaskan langkah, tujuan, dan blocker dari bukti itu.
3. Pengguna mengatakan “ubah pendekatannya ke B”. Arahan eksplisit ini boleh
   diteruskan dari side chat. Diskusi/pertanyaan biasa tidak otomatis menjadi arahan.
4. UI menunjukkan “menunggu diterapkan” sampai runtime mengonsumsi arahan pada
   titik aman. Main chat menampilkan indikator ringkas “Arahan diperbarui”.
5. Setelah agent mengadopsi koreksi dan memperbarui rencananya, side chat menampilkan
   bukti revisinya. Penerimaan antrean saja tidak boleh dilabeli “rencana diperbarui”.

Dialog dan jawabannya tetap di side chat. Instruksi yang diterapkan tetap harus
masuk konteks internal main agent agar berpengaruh, dengan metadata asal dan jejak
audit. Tampilan main chat dapat merangkum event tersebut menjadi indikator yang
dapat dibuka, alih-alih menggandakan seluruh dialog sebagai bubble baru.

## Rencana implementasi berurutan

### Tahap 1 — putuskan render loop dan siapkan ukuran dasar

Lingkup: `App.tsx`, `side-chat-tab.tsx`, `chat-card.tsx`, fixture UI khusus.

- Reproduksi membuka side chat kosong dengan bridge model yang dimock, tanpa
  request LLM. Catat commit React, long task, dan penulisan storage saat idle.
- Stabilkan callback model/update tab, tambahkan no-op equality pada perubahan
  model dan patch tab. Jangan mengandalkan `memo` untuk menutupi update loop.
- Selaraskan initial/selected model composer dengan state side chat. Perubahan
  pilihan side chat perlu scope sesi dan tidak mengubah main chat yang berjalan.
- Buat regresi yang memasang komponen nyata, memastikan render/storage berhenti
  setelah mount settle, lalu menguji mengetik dan membuka beberapa tab.

Selesai ketika panel idle tidak menghasilkan rangkaian commit/write berulang dan
nilai model yang sama tidak menghasilkan patch baru.

### Tahap 2 — profil companion dan lifecycle yang andal

Lingkup: `electron/main.ts`, `preload.ts`, `vite-env.d.ts`, konfigurasi/prompt dan
dispatch runtime `ConstAgent`, store side chat.

- Tambahkan jenis sesi eksplisit `main | companion` terpisah dari permission mode;
  parent link juga menjadi metadata backend, bukan hanya prefix ID renderer.
- Gunakan runner/transport yang ada dengan prompt dan kebijakan companion;
  jangan menduplikasi seluruh implementasi agent. Default tanpa tool coding/MCP,
  tanpa forced-write planning recovery, tanpa fallback ekstraksi tool dari contoh.
- Tegakkan allowlist di dispatch, termasuk tool call dari provider yang tidak
  diminta. Bila tool baca diaktifkan, gunakan subset yang jelas dan berbudget.
- Awali dengan budget companion kecil yang dapat dikonfigurasi, misalnya maksimal
  4 turn dan satu recovery untuk kegagalan yang dapat dipulihkan. Gunakan budget
  total percobaan dan deadline agar retry internal tidak melewati batas tersebut.
  Ambang ini usulan awal yang harus divalidasi; bukan angka hasil pengukuran.
- Sediakan state `running/retrying/waiting/failed/cancelled/completed`, hentikan
  run tanpa progres secara deterministik, dan persist kegagalan pada pesan.
- Gunakan satu finalisasi per `conversationId + runId`; abaikan event/finally lama,
  gunakan kunci submit sinkron, dan buka input setelah sesi benar-benar dilepas.
- Pindahkan akumulasi event dan persistence ke store yang tidak bergantung pada
  mount tab. Rehydrate run aktif; simpan checkpoint terjadwal, flush saat final,
  dan migrasikan side history localStorage ke penyimpanan per thread yang ada.
- Bila sesi companion mempunyai tool interaktif, tampilkan approval/pertanyaan
  dengan identitas sesi yang tepat dan mekanisme jawab yang sama dengan main.
- Perbaiki payload lampiran dan perilaku draft/antrean saat companion sedang busy.

Selesai ketika pertanyaan biasa dapat selesai dengan nol tool, failure tidak
berputar, draft tidak hilang, dan berpindah chat tidak kehilangan hasil side run.

### Tahap 3 — snapshot progres main chat

Lingkup: registry sesi Electron, reducer event/status, IPC bertipe, context builder.

- Materialisasikan snapshot berdasarkan event yang sudah dihasilkan runtime:
  `conversationId`, `runId`, revision/sequence, waktu pembaruan, tujuan terbaru,
  ringkasan plan/todo, status, tool aktif, hasil terbaru, file berubah, dan blocker.
- Ambil snapshot yang konsisten ketika pertanyaan side chat dikirim. Beri label
  waktu/revision sehingga jawaban tidak mengklaim mengetahui perubahan setelah itu.
- Kirim ringkasan parent dan bukti relevan dalam envelope konteks terpisah;
  jangan replay seluruh dialog parent sebagai percakapan aktif side chat.
- Terapkan budget konteks dan aturan pemotongan: selalu pertahankan tujuan,
  koreksi terbaru, blocker, dan bukti langkah aktif. Gunakan teks/peristiwa yang
  tersedia; jangan mengarang pikiran internal model atau persentase progres.
- Gunakan lookup parent ID yang dipatok pada side thread, bukan main chat yang
  kebetulan sedang terlihat. Endpoint existing `getRunningSessions` baru
  mengembalikan ID, sehingga perlu diperluas/ditambah untuk snapshot ini.

Selesai ketika pertanyaan progres dapat membedakan working, waiting approval,
gagal, dan selesai; tidak memerlukan tool call model untuk memperoleh status awal.

### Tahap 4 — arahan dari side chat ke main run dengan receipt

Lingkup: IPC steering, antrean `ConstAgent`, tipe pesan/event, renderer main dan side.

- Perluas jalur `agent:steer` yang ada dengan `instructionId`, `expectedRunId`,
  `parentConversationId`, `sourceSideChatId`, serta revisi konteks asal. Target
  harus eksplisit, dan backend memvalidasi hubungan parent/side.
- Antrekan tepat sekali dengan deduplikasi ID dan receipt yang dipersist.
  Bedakan `queued`, `consumed`, `applied`, dan `rejected/expired`.
- Konsumsi sebelum request model berikutnya; tambahkan pemeriksaan antartool
  agar batch lama tidak terus melakukan pekerjaan yang sudah dikoreksi. Pertahankan
  pasangan tool-call/result yang valid saat menunda atau melewati tool tersisa.
- Tool/request yang sedang berjalan tidak bisa dibatalkan efeknya hanya karena
  ada arahan baru. Tampilkan pending sampai titik aman; untuk aksi lama yang masih
  menunggu approval, cegah eksekusinya dengan arahan basi dan minta agent menyusun
  ulang langkah tanpa menghentikan seluruh sesi.
- Tutup race antara penerimaan steering dan akhir run: setiap arahan yang sudah
  diakui harus dikonsumsi atau mendapat terminal receipt. Jika run selesai atau
  berganti, jangan diam-diam menyasar run baru atau mengulang tugas lama.
  Pertahankan instruksi sebagai arahan lanjutan pada parent untuk dikirim pengguna.
- Teruskan hanya koreksi yang relevan, bukan seluruh dialog side chat.
  Tambahkan metadata asal pada internal message; main UI merender control event
  ringkas dan side UI menampilkan receipt/revisi plan yang terkait.
- Abort companion hanya menyasar companion. Test main run tetap hidup selama
  pertanyaan, jawaban, dan pengiriman koreksi.

Selesai ketika arahan pengguna diterapkan pada parent yang benar tanpa stop/resend,
tanpa duplikasi dialog, dan tanpa mengklaim diterapkan sebelum ada bukti runtime.

### Tahap 5 — optimasi berdasarkan profil dan hardening

- Batch token/thinking per frame atau jendela sekitar 30–50 ms; flush sinkron
  sebelum event final, error, reset, dan pergantian run agar urutan tidak hilang.
- Gunakan selector/store per conversation dan pisahkan composer, feed, dan status
  parent. Memo baris pesan selesai dengan props stabil; virtualisasi transcript
  panjang bila profil membuktikan DOM/parse menjadi bottleneck.
- Tab tersembunyi tetap menerima data lewat store, tetapi render dan pekerjaan
  discovery ditangguhkan. Jangan sekadar unmount listener sebelum store tersedia.
- Bagikan cache model/plugin/skill; jadikan penelusuran file asynchronous atau
  worker-based dan lazy saat dibutuhkan. Pertahankan cache/invalidation yang tepat.
- Hindari serialisasi seluruh parent group untuk tiap update side thread.
- Pertahankan Radix ScrollArea dan posisi scroll; auto-follow hanya ketika pengguna
  berada di bawah. Semua label/state baru masuk schema dan lima locale.

Target awal untuk diukur pada mesin dan fixture yang sama: p95 input-to-paint
di bawah 100 ms, p95 interval frame scroll di bawah 33 ms pada display 60 Hz,
serta tidak ada commit loop saat idle. Uji dengan main+side streaming bersamaan,
1/3/5 tab side, history pendek/panjang, dan workspace kecil/besar, dalam build
production. Target ini bukan hasil pengukuran audit dan harus dikalibrasi setelah
baseline tersedia. Pisahkan metrik waktu respons provider dari waktu render UI.

## Verifikasi yang dibutuhkan

| Area | Skenario wajib |
| --- | --- |
| Render | Buka side kosong; model sama berulang; typing/IME; scroll; tab tersembunyi; tidak ada update-depth warning |
| Companion | Tanya biasa nol tool; JSON contoh tool tidak dieksekusi; tool di luar allowlist ditolak; batas retry/deadline dipatuhi |
| Input interaktif | Approval/ask-question masuk side yang benar; jawab/deny/cancel tidak menggantung |
| Lifecycle | Done ganda, late token, abort lalu kirim, alreadyRunning, tutup panel/pindah chat lalu kembali |
| Konteks | Main menjalankan tool tanpa teks; menunggu approval; parent berbeda; history dipangkas; snapshot memiliki revision |
| Steering | Saat streaming, dalam batch tool, saat tool lama berjalan, saat approval, tepat menjelang done, duplikasi/retry IPC |
| Routing | Dua main run aktif; run ID berganti; side lama; parent sudah selesai; tidak ada arahan hilang/salah sasaran |
| Tampilan | Dialog tetap di side; main menerima indikator ringkas; receipt queued berbeda dari applied |
| Persistence | Remount/reload; quota/migrasi; model/mode/lampiran; hasil akhir tetap tersimpan |
| Regresi | Mode main chat, provider/model lain, Markdown/OpenUI, lima bahasa, Radix scroll, tool trace |

Gunakan stream LLM dan bridge IPC yang dimock untuk pengujian deterministik;
tambahkan smoke test provider yang biasa dipakai setelah alur lokal lulus. Test
runtime harus menyasar `src/const/const-agent.ts` yang benar-benar dipakai desktop;
test agent API/lane lain di paket yang sama tidak otomatis mencakup jalur ini.

Baseline yang telah dijalankan pada audit ini:

- `pnpm --filter @const/harness-desktop check-types` — lulus, exit 0.
- `pnpm --filter @const/harness-desktop exec tsx --test src/lib/approval-state.test.ts src/lib/conversation-routing.test.ts src/lib/models.test.ts`
  — 14 test lulus, 0 gagal.
- Belum ditemukan suite khusus perilaku side chat/bridge steering desktop pada
  area test yang ditelusuri. Test baseline di atas memvalidasi fondasi terkait,
  bukan membuktikan ketiga keluhan pengguna sudah terselesaikan.

Urutan pengerjaan: tahap 1 → 2 → 3 → 4 → 5. Ambil profil setelah tahap 1 agar
prioritas optimasi tahap 5 mengikuti bottleneck yang masih tersisa. Setiap tahap
harus mempertahankan typecheck desktop; perubahan runtime juga memerlukan test
runtime terkait dan perubahan build/dependency memerlukan build desktop.
