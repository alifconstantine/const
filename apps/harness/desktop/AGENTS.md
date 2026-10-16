# AGENTS.md — Const Harness Desktop Development Guide

This document establishes operational principles, internationalization (i18n) rules, technical guidelines, design system rules, and verification protocols for working in `@const/harness-desktop` (`apps/harness/desktop`).

---

## 1. Mandatory Internationalization (i18n) Protocol

**RULE #1: ZERO HARDCODED USER-FACING STRINGS.**
Any text visible to the end user—including labels, placeholders, buttons, menu items, tooltips, dialog titles, confirmation messages, error descriptions, and toast notifications—**MUST** use the central i18n system.

### How to Use Translations in Components:

```tsx
import { useTranslation } from "../lib/i18n"; // or relative path to src/lib/i18n

export function MyComponent() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div>
      <h3>{t("common.save")}</h3>
      <input placeholder={t("workbench.askPlaceholder")} />
      <button title={t("common.close")}>{t("common.close")}</button>
    </div>
  );
}
```

### Adding New Translation Keys (The 3-Step Protocol):

When introducing any new string:
1. **Define in Schema (`src/locales/types.ts`)**:
   Add the typed key to the corresponding domain interface (`common`, `sidebar`, `workbench`, `topToolbar`, `rightPane`, `settings`, `scheduledTasks`, `commandPalette`, `toast`, `auth`).

2. **Populate All 5 Supported Languages**:
   Provide natural, accurate translations in ALL 5 dictionaries:
   - [`src/locales/en.ts`](./src/locales/en.ts) (English - primary)
   - [`src/locales/id.ts`](./src/locales/id.ts) (Indonesian)
   - [`src/locales/ja.ts`](./src/locales/ja.ts) (Japanese)
   - [`src/locales/zh.ts`](./src/locales/zh.ts) (Chinese)
   - [`src/locales/es.ts`](./src/locales/es.ts) (Spanish)

   > **Note:** The TypeScript compiler enforces `TranslationDictionary` completeness. If any of the 5 files misses a key, `check-types` will fail.

3. **Dynamic Parameter Replacement**:
   For strings containing dynamic values (e.g. counts, names, timestamps), format with `{param}` placeholders:
   ```ts
   // en.ts: ranTimes: "Ran {count} times"
   // usage:
   t("scheduledTasks.ranTimes").replace("{count}", String(runCount))
   ```

### Language Storage & Synchronization:
- Active language is stored in `localStorage` under `const_app_language`.
- Cross-tab / cross-window synchronization uses `window.dispatchEvent(new CustomEvent("const-language-changed"))` and storage listeners.

---

## 2. Design System & Studio Aesthetics (`apps/harness/DESIGN.md`)

- **Palette**: Austere monochrome studio theme:
  - Base canvas: `#161616`
  - Sidebar & inputs: `#2b2b2b`
  - Header strips & cards: `#222222`
  - Borders & outlines: `#383838` (or `#2e2e2e` for chips)
  - Text: `#ffffff` (primary), `#d4d4d4` (secondary), `#969696` (muted), `#5d5d5d` (placeholder)
- **Radix `ScrollArea` Mandatory**:
  - Never use native OS scrollbars (`overflow-y-auto` is strictly forbidden for user-facing panes/lists).
  - Always wrap scrollable views in `<ScrollArea thumbClassName="bg-white/20 hover:bg-white/30">`.
- **Focus Rings**:
  - Suppress browser/OS focus outlines (`outline-none focus:outline-none focus-visible:outline-none ring-0`).
- **Rounded Corners & Geometry**:
  - Standard container radii: `rounded-xl` or `rounded-2xl`.

---

## 3. Directory Layout

- `src/lib/i18n.tsx`: Context, hook (`useTranslation` / `useI18n`), and helper utilities.
- `src/locales/`:
  - `types.ts`: Master TypeScript translation dictionary schema.
  - `en.ts`: English translations.
  - `id.ts`: Indonesian translations.
  - `ja.ts`: Japanese translations.
  - `zh.ts`: Chinese translations.
  - `es.ts`: Spanish translations.
  - `index.ts`: Aggregated dictionaries and supported languages array.
- `src/components/`:
  - `sidebar.tsx`: Navigation, workspaces, projects, task history, language switch.
  - `command-palette-modal.tsx`: Global search & quick actions.
  - `login-titlebar.tsx`: Frameless window drag region and window controls.
  - `settings-view.tsx` & `settings/`: Settings dialogs and model configurations.
  - `workbench/`: Chat card, top toolbar, dialogs, traces, mentions, markdown renderer.
  - `right-pane/`: Tab manager, terminal, file diffs, previews, browser, side chat.
  - `scheduled-tasks/`: Scheduled tasks dashboard, forms, history, pickers.

---

## 4. Verification Gate

Before completing any task in `apps/harness/desktop`, you **MUST** run:
```bash
pnpm --filter @const/harness-desktop check-types
```
Exit code MUST be 0.

If build configs or dependencies were modified, also verify with:
```bash
pnpm --filter @const/harness-desktop build
```
Exit code MUST be 0.
