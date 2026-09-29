# AGENTS.md — Const Learn Development Guide for AI Agents

Welcome, Agent. This document establishes the operational principles, technical guidelines, design system rules, and verification protocols for working in `@const/learn` (`apps/learn/desktop` & `apps/learn/mobile`).

---

## 1. Core Operating Principles

1. **Analyze First, Modify Later:**
   - Always inspect relevant files and existing architecture before proposing or writing code.
   - Never assume missing functionality without grepping or viewing existing code.
   - Understand dependencies and patterns used across both desktop and mobile workspaces.

2. **Strict Design System Compliance (`apps/learn/DESIGN.md`):**
   - Read and strictly apply [`apps/learn/DESIGN.md`](./DESIGN.md) for all UI changes.
   - Use the austere monochrome studio palette:
     - Background / Canvas: `#161616`
     - Sidebar & Field Background: `#2b2b2b`
     - Header Strip & Card Headers: `#222222`
     - Borders & Hairlines: `#383838` (or `#2e2e2e` for chips)
     - Text Ink: `#ffffff` (primary), `#d4d4d4` (secondary), `#969696` (muted/utility)
   - Mandatory Radix `ScrollArea` for scrollable panes — never native browser scrollbars.
   - 16px/24px geometry, borderless panels, zero harsh divider lines.

---

## 2. Mandatory Internationalization (i18n) Architecture

### The Anti-Pattern to NEVER Use
❌ **DO NOT use inline boolean ternaries:**
```tsx
// ❌ STRICTLY FORBIDDEN
<span>{isIndo ? "Tutup" : "Close"}</span>
toast.error(isIndo ? "Gagal memuat" : "Failed to load");
```
*Why this is prohibited:* It bypasses the i18n dictionary, clutters JSX, lacks type safety, and will completely break when adding a 3rd or 4th language (e.g., Japanese, Spanish, French).

### The Canonical Pattern to ALWAYS Follow
✅ **Always use `t("keyName")` backed by dictionary definitions:**
```tsx
// ✅ REQUIRED
const { t } = useI18n();
<span>{t("close")}</span>
toast.error(t("failedToLoad"));
```

### Translation Dictionary Locations & Symmetry
Whenever adding new UI strings, buttons, placeholders, dialog titles, or error messages, add the keys symmetrically (1:1) to both:
- Desktop: [`apps/learn/desktop/src/lib/i18n.tsx`](./desktop/src/lib/i18n.tsx)
- Mobile: [`apps/learn/mobile/src/lib/i18n.tsx`](./mobile/src/lib/i18n.tsx)

Both dictionaries must maintain **100% byte-for-byte parity and symmetry**. Never introduce duplicate property keys inside object literals (which causes `TS1117`). Ensure all newly created `.tsx` components in both desktop and mobile consume structured `t("keyName")` keys instead of inline language ternaries.

### Interpolation Rules
Use named parameters with curly braces for dynamic values:
```tsx
// In i18n dictionary:
failedExportPdf: "Failed to export PDF: {error}",
maxSourcesReached: "Maximum limit reached ({count} sources).",

// In component:
toast.error(t("failedExportPdf", { error: err.message }));
```

---

## 3. Post-Change Quality & Audit Protocol

Every coding session or feature update must undergo the following cleanup checklist:

1. **Audit for Bugs & Regressions:**
   - Verify event listeners, hook dependencies, race conditions, and unhandled promise rejections.
   - Confirm proper state cleanup in `useEffect` return functions.

2. **Clean Up Junk & Dead Code:**
   - Remove unused imports, dead variables, orphaned helper functions, and `console.log` noise.
   - Ensure zero temporary test files or scratch scripts remain in the working tree.

3. **Mandatory Typecheck Verification:**
   Before declaring work complete, both packages MUST pass type checking with zero errors:
   ```bash
   pnpm --filter @const/learn-desktop check-types
   pnpm --filter @const/learn-mobile check-types
   ```

4. **Git Hygiene & Clean Commits:**
   - Run `git status` and verify that only intended files are modified.
   - Write clear semantic commit messages (e.g., `feat(learn): ...`, `fix(learn): ...`, `refactor(learn): ...`).

---

## 4. Workspaces & Key Directories

- `apps/learn/desktop/src/`:
  - `components/home/`: Home views (`models-view.tsx`, `mcp-tools-view.tsx`), dialogs.
  - `components/workspace/`: Main workspace, chat panel, source dialogs, studio artifact creation dialogs.
  - `components/right-pane/`: Studio viewers (presentation, report, audio, video, mind map, flashcard, quiz, cheatsheet).
  - `lib/`: `i18n.tsx`, local database (`db.ts`), studio generator (`generator.ts`), voice/image configurations.
- `apps/learn/mobile/src/`:
  - `components/home/`: Mobile sheets (`model-selection-sheet.tsx`, `mcp-tools-sheet.tsx`, `mobile-settings-sheet.tsx`), dialogs.
  - `components/workspace/`: Mobile workspace, artifact reader, creation sheets, mobile viewers.
  - `lib/`: `i18n.tsx`, mobile database, studio generators, voice/image configurations.
