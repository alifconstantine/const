# Audit pairing dan UI remote control — 30 Oktober 2026

Fokus: modal remote control desktop, kode pairing enam karakter, dan navigasi
sidebar workspace remote pada layar ponsel. UI mengikuti komponen Settings yang
sudah ada (`SettingsSection`, `SettingsRow`, dan gaya tombol yang sama).

## Commit yang diperiksa

- `da06e0cf`: menambah kode pairing, Remote Hub web, dan aplikasi Android.
- `2d2127a1`: menambah fallback pembuatan sesi untuk relay dengan schema lama.
- `ddedba8d`: mengganti default Convex ke `earnest-hawk-132`.
- `15a7c0e9`: menyelaraskan konfigurasi desktop dan penanganan error autentikasi.

Penggantian URL dan pesan autentikasi belum memperbaiki fallback yang tetap
mengiklankan kode meskipun kode tidak dikirim ke relay. Endpoint produksi
`remote:resolvePairingCode` menjawab `REMOTE_UNAUTHORIZED` pada probe tanpa token:
fungsinya tersedia dan membutuhkan autentikasi. Probe ini tidak membuktikan
pairing akun pengguna berhasil ataupun memastikan versi semua aplikasi terpasang.

## Temuan dan perbaikan

| Prioritas | Temuan | Perbaikan |
| --- | --- | --- |
| P1 | Fallback `create` tidak mengirim `pairingCode`/`encryptedSecret`, tetapi status tetap berisi kode lokal. QR/link membawa secret langsung sehingga tetap dapat bekerja. | Fallback hanya untuk `ArgumentValidationError` yang secara eksplisit menolak field pairing. Sesi legacy mengembalikan `pairingCode: null`; UI menjelaskan kebutuhan pembaruan layanan dan tetap menyediakan QR/link. |
| P1 | Semua error selain unauthorized dicoba ulang tanpa field pairing, termasuk timeout dan session limit. Timeout dapat terjadi setelah server membuat sesi. | Error tersebut diteruskan tanpa membuat permintaan sesi kedua. |
| P2 | Lookup kode mengambil record pertama sebelum memeriksa pemilik dan masa berlaku. Record lama atau milik akun lain dengan kode sama dapat menutupi undangan valid. | Pilih kandidat aktif milik akun yang terautentikasi dari index kode yang sama. Pengecekan pemilik dan masa berlaku tetap wajib. |
| P1 | CSS mobile menyembunyikan `workspace-toolbar > div:last-child`. Ketika panel kanan tertutup, kelompok navigasi kiri adalah child terakhir dan hamburger ikut hilang. | Gunakan atribut khusus navigasi dan aksi toolbar. Hamburger memiliki target sentuh 44×44 px. |
| P2 | Modal memiliki tombol salin tautan ganda, status berulang, animasi dekoratif, dan ID teknis yang tidak membantu pairing. Daftar perangkat dibatasi tinggi 160 px dengan overflow tersembunyi. | Gunakan struktur Settings: kontrol sesi, satu area QR/kode, serta daftar perangkat saat terhubung. Hapus ID/badge dekoratif dan batas daftar yang memotong perangkat. Seluruh konten menggunakan Radix ScrollArea. |
| P2 | Teks pairing code, copy, dan sisa waktu sebelumnya hardcoded. | Tambahkan label, petunjuk, dan expiry pada kelima bahasa: en/id/ja/zh/es. |

Kode tetap memakai format enam karakter `XXX-XXX` (huruf dan angka), sesuai
implementasi yang diperkenalkan `da06e0cf`. Normalisasi menerima huruf kecil,
spasi, dan kode tanpa tanda hubung. Perubahan ini tidak mengubah format protokol.
Status salin kode juga dilindungi dari hasil clipboard lama setelah rotasi sesi.

## Verifikasi

- `pnpm --filter @const/harness-desktop test:remote`: **28 tes lulus**.
- `pnpm --filter @const/backend test:remote`: **46 tes lulus**.
- `pnpm --filter @const/harness-desktop test:remote:ui`: **16 skenario lulus**.
- Typecheck desktop dan backend: **exit 0**.
- Build desktop dan bundle remote: **exit 0**.

