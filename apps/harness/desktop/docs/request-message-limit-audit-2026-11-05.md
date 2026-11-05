# Audit lanjutan batas jumlah pesan — 5 November 2026

Referensi utama tindak lanjut ini adalah checkout lokal
`/home/constantine/Code/Clone/oh-my-pi`. Referensi dibaca tanpa perubahan.

## Bukti terbaru

Setelah patch media `af664b1a` dideploy, request sesudah pembacaan gambar kembali
berhasil. Jellyfish membaca `v_tear.png` pada 14:42:24 WIB dan selesai pada
14:43:30. VHS membaca beberapa JPG pada 15:32–15:36, semuanya diikuti request
berstatus completed. Spider juga memiliki pembacaan gambar yang berhasil.

Penghentian berikutnya memiliki error berbeda:

| Chat | Waktu WIB | Bukti event | Error |
| --- | --- | --- | --- |
| Spider `session_1793862087875` | 15:33:10 | `events.jsonl:76068` | `Supply between 1 and 500 messages.` |
| VHS `session_1793862076525` | 15:37:31 | `events.jsonl:53999` | `Supply between 1 and 500 messages.` |

Event tepat sebelumnya menunjukkan estimasi konteks 103.163 dan 101.956 token
dari 1 juta, sekitar 10%. Ini batas jumlah record pesan pada validasi router,
bukan batas token, bukan penolakan capability vision, dan bukan pembatalan user.

`apps/router/src/lib/gateway.ts` membatasi messages pada 1–500 record. Satu
langkah tool menghasilkan assistant tool call, tool result, dan kadang user-role
visual observation. Compaction desktop sebelumnya hanya memendekkan content;
jumlah record tidak berkurang. Riwayat dari run sebelumnya juga tetap masuk
saat pengguna melanjutkan chat, sehingga run baru bisa mencapai batas lebih cepat.

## Prinsip dari oh-my-pi

- `packages/ai/src/providers/openai-completions.ts` mengirim media melalui
  bagian image_url/data URL native. Encoding base64 bukan teks percakapan.
- `packages/agent/src/image-tokens.ts` memisahkan estimasi token gambar dari
  panjang encoding, menggunakan metadata dimensi.
- `packages/agent/src/compaction/compaction.ts`, khususnya findValidCutPoints,
  menjaga batas pemotongan agar tool result tidak terpisah dari tool call.
- Pengelolaan sesi memisahkan transcript persisten dari konteks yang disusun
  untuk request berikutnya. Pemulihan request bukan alasan menghapus log asli.

## Perbaikan

`request-history.ts` menyusun proyeksi dengan ruang untuk system prompt dan
request-only reminders di bawah kontrak 500 pesan. Riwayat kecil memakai jalur
normal. Untuk riwayat besar, exchange lama dikemas sebagai transcript JSON
berlabel konteks historis; instruksi user awal/terbaru, system records, dan
bagian media native dipertahankan di luar arsip. Tail terbaru dipertahankan
mulai pada batas yang tidak memisahkan batch tool call/result.

Ini pengemasan konteks untuk batas jumlah pesan, bukan ringkasan semantik yang
dibuat model. Isi historis tetap tersedia setelah compaction teks yang sudah
ada. Tidak ada inference tambahan atau perubahan pada transcript tersimpan.
Boundary bergerak per blok untuk menjaga prefix request lebih stabil bagi cache.
Estimasi UI dan payload model memakai proyeksi yang sama.

Batas router tetap 500; menaikkannya hanya akan menunda kegagalan yang sama.
Jika satu batch tool terbaru saja terlalu besar, agent mengembalikan error yang
menjelaskan perlunya mengurangi batch, bukan mengirim tool result yatim.

## Validasi dan batas

39 tes agent terfokus lulus, termasuk reproduksi lebih dari 500 record melalui
request model, kelanjutan ke tool turn berikutnya, tidak ada tool result yatim,
instruksi dan gambar terbaru tetap tersedia, dan transcript input tidak berubah.
Typecheck desktop lulus. Build production dan smoke test Electron diverifikasi
sebelum commit tindak lanjut ini.

Capture browser dan pemilihan shell Fish/Bash tetap ditunda. Beberapa error
heredoc Fish masih terlihat dalam log, tetapi bukan penyebab HTTP 400 jumlah
pesan. Integrasi penuh seluruh engine compaction oh-my-pi tidak dilakukan pada
patch terfokus ini.
