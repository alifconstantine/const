# Review output AI

Desktop dan remote mobile memakai renderer yang sama; APK lama tetap memerlukan rebuild untuk mendapatkan perubahan ini.

## Preview tanpa model atau akun

Dari root repository:

```powershell
pnpm --filter @const/harness-desktop test:remote:preview
```

Buka `http://127.0.0.1:5198/tests/remote-workspace.html?output-formatting`.

Halaman tersebut adalah fixture terisolasi dengan berkas dan hasil simulasi. Tidak menjalankan model, membaca proyek pengguna, atau menulis ke berkas proyek. Tombol copy pada fixture merekam hasil secara lokal untuk pengujian dan tidak mengubah clipboard sistem; aplikasi sebenarnya memakai clipboard normal.

Yang perlu ditinjau:

1. Ringkasan hasil, tautan file, tombol berkas hasil, verifikasi, dan keterbatasan langsung terlihat.
2. Buka **Implementation details**: periksa JavaScript berwarna, kode HTML literal, inline code, mention aktif, kutipan berisi list/code, tabel, dan penomoran yang mulai dari 3.
3. Klik **Open result** dan tombol `index.html`: keduanya membuka berkas fixture di SidePanel. Tautan relatif dipasangkan ke workspace.
4. Persempit viewport menjadi 390px atau 320px. Tutup Activity jika menutupi teks. Periksa tombol Copy/feedback tanpa hover, target sentuh, dan scroll horizontal code block.
5. Gunakan Tab untuk mencapai tombol jawaban dan summary disclosure; gunakan Enter/Space untuk membuka detail. Bandingkan tema gelap dan terang lewat pengaturan.
6. Preview file memakai seluruh lebar SidePanel secara default. Pohon workspace dapat dibuka dari tombol **Toggle file tree**; pada panel sempit ia tampil sebagai lapisan agar kode tidak terjepit. Kode panjang memakai scroll horizontal; periksa juga ukuran layar 320px dan 390px.

## Prompt untuk mencoba di Harness sebenarnya

```text
Buat satu demo HTML kecil di outputs/review-output/index.html tanpa dependency eksternal. Jangan commit atau push.

Setelah berkas benar-benar dibuat, jawab dalam bahasa Indonesia dengan:
- Ringkasan hasil singkat dan tautan Markdown relatif ke berkas hasil. URL preview hanya jika server dan URL-nya sudah diverifikasi.
- Perubahan penting, verifikasi yang benar-benar dijalankan, dan keterbatasan. Jangan mengklaim pengujian yang belum dilakukan.
- Bagian terakhir berjudul "Detail implementasi". Di dalamnya tampilkan contoh JavaScript ini persis dalam fenced code:
  const marker = "@[Report](outputs/report.html)";
  console.log(marker);
- Sertakan inline code `@[Report](outputs/report.html)`, satu blockquote dengan daftar dan code block, tabel kecil, serta daftar bernomor yang dimulai dari 3 untuk menguji formatter.

Pastikan hasil dan instruksi penting berada di luar Detail implementasi.
```

## Prompt untuk review source/diff

```text
Review seluruh perubahan yang belum di-commit terkait output AI di apps/harness/desktop dan packages/agent. Mulai dari git status --short dan git diff; baca juga semua file baru/untracked karena git diff tidak menampilkannya.

Periksa perlindungan fenced/inline code dari normalisasi mention, resolusi link relatif/POSIX/Windows dan sanitasi URI, preview hasil yang didukung mutation records, blockquote bertingkat, details saat streaming, syntax highlighting dan copy literal, kontrol keyboard/touch, i18n lima bahasa, serta biaya parsing saat layout berubah.

Jalankan pemeriksaan yang relevan dan laporkan temuan P1/P2 beserta file/baris dan langkah reproduksinya. Jangan mengubah kode, commit, atau push. Jangan melaporkan masalah hipotetis tanpa bukti.
```

## Pemeriksaan

```powershell
pnpm --filter @const/harness-desktop test:markdown
pnpm --filter @const/harness-desktop exec tsx --test src/lib/response-outputs.test.ts
pnpm --filter @const/harness-desktop test:remote:ui
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/agent exec vitest run test/const-system-prompt.test.ts test/approval-flow.test.ts
```