Regresi pairing menjalankan create → resolve kode → dekripsi secret → join,
serta memeriksa akun lain, kode salah, undangan kedaluwarsa, record kode yang
bertabrakan, fallback legacy, dan error yang tidak boleh membuat sesi kedua.
Tes relay memeriksa secret dari kode sama dengan secret pada QR/link.

UI diuji dengan fixture komponen produksi dalam Electron/Chromium terisolasi:
mulai, salin kode/link, rotasi, berhenti, empat perangkat terhubung, expiry,
relay lama, pemulihan error, tema terang/gelap, serta kelima bahasa pada lebar
320 px. Hamburger diuji memakai hit testing dan `Input.dispatchTouchEvent`
Chromium pada 390×844, termasuk membuka sidebar dan menutupnya kembali.
Screenshot modal, sidebar, dan layar sempit diperiksa secara visual.

Suite lama semula gagal karena mengunci durasi animasi panel di 280 ms, sementara
implementasi saat ini 220 ms. Assertion kini memeriksa bahwa durasi chat dan panel
sama dan animasi aktif; pemeriksaan gerakan per frame dan reduced motion tetap ada.

Detector Impeccable pada source tidak menemukan temuan baru pada modal dan toolbar.
Temuan di CSS remote adalah font Inter yang diwajibkan DESIGN.md dan advisory
untuk warna/ukuran, termasuk fill hover tombol menu. Ini pemeriksaan source, bukan sertifikasi aksesibilitas
atau pengukuran performa perangkat pengguna.

## Batas dan penerapan

- Belum mereproduksi kegagalan kode dengan akun/sesi produksi pengguna. Fallback
  kode palsu dan lookup record pertama adalah cacat kode terverifikasi, bukan
  bukti keduanya pasti penyebab kejadian yang dilaporkan.
- Tidak ada deploy produksi pada audit ini. Perbaikan lookup
  memerlukan deploy `packages/backend/convex/remote.ts` ke deployment yang digunakan
  desktop dan web; UI memerlukan build desktop baru serta bundle remote terbaru.
- Relay lama masih hanya mendukung QR/link sampai layanannya diperbarui. UI kini
  menyatakan batas itu secara jelas dan tidak menampilkan kode yang tidak tersimpan.
- `New pairing` mempertahankan perilaku sebelumnya: memutus perangkat lama dan
  membuat sesi/undangan baru. Tooltip menjelaskan efeknya.
- Touch sintetis dan viewport kecil tidak menggantikan uji fisik Android/iOS.
  Pemindaian QR dengan kamera dan login SSO produksi belum diuji pada perangkat asli.

## Penyesuaian berdasarkan screenshot

Modal sebelum Start mempertahankan struktur dan ukuran area pairing: placeholder
memakai ikon QR, ada petunjuk memulai koneksi, dan aksi salin/perbarui nonaktif.
Daftar perangkat hanya muncul jika sudah ada perangkat terhubung. Membuka modal
tetap hanya membaca status, tanpa memulai remote control secara otomatis.

Menu mobile kini berada di shell workspace, terpisah dari isi toolbar dan
percakapan. Satu tombol yang menetap menampilkan dua garis, bertransisi menjadi X
selama 220 ms saat sidebar dibuka, dan kembali menjadi dua garis saat ditutup.
Tombol yang sama tetap dapat disentuh di atas sidebar; header sidebar memberi
ruang untuknya. Sidebar tertutup inert agar tautannya tidak menerima fokus.

Regresi baru memuat halaman awal mobile secara langsung pada 360×740, tanpa
membuka percakapan lebih dulu. Tes memeriksa hit testing, posisi tombol yang
menetap, frame perantara animasi, dan reduced motion. Skenario percakapan 390×844
juga membuka serta menutup sidebar dengan touch sintetis pada tombol yang sama.
Screenshot halaman awal dan kedua status ikon diperiksa secara visual.

Pada pemeriksaan akhir, fokus awal dialog dipindah ke container agar tombol X
tidak mendapat outline otomatis. Tombol Close tidak memiliki border/outline;
fokus keyboard memakai fill lembut. Regresi UI memeriksa fokus awal dialog, Tab
ke tombol Close, dan computed border/outline setelah menerima fokus keyboard.
Kegagalan membuka alamat Remote Hub juga ditangkap dan memakai error UI yang ada.
