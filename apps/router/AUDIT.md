# Audit Const Router — 24 Oktober 2026

> Baseline sebelum implementasi. Kode dan nomor baris di bawah merekam kondisi saat audit. Perubahan 25 Oktober dan langkah rilis dicatat di [ROLLOUT.md](ROLLOUT.md).

## Kesimpulan dan cakupan

Router sudah dapat dibangun, memiliki halaman utama dan operasi CRUD, tetapi belum siap dipakai sebagai gateway publik berbayar. Penghambat utamanya adalah autentikasi/otorisasi, kebenaran pengukuran penggunaan, konsistensi kontrak API, dan penyimpanan chat. Menambah payment gateway saja belum menyelesaikan masalah tersebut.

Audit mencakup semua route halaman di `apps/router/src/app`, endpoint API, library gateway, serta schema dan fungsi Router di `packages/backend/convex`. Database yang diperiksa adalah **definisi schema dan kode akses data**, bukan isi deployment Convex. Tidak ada perubahan data atau panggilan ke engine/MCP produksi. Tampilan browser, login SSO lintas aplikasi, konfigurasi reverse proxy produksi, backup, dan kredensial deployment belum diverifikasi langsung.

Kategori: **P0** = penghambat pembukaan akses publik; **P1** = masalah utama kebenaran fungsi/data; **P2** = kelengkapan produk dan operasional. Temuan berdasarkan kode kecuali diberi catatan reproduksi lokal. Prioritas bukan skor CVSS.

## Verifikasi

- `pnpm --filter @const/router check-types`: lolos.
- `pnpm --filter @const/backend check-types`: lolos.
- `pnpm --filter @const/router build`: lolos; daftar route hasil build mengonfirmasi endpoint yang benar-benar tersedia.
- 13 probe lokal pada handler sumber, dengan registrasi framework, DB dan upstream tiruan: seluruhnya mereproduksi perilaku yang dicatat di bawah. Ini bukan tes terhadap deployment, dan kelolosan probe berarti bug berhasil direproduksi.
- Belum ditemukan suite unit/integration/E2E atau script test untuk Router/backend di package masing-masing. `testing.ts` adalah utilitas penghapusan data, bukan suite pengujian.

## Temuan prioritas

### F01 — P0: managed gateway dapat dipanggil tanpa autentikasi

