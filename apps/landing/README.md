# Const — situs ekosistem

[const.web.id](https://const.web.id) memperkenalkan produk Const dan mengarahkan pengunjung ke Harness, Learn, Router, dan Accounts. Situs ini adalah portal publik; workspace dan API berada di aplikasi produk masing-masing.

Produk dan source dijelaskan di [README utama](../../README.md). Dokumentasi penggunaan Harness tersedia di [Harness Docs](https://harness.const.web.id/docs), sedangkan kontrak API berada di [Router Docs](https://router.const.web.id/docs).

```sh
pnpm --filter @const/landing dev
pnpm --filter @const/landing check-types
pnpm --filter @const/landing build
```

Jalankan dari root setelah `pnpm install`. Dev server memakai port 3000.
