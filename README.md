# Const Platform Monorepo

Master monorepo untuk ekosistem **Const Platform**, dibangun menggunakan **Turborepo** dan **pnpm**.

## Struktur Proyek

```text
Const/
├── apps/                 # Aplikasi web & service deployable
│   ├── accounts/         # Identity Provider & Central Auth Hub (accounts.const.web.id)
│   ├── router/           # Universal AI Gateway (router.const.web.id)
│   ├── landing/          # Portal showcase ekosistem (const.web.id)
│   ├── learn/            # Platform edukasi adaptif AI - ICONFEST 2026 (learn.const.web.id)
│   └── harness/          # Desktop & Web Dev Workbench (harness.const.web.id)
│
├── packages/             # Shared packages internal
│   ├── backend/          # Unified Convex Backend (Domain-Driven Architecture)
│   ├── ui/               # Const Design System (Shared Component Library)
│   └── typescript-config/# Shared TSConfig presets
│
├── turbo.json            # Turborepo task pipeline & caching
└── pnpm-workspace.yaml   # Definisi workspace
```

## Memulai Pengembangan

### Prasyarat

- Node.js >= 20.x
- pnpm >= 9.x

### Instalasi Dependensi

```bash
pnpm install
```

### Menjalankan Server Pengembangan

```bash
pnpm dev
```

### Memeriksa Type dan Lint

```bash
pnpm check-types
pnpm lint
```

### Build Semua Aplikasi

```bash
pnpm build
```