Di [chat route](src/app/v1/chat/completions/route.ts#L157), token hanya diekstrak. Cabang managed model melakukan cek kuota hanya jika ada token/key, kemudian menolak hanya alasan `weekly_quota_exceeded`. Hasil `unauthorized` dan kegagalan query justru melanjutkan request dengan key engine server. Pola serupa ada di [Playground API](src/app/api/generation/chat/route.ts#L436) dan [transkripsi](src/app/v1/audio/transcriptions/route.ts#L113).

Reproduksi lokal: chat tanpa Authorization menghasilkan 200 dari upstream tiruan; key salah yang menghasilkan `{allowed:false, reason:"unauthorized"}` juga tetap menghasilkan 200. [Test model](src/app/api/models/test/route.ts#L10) cukup memeriksa keberadaan string token: header token sembarang juga diterima pada probe managed model.

Perbaikan: satu guard server untuk session terverifikasi/API key aktif, berlaku sebelum dispatch, cek limit, atau pengeluaran biaya. Tolak kredensial invalid/revoked, dan hentikan akses managed engine ketika validasi identitas/kuota gagal. Tambahkan pembatasan request dan concurrency per identitas.

### F02 — P0: identitas dapat dipalsukan lewat payload JWT

[Credits](../../packages/backend/convex/router/credits.ts#L18), [quotas](../../packages/backend/convex/router/quotas.ts#L117), dan [logs](../../packages/backend/convex/router/logs.ts#L59) menerima `ssoToken` sebagai argumen publik lalu membaca `sub` dari Base64/JSON. Tidak ada pemeriksaan signature, issuer, audience, atau expiry pada jalur fallback itu. User ID yang ada di database dianggap cukup.

Reproduksi lokal: payload dengan `sub` milik user tiruan dan signature invalid tetap membaca saldo user tersebut. Jalur ini juga digunakan transaksi, quota, dan analytics. Gunakan identitas dari auth context yang sudah diverifikasi; jangan menjadikan payload JWT mentah sebagai bukti identitas.

### F03 — P0: mutation administratif/akuntansi tersedia tanpa pemeriksaan pemanggil

Fungsi publik berikut menerima target dari client tanpa auth/ownership guard:

- [deductCredits](../../packages/backend/convex/router/credits.ts#L240): mengurangi saldo user berdasarkan `userId` yang diberikan.
- [deductConstQuota](../../packages/backend/convex/router/quotas.ts#L188): menghabiskan kuota user berdasarkan ID.
- [resetUserQuota](../../packages/backend/convex/router/quotas.ts#L298): tanpa `userId`, mereset seluruh kuota. Jika ID diberikan tetapi record tidak ada, eksekusi juga jatuh ke reset global.
- [recordKeyUsage](../../packages/backend/convex/router/keys.ts#L205): menambah penggunaan key berdasarkan `keyId`.
- [resolveComboForExecution](../../packages/backend/convex/router/combos.ts#L311): query publik mempercayai target `userId` untuk membaca konfigurasi combo.

Reproduksi lokal mengonfirmasi pengurangan saldo dan reset global tanpa session. Jadikan operasi internal melalui jalur server tepercaya, atau gunakan verifikasi identitas/otorisasi server yang sesuai; admin harus diperiksa eksplisit. Next.js server yang memanggil Convex dengan public client tidak otomatis membuat fungsi tersebut privat.

### F04 — P0: endpoint MCP tidak mengikat akun ke identitas terverifikasi

[Execute](src/app/v1/mcp/execute/route.ts#L37), [auth-link](src/app/v1/mcp/auth-link/route.ts#L37), [connected-accounts](src/app/v1/mcp/connected-accounts/route.ts#L32), dan [usage](src/app/v1/mcp/usage/route.ts#L32) menerima user dari body/query/header/device ID, potongan token, atau `learn_default_user`. [Disconnect](src/app/v1/mcp/disconnect/route.ts#L30) hanya membutuhkan `accountId` dan tidak memeriksa ownership. Endpoint usage global juga tidak memeriksa role.

Akibatnya pemanggil dapat memilih namespace akun/kuota; ada risiko akses tool atau pemutusan koneksi akun lain jika ID diketahui. Kemampuan aktual pada akun Composio produksi belum diuji. Turunkan identitas dari session/key tervalidasi, cek ownership connected account di server, batasi tool yang diizinkan dan proteksi statistik global.

### F05 — P0: HTML dalam jawaban chat dirender tanpa sanitasi

[MarkdownContent](src/components/generation/markdown-content.tsx#L157) memasukkan HTML hasil lexer langsung ke `dangerouslySetInnerHTML`. Konten user/model dapat mengandung elemen dengan event handler berbahaya. Riwayat menyimpan konten tersebut sehingga risikonya bertahan saat chat dibuka lagi.

Dampaknya diperbesar karena [SSO provider](src/components/providers/convex-client-provider.tsx#L118) menyimpan access/refresh token di localStorage dan cookie yang dapat dibaca JavaScript. API key juga tersedia ke frontend. Render HTML sebagai teks atau sanitasi dengan allowlist yang ketat; validasi protokol URL. Tinjau perpindahan session ke cookie HttpOnly dan pertukaran login dengan kode sekali pakai.

### F06 — P1: billing model paid belum terhubung ke eksekusi

[Katalog model](src/lib/model-specs.ts#L119) sudah mempunyai tier paid dan harga, serta [deductCredits](../../packages/backend/convex/router/credits.ts#L240) sudah ada. Namun penelusuran pemanggil Router tidak menemukan pemakaian fungsi debit tersebut dalam dispatch chat/combo/transkripsi. Managed model memakai cek kuota yang sama; saldo dan tier tidak menjadi keputusan eksekusi.

Ini kebutuhan **mesin pemakaian kredit**, terpisah dari integrasi payment gateway: tetapkan aturan free/paid, biaya input/output/cache, pembulatan, reservasi biaya sebelum request, settlement berdasarkan usage, dan pembatalan/refund. Saldo nol harus mempunyai perilaku yang jelas.

Selain itu [createDeposit](../../packages/backend/convex/router/credits.ts#L164) adalah mutation client yang langsung menambah saldo dan membuat transaksi completed. Walaupun payment gateway di luar scope, jalur simulasi ini harus dibatasi development agar tidak menjadi jalur penambahan uang langsung pada wallet nyata.

### F07 — P1: limit harian API key belum berfungsi sesuai label

[verifyApiKey](../../packages/backend/convex/router/keys.ts#L159) memeriksa status dan limit, tetapi route eksekusi Router tidak memanggilnya. Resolver lain memeriksa status aktif tanpa batas harian. Counter `usedTodayTokens` hanya bertambah dan schema tidak menyimpan tanggal periode/reset harian. Setelah enforcement ditambahkan, key akan tetap capped lintas hari tanpa mekanisme reset.

Tambahkan satu verifikasi key terpusat, periode harian yang eksplisit, reset atomik, dan reservasi penggunaan untuk request bersamaan. Lengkapi pengelolaan key dengan expiry, rotasi, scope/model allowlist dan batas biaya bila produk memerlukannya.

### F08 — P1: penggunaan managed model lewat combo tidak mengurangi kuota mingguan

[Chat API](src/app/v1/chat/completions/route.ts#L220) dan [Playground](src/app/api/generation/chat/route.ts#L405) memberi telemetry provider `Virtual Combo`. [recordLog](../../packages/backend/convex/router/logs.ts#L163) hanya mendebit quota ketika provider `const`, `Google AI`, atau mengandung kata `const`. Provider/model target terpilih ada di response header executor, tetapi tidak dijadikan metadata debit.

Simpan identitas combo dan target eksekusi sebagai field terpisah. Metering/billing mengikuti model target, sementara analytics tetap dapat dikelompokkan berdasarkan combo.

### F09 — P1: telemetry publik bisa memalsukan dan mengulang debit

[recordLog](../../packages/backend/convex/router/logs.ts#L16) menerima metrik penggunaan dari client dan sekaligus mengubah counter key serta quota. Tidak ada idempotency check `requestId`; index `by_request_id` belum dipakai untuk menolak replay. Nilai token tidak dibatasi nonnegative/integer.

Reproduksi lokal: `promptTokens` negatif menurunkan counter harian dari 100 menjadi 50. Caller dengan kredensial valid juga dapat membuat usage palsu atau mengirim event sama berulang kali. Pisahkan ingest telemetry dari settlement tepercaya, validasi nilai dan sumber event, serta lakukan deduplikasi atomik.

### F10 — P1: kontrak eksekusi combo belum konsisten

[Executor](src/lib/combo-executor.ts#L90) memakai `getCombo`, yang tidak menolak combo disabled. Resolver lain memang punya pengecekan status, tetapi tidak dipakai executor. Strategi `round-robin` jatuh ke pengurutan priority dan `weight` tidak dipakai. [Payload managed](src/lib/combo-executor.ts#L287) selalu `stream:true`; API publik tidak meneruskan `stream`/batas output ke executor. [Reformat pesan](src/lib/combo-executor.ts#L168) membuang `tool_calls`, `tool_call_id`, dan `name`.

Probe lokal mengonfirmasi combo disabled tetap dieksekusi, `stream:false` tetap mengirim stream, dan metadata tool hilang. Gunakan resolver aktif yang sama, implementasikan strategi yang ditawarkan atau hapus pilihan yang belum didukung, pertahankan kontrak pesan dan parameter. Tambahkan deadline per percobaan dan kebijakan failover untuk timeout serta kegagalan sebelum token pertama.

Tambahan: backend mengizinkan slug `auto`, `fast`, `coding`, tetapi list backend/UI menyembunyikannya sebagai warisan preset. Combo baru dengan slug tersebut dapat dibuat lalu hilang dari daftar. Hapus filter lama atau reservasi slug secara konsisten.

### F11 — P1: token streaming dapat tercatat keliru

[createTelemetryStream](src/lib/telemetry.ts#L190) mem-parsing masing-masing chunk jaringan sebagai baris SSE utuh tanpa buffer event yang melintasi chunk. Estimator output memakai teks SSE mentah, termasuk JSON dan metadata. Nilai cache dibuang menjadi nol. Waktu pengukuran stream dimulai setelah fetch upstream selesai menunggu header, sehingga TTFT/durasi tidak mencakup seluruh request.

Probe lokal memotong satu usage event menjadi dua chunk: 1.234 prompt token aktual tercatat sebagai estimasi 1 token. Gunakan parser SSE dengan buffer, akumulasi content/reasoning secara terpisah, pertahankan usage aktual/cache, dan ukur waktu dari awal request. Status sukses/debit harus mengikuti hasil request yang benar; cancellation atau kegagalan pencatatan perlu rekonsiliasi.

### F12 — P1: Endpoints dan Docs menawarkan route yang belum ada

[Endpoints](<src/app/(dashboard)/endpoints/page.tsx#L63>) mencantumkan `/v1/responses`, `/v1/messages`, `/v1/embeddings`, `/v1/audio/speech`, `/v1/music/generations`, `/v1/videos/generations`. Tidak ada handler/rewrite untuk route ini pada app dan hasil build. [Docs](src/app/docs/page.tsx#L456) juga menjelaskan `/v1/audio/music`, `/v1/rerank`, `/v1/videos`, dan polling `/v1/videos/{id}`, yang tidak tersedia. Path musik/video antara kedua halaman juga berbeda.

Tampilkan hanya capability tersedia atau beri status planned yang jelas. Jika ada reverse proxy di deployment yang menambahkan route, kontraknya perlu diverifikasi; konfigurasi tersebut tidak ditemukan pada `next.config.ts`. Buat satu registry endpoint/capability untuk UI, docs dan tes kontrak.

### F13 — P1: Settings tidak mengubah gateway dan kebijakan privasi

[Settings](<src/app/(dashboard)/settings/page.tsx#L105>) menyimpan `const_router_settings` di localStorage. Pencarian seluruh source menunjukkan key dan opsi privacy/quota notification hanya digunakan di halaman itu. Default model/temperature/streaming, log payload, anonymize telemetry, dan notifikasi belum diterapkan gateway. API tetap menolak request tanpa model, bertentangan dengan deskripsi default fallback.

Simpan pengaturan per user di backend dan terapkan saat menyelesaikan request defaults serta penulisan telemetry. Jangan menyatakan anonymization aktif sebelum IP/user-agent/payload benar-benar mengikuti kebijakan tersebut. Tambahkan kontrol export/delete data dan retention sesuai lingkup produk; tombol lonceng header saat ini juga belum mempunyai aksi.

### F14 — P1: riwayat dan analytics hanya menghitung sebagian data

[listLogs](../../packages/backend/convex/router/logs.ts#L235) mengambil 100 row terlebih dahulu, baru menyaring waktu/status/search. Data cocok di luar batch tersebut tidak bisa ditemukan dan tidak ada cursor pagination. Metrics mengambil 500 row, dashboard 1.500 row, dan agregasi tambahan 5.000 row; UI tidak menyatakan hasil parsial.

[Dashboard](<src/app/(dashboard)/dashboard/page.tsx#L110>) menghitung spend dari tarif tetap $1,25/1 juta token dan savings $0,65/1 juta token. Itu bukan ledger atau harga model aktual. Tombol Refresh hanya menampilkan timer/toast; data Convex sendiri memang reaktif, tetapi tombol tidak melakukan refresh.

Gunakan filter/index sebelum pagination, agregasi per periode yang di-update saat settlement, biaya aktual, dan indikator batas data bila memakai sampling. KPI harus menjelaskan apakah mengikuti semua filter tabel.

### F15 — P1: attachment/chat tidak cocok dengan bentuk penyimpanan database

[Playground](<src/app/(dashboard)/generation/page.tsx#L184>) menerima file sampai 25 MB lalu mengubahnya menjadi Base64. [Schema](../../packages/backend/convex/schema/router.ts#L64) menyimpan attachment dan seluruh messages di satu dokumen chat; update mengganti array penuh. Attachment sebesar itu jauh melampaui anggaran dokumen yang masuk akal dan berisiko gagal disimpan; batas aktual deployment belum diuji di audit ini.

[Sinkronisasi](<src/app/(dashboard)/generation/page.tsx#L611>) menyembunyikan kegagalan simpan sebagai console warning. Persist dilakukan setelah generasi sukses; abort kembali sebelum proses simpan sehingga percakapan/hasil parsial bisa hilang ketika reload. [listChats](../../packages/backend/convex/router/chats.ts#L44) membaca seluruh dokumen history termasuk array messages sebelum membuat metadata list.

Pisahkan `routerChats`, `routerMessages` dan attachment storage dengan storage ID; batasi ukuran/count/MIME di server, gunakan pagination dan indikator saving/saved/failed dengan retry. Simpan user message sebelum generasi dan persist hasil parsial dengan revision guard untuk menghindari overwrite antar tab.

### F16 — P1: /v1/fetch memiliki jalur SSRF

[fetchCleanMarkdown](src/app/v1/fetch/route.ts#L68) jatuh ke `fetch(targetUrl)` langsung setelah kegagalan Jina. Validasi hanya menambahkan prefix HTTP; tidak menolak localhost/private IP, metadata endpoint, DNS resolution ke jaringan privat, atau redirect ke target internal. Endpoint juga tidak memerlukan auth. Dampak jaringan internal bergantung lingkungan deployment.

Validasi URL/protokol dan alamat tujuan hasil DNS, periksa tiap redirect, batasi response size/deadline/concurrency dan gunakan egress policy. Audit juga base URL provider/test model untuk aturan yang sama.

### F17 — P1: pengelolaan secret masih membuka akses berlebih

[apiKeys.rawKey](../../packages/backend/convex/schema/router.ts#L10) disimpan plaintext dan [listKeys](../../packages/backend/convex/router/keys.ts#L45) mengembalikannya berulang kali ke frontend. Ini bukan reveal sekali pakai. [getProviderCredentials](../../packages/backend/convex/router/providers.ts#L248) adalah query publik yang mengembalikan key provider terdekripsi ke session/key gateway aktif. Sifat public query tidak membatasinya ke server proxy.

[Enkripsi provider](../../packages/backend/convex/router/crypto.ts#L3) mempunyai fallback secret development tetap bila konfigurasi secret/JWT tidak tersedia. Konfigurasi aktual deployment belum diperiksa. Simpan key gateway sebagai hash dan prefix, reveal hanya saat create/rotate, batasi pengambilan kredensial provider ke server tepercaya, wajibkan secret enkripsi eksplisit serta rencanakan rotasinya. Jika BYOK memang tidak ditawarkan lagi, kurangi surface backend yang tersisa.

### F18 — P2: discovery model dan connection tester memberi hasil menyesatkan

[GET /v1/models](src/app/v1/models/route.ts#L115) hanya memasang auth untuk JWT, lalu memanggil `listCombos({})`. API key biasa tidak diteruskan ke resolver; akibatnya model combo user tidak ditemukan oleh client SDK menggunakan key. Katalog dasar tetap 200 untuk key sembarang, sementara [Integrations tester](<src/app/(dashboard)/integrations/page.tsx#L100>) menganggap 200 itu sebagai koneksi/key sukses. Pemilihan default key di halaman tersebut juga mengambil row pertama tanpa filter active.

Pertahankan katalog publik bila itu desainnya, tetapi pisahkan tes reachability dari validasi kredensial dan generasi. Tambahkan discovery combo dengan API key yang tervalidasi. Dashboard quickstart memakai `keyPrefix` tersamarkan sehingga snippet yang disalin belum bisa dijalankan; minta user mengisi key nyata dengan instruksi yang jelas.

### F19 — P1: rollover kuota image dan token tidak konsisten

[deductConstQuota](../../packages/backend/convex/router/quotas.ts#L219) dan [recordLog](../../packages/backend/convex/router/logs.ts#L195) memajukan periode saat rollover, tetapi tidak mereset `usedImages`. Bila request token adalah request pertama pada minggu baru, pemakaian image minggu sebelumnya ikut terbawa. Reset user spesifik juga hanya mereset token, berbeda dari reset global.

Satukan rollover untuk seluruh dimensi quota dan panggil dalam transaksi yang sama. Preflight query terpisah dari pemakaian setelah respons juga memungkinkan request paralel melewati sisa quota. Counter yang di-clamp ke maksimum menghilangkan bukti overage. Gunakan reserve/settle/release dan pertahankan usage aktual.

### F20 — P2: penyimpanan usage MCP belum tahan restart/multi-instance

[mcp-service](src/lib/mcp-service.ts#L19) memakai cache proses dan `.mcp-usage.json` di filesystem lokal. Pada multi-instance counter dapat berbeda; pada serverless/read-only filesystem pemakaian dapat hilang saat proses berganti. Identitas yang dapat dipilih client makin membuat limit mudah dielakkan.

Pindahkan quota, usage events, dan mapping akun ke penyimpanan bersama dengan increment/reservasi atomik. Secrets tetap pada secret manager/penyimpanan provider yang sesuai, bukan di event usage.

### F21 — P2: validasi request dan respons lintas client belum seragam

Chat API menggunakan type TypeScript untuk body tetapi tidak memvalidasi bentuk runtime sebelum `.some()`/operasi string. Probe `messages` berbentuk objek menghasilkan 500, bukan 400. Banyak dispatch memakai hanya `req.signal` tanpa timeout server per attempt. [Managed response](src/app/v1/chat/completions/route.ts#L545) juga tidak memakai CORS helper yang digunakan BYOK; probe mengonfirmasi header allow-origin hilang.

Gunakan validator runtime untuk body/model/messages/token limit/file/URL; batas request size dan output; response/error schema seragam; deadline total/per-attempt; CORS pada seluruh response dan exposure header request ID. Tambahkan request ID ke error paths dan tes browser lintas origin. Protokol BYOK native juga perlu disatukan: public chat memakai payload OpenAI untuk semua provider sedangkan Playground/combo mempunyai adapter Google/Anthropic sendiri.

## Ringkasan per halaman

| Halaman                    | Sudah tersedia                                           | Kekurangan utama                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                        | Landing dan navigasi                                     | Klaim kemampuan harus mengikuti endpoint/capability yang benar-benar aktif.                                                                                                                                    |
| `/login`, dashboard layout | Redirect SSO, refresh, sign-out                          | Token URL/localStorage dan status auth berdasarkan keberadaan token perlu ditinjau; session invalid perlu fallback jelas. User yang sudah login diarahkan ke dashboard tanpa menghormati continue.             |
| `/dashboard`               | Query analytics, ringkasan key/quota, snippet            | Biaya/savings sintetis, agregasi terpotong, refresh tanpa aksi, snippet memakai masked key.                                                                                                                    |
| `/keys`                    | Create/list/reveal/revoke/delete                         | Daily cap belum enforced/reset; plaintext secret; expiry/rotation/scopes belum tersedia.                                                                                                                       |
| `/logs`                    | Filter, tabel, detail JSON, metrik                       | Pagination/search historis, total akurat, metrik cache, biaya aktual, status data/error yang membedakan kegagalan query dari kosong.                                                                           |
| `/generation`              | Streaming, history, system prompt, upload, search, combo | Sanitasi HTML, persist yang tahan abort/gagal, attachment storage, pilihan model sesuai capability, kontrak adapter yang konsisten.                                                                            |
| `/combos`                  | Builder/reorder/create/edit/delete                       | Disabled enforcement, stream/nonstream dan tool calls; round-robin/weight belum berjalan; slug lama tersembunyi; metering target.                                                                              |
| `/models`                  | Katalog, pricing, filter, test                           | Tier/harga belum enforced; test tidak memverifikasi session sebenarnya atau melalui jalur metering utama; status/kemampuan perlu berdasar eksekusi.                                                            |
| `/endpoints`               | Daftar endpoint, search/copy                             | Beberapa route yang diiklankan tidak ada; belum menunjukkan ready/planned atau schema request/error.                                                                                                           |
| `/integrations`            | Tutorial/snippet, connection tester                      | Tes GET katalog tidak membuktikan key valid/generasi sukses; pilih key aktif; discovery combo untuk API key. Ini halaman panduan, bukan pengelola koneksi MCP user.                                            |
| `/credits`, `/deposit`     | Tampilan wallet dan riwayat                              | Mesin debit penggunaan, idempotency/reconciliation, pagination transaksi, proteksi simulasi; `/deposit` merupakan alias halaman yang sama. Integrasi gateway pembayaran tidak dibahas sebagai pekerjaan audit. |
| `/settings`                | Form, ringkasan akun/quota, switch/sign-out              | Preferences belum server-side/applied; privacy toggles dan notifikasi belum bekerja; pengaturan retention/export/delete data belum tersedia.                                                                   |
| `/docs`                    | Referensi dan contoh SDK                                 | Beberapa endpoint/contoh tidak tersedia; kontrak pricing/quota/top-up tidak sama dengan implementasi.                                                                                                          |

## Audit desain database

Ada delapan tabel Router: `apiKeys`, `userProviders`, `routerChats`, `routerLogs`, `routerCombos`, `userQuotas`, `userCredits`, `creditTransactions`. Pemisahan per user dan index user/time sudah ada. CRUD key/provider/chat/combo pada umumnya memeriksa pemilik; celah pada fungsi lain dijelaskan di atas.

Yang perlu diperbaiki/ditambahkan, di luar gateway pembayaran:

1. **Settings per user**: defaults, telemetry/privacy/retention, quota alert; jangan shared localStorage tanpa namespace akun.
2. **Request dan usage settlement**: request ID/idempotency key, user/key, requested model, resolved model/provider, combo, token aktual/cache, status lifecycle, usage source, pricing snapshot/version, biaya final, reservation dan settlement state.
3. **Ledger kredit**: integer unit kecil/fixed precision dengan aturan pembulatan, hubungan debit ke request, idempotency index, jenis adjustment/refund yang benar dan rekonsiliasi wallet terhadap ledger. Float USD saat ini dan ketiadaan request reference menyulitkan audit biaya.
4. **Quota/key period**: tanggal awal/akhir harian, satu fungsi rollover mingguan token/image, reserve/settle/release atomik dan histori usage yang tidak hanya counter terpotong.
5. **Chat/messages/files**: metadata session terpisah dari pesan dan attachment storage; pagination, batas server, version/revision dan status penyimpanan.
6. **MCP**: user-account mapping, connected account ownership, quota period dan call event persisten di database bersama.
7. **Integritas hubungan dan lifecycle**: dokumentasikan satu wallet/quota per user melalui operasi get-or-create terpusat; index Convex bukan unique constraint. Tentukan kebijakan saat key/provider/user dihapus dan referensi historis tetap dipertahankan. Banyak relasi tidak mempunyai cascade otomatis.
8. **Retensi dan penghapusan**: belum ditemukan pekerjaan terjadwal retensi logs/chat, export/delete data Router atau penghapusan file. [clearAuthData](../../packages/backend/convex/testing.ts#L22) tidak membersihkan chat/log/combos/quota/credits/transaksi, sehingga reset development dapat menyisakan referensi ke user yang telah dihapus. Jangan gunakan reset auth sebagai reset database lengkap.
9. **Agregasi dan pagination**: rollup analytics per user/periode/model dan cursor pagination; batasi limit client di server. Queries koleksi besar/array chat penuh akan membesar seiring penggunaan.
10. **Migrasi dan operasi**: siapkan backfill untuk penghapusan plaintext keys, pemisahan messages/files, pricing snapshots, period counters dan settlement; verifikasi orphan/duplicate/ledger drift pada deployment read-only sebelum migrasi. Backup/restore, konfigurasi secret dan index deployment belum diverifikasi.

## Urutan implementasi yang disarankan

1. Tutup F01–F05: auth terpusat, fungsi internal/ownership, MCP isolation, sanitasi HTML. Batasi simulator credit ke development.
2. Benarkan metering dan key/quota lifecycle: F07–F11 dan F19, termasuk trusted usage dan idempotency. Gunakan satu jalur dispatch untuk Playground/API/combo.
3. Implementasikan credit usage engine F06 dengan harga dan ledger terukur; payment gateway dapat mengikuti setelah dasar ini benar.
4. Perbaiki schema chat/MCP, pagination/rollups dan Settings yang benar-benar diterapkan.
5. Sinkronkan halaman Models/Endpoints/Integrations/Docs dari registry yang sama, kemudian uji SSO dan seluruh alur UI di browser.

Tes minimum sebelum rilis: tanpa auth/invalid/expired/revoked key; akses antar user untuk semua query/mutation; negative/replayed usage; daily/weekly rollover; concurrency quota/wallet; combo disabled/failover/nonstream/tool calls; SSE yang terpotong antar chunk; file besar dan abort/save; CORS/error responses; SDK contract serta endpoint yang diiklankan. Lulus build/type-check saja belum memverifikasi hal-hal ini.
