# AGENTS.md — Const Harness Development Guide for AI Agents

Welcome, Agent. This document establishes the operational principles, technical guidelines, design system rules, and verification protocols for working in `@const/harness` (`apps/harness/desktop` & `apps/harness/cli`).

---

## 1. Core Operating Principles

1. **Analyze First, Modify Later:**
   - Always inspect relevant files and existing architecture before proposing or writing code.
   - Never assume missing functionality without grepping or viewing existing code.
   - Understand dependencies and patterns used across the harness desktop workspace.

2. **Strict Design System Compliance (`apps/harness/DESIGN.md`):**
   - Read and strictly apply [`apps/harness/DESIGN.md`](./DESIGN.md) for all UI changes.
   - Use the austere monochrome studio palette:
     - Background / Canvas: `#161616`
     - Sidebar & Field Background: `#2b2b2b`
     - Header Strip & Card Headers: `#222222`
     - Borders & Hairlines: `#383838` (or `#2e2e2e` for chips)
     - Text Ink: `#ffffff` (primary reading ink), `#d4d4d4` (secondary interface ink), `#969696` (muted/utility)
     - Placeholder / Faint Text: `#5d5d5d`
   - **Mandatory Radix `ScrollArea`** for scrollable panes — never native browser scrollbars (`overflow-y-auto` is strictly prohibited for user-facing lists and panels).
   - **16px/24px geometry**, borderless panels, zero harsh divider lines (`border-b`, `border-t`, `divide-y`).
   - Suppress unwanted OS/browser focus outlines and yellow accent rings on modal dialogs and dropdown containers (`outline-none focus:outline-none focus-visible:outline-none ring-0`).

---

## 2. Post-Change Quality & Audit Protocol

Every coding session or feature update must undergo the following cleanup checklist:

1. **Audit for Bugs & Regressions:**
   - Verify event listeners, hook dependencies, race conditions, and unhandled promise rejections.
   - Confirm proper state cleanup in `useEffect` return functions.

2. **Clean Up Junk & Dead Code:**
   - Remove unused imports, dead variables, orphaned helper functions, and `console.log` noise.
   - Ensure zero temporary test files or scratch scripts remain in the working tree.

3. **Mandatory Typecheck Verification:**
   Before declaring work complete, the package MUST pass type checking with zero errors:
   ```bash
   pnpm --filter @const/harness-desktop check-types
   ```

4. **Git Hygiene & Clean Commits:**
   - Run `git status` and verify that only intended files are modified.
   - Write clear semantic commit messages (e.g., `feat(harness): ...`, `fix(harness): ...`, `refactor(harness): ...`).

---

## 3. Workspaces & Key Directories

- `apps/harness/desktop/src/`:
  - `components/workbench/`: Chat card, top toolbar, chat indicator, execution trace, floating todo card, dialogs.
  - `components/right-pane/`: Open tab view, terminal tab, task output tab, file preview tab, file diff tab, browser tab, review tab.
  - `components/scheduled-tasks/`: Scheduled tasks dashboard, form, history, custom dropdowns, time picker.
  - `components/sidebar.tsx`: Workspace sidebar, project list, task history, navigation.
  - `components/settings-view.tsx`: Global settings modal.
  - `lib/`: `conversation-store.ts`, `theme.ts`.
  - `App.tsx`: Main workbench orchestrator and state management.
