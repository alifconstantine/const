# Const Harness v0.0.4 Implementation Plan

Target release tag: `harness-v0.0.4` (published to `alifconstantine/const-harness-release`).

This plan covers:
1. **Release, Versioning & Updater Polish** (items carried over from v0.0.3 feedback)
2. **Linux & Remote Parity Cleanup**
3. **Persistent Bots ("AI Teammates") Feature** (inspired by `openbot` and Grok Bot, built onto Const Harness's existing Pi engine, SQLite, Scheduled Tasks, Browser, Computer Use, Skills, and Remote Control)

---

## 1. Release, Versioning & Updater Polish

### 1.1 Version Bump Checklist (Before Building v0.0.4 Binaries)
Ensure all client version manifests match `0.0.4` **before** running any installer/APK build so `Installed version` matches the GitHub Release tag and avoids re-downloading the same version:
- `apps/harness/desktop/package.json`: `"version": "0.0.4"`
- `apps/harness/mobile/package.json`: `"version": "0.0.4"`
- `apps/harness/mobile/android/app/build.gradle`: `versionCode 4` and `versionName "0.0.4"`
- *(Optional guard)*: Add a small pre-package check script in `apps/harness/desktop` that compares `desktop/package.json`, `mobile/package.json`, and `android/app/build.gradle` `versionName` before building release artifacts.

### 1.2 Inline Markdown Formatting in `ReleaseNotes`
- **File:** `apps/harness/shared/updates/update-control.tsx`
- **Problem:** `ReleaseNotes` currently parses `#` headings and `-`/`*` bullet items, so inline `**bold**` and `` `code` `` render literally (`**Pi Engine & Slash Commands:**`).
- **Fix:**
  - Extend `ReleaseNotes` with a lightweight, safe inline tokenizer (React nodes only — no `dangerouslySetInnerHTML`, no external link execution) supporting:
    - `**bold**` → `<strong className="font-semibold">`
    - `` `inline code` `` → `<code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">`
  - Add unit coverage verifying inline formatting renders cleanly and untrusted HTML/links remain inert plain text.

---

## 2. Linux & Remote Parity Cleanup

### 2.1 Linux Release & Web Download Support
- Build and attach `.AppImage` and `.pacman` (plus optional `.deb`) artifacts on a Linux host for `harness-v0.0.4`.
- Update `apps/harness/web/src/lib/releases.ts` (`selectPublishedBuilds`) and `apps/harness/web/src/components/DownloadPage.tsx` to surface `{ os: "linux", arch: "x64" }` once Linux assets are published.
- Publish/maintain `const-harness-bin` on AUR (`PKGBUILD` pulling the verified `.pacman`/`.AppImage` release asset from `const-harness-release`).

### 2.2 Remote Web & Mobile Voice Input Parity
- **Files:** `packages/remote/src/desktop-contract.ts`, `apps/harness/desktop/src/components/workbench/chat-card.tsx`
- **Problem:** `stt:transcribe` is not in `desktopChannels`, so browsers with a microphone over HTTPS show `<Mic />` in remote sessions and then fail with `REMOTE_CAPABILITY_DENIED`.
- **Fix (pick one cleanly):**
  - **Option A (Recommended):** Add `"stt:transcribe"` to `desktopChannels` (with size limit validation in `remote-desktop-controller.ts`) so remote browsers/phones can dictate via the host's configured STT provider, **or**
  - **Option B:** Hide the `<Mic />` button inside `ChatCard` when `useRemoteRuntime()` is active if remote dictation is intentionally out of scope.

---

## 3. Persistent Bots ("AI Teammates") — Core Feature for v0.0.4

### 3.1 Goals
Move beyond single-use chat threads by introducing **persistent Bots** — named AI teammates with their own identity, standing instructions (`AGENTS.md`), isolated workspace, dedicated model/permission overrides, FIFO task queue, and quiet scheduled routines.

### 3.2 Architecture & Data Model

#### A. SQLite Persistence (`apps/harness/desktop/electron/database.ts`)
Add a `bots` table and link existing `conversations` and `scheduled_tasks` to bots:
- `bots` table:
  - `id` (string primary key)
  - `name`, `roleTitle`, `avatar` (icon/emoji/color/custom image path)
  - `workspacePath` (default `~/.const/harness/bots/<botId>`)
  - `instructionsPath` (`<workspacePath>/AGENTS.md`)
  - `providerId`, `modelId`, `thinkingLevel`, `permissionMode` (`ask_before_changes` | `full_access` | `request_review`)
  - `enabledSkills` (JSON array), `enabledMcpServers` (JSON array), `computerUseEnabled` (boolean)
  - `status` (`idle` | `running` | `paused` | `error`), `unreadCount`, `lastActiveAt`, `createdAt`, `updatedAt`
- `conversations`: add optional `botId?: string` so each Bot owns its persistent main thread plus sub-threads.
- `scheduled_tasks`: add optional `botId?: string` so routines execute using that Bot's instructions, workspace, model, and memory.

#### B. Main-Process Bot Service (`apps/harness/desktop/electron/bots/bot-service.ts`)
- **CRUD & Workspace Management:** Create/update/delete bots, initialize `~/.const/harness/bots/<botId>/AGENTS.md` and `memory/`, validate paths within managed directories.
- **FIFO Queue & Boot Recovery:** Per-bot serialized message/routine queue backed by SQLite so manual chat messages and scheduled routines for the same Bot never collide and survive restarts safely.
- **Background Tray Mode (Optional Toggle):** Add Electron `Tray` support in `electron/main.ts` so Bots and scheduled routines keep running when the user closes/minimizes the main window to tray.

#### C. Bot Tools (`packages/agent` / `electron/bots/bot-tools.ts`)
- **`routine_no_update`:** Allows a Bot running a scheduled routine to signal "nothing new to report" so the run records in history (collapsed) without firing desktop/mobile notifications or incrementing unread counts.
- **Prompt-Driven Creation (`create_bot` / `update_bot_profile`):** Lets users describe a Bot in plain chat (*"Create a bot to monitor PRs in this repo every morning at 9"*) and generates a structured draft (name, role, `AGENTS.md`, model, schedule) for one-click confirmation before saving.
- **Guardrails:** Bots cannot elevate their own `permissionMode` or `computerUseEnabled` beyond what the user explicitly configured.

#### D. UI & UX (`apps/harness/desktop/src/`)
Follow `apps/harness/DESIGN.md` and `apps/harness/desktop/AGENTS.md` (Radix `ScrollArea`, monochrome `#161616`/`#222222`/`#2b2b2b` surfaces with `#3b82f6` accents, and all 5 locales: `en`, `id`, `ja`, `zh`, `es`):
1. **Sidebar "Bots" Section (`src/components/sidebar.tsx`):**
   - Dedicated `Bots` list above/alongside project folders showing avatar, status indicator (`running` / `idle`), and unread badge, plus `+ New Bot`.
2. **Bot Creation & Profile Drawer/Modal:**
   - Two creation paths: **From Prompt** (describe what you want, review generated profile + `AGENTS.md`) and **Manual / Template** (e.g., Coding Teammate, Research Monitor, Daily Digest).
   - Edit instructions (`AGENTS.md`), model/reasoning, permission mode, active skills/MCPs, and attached schedules.
3. **Bot Workspace & Quiet Routine History:**
   - Clicking a Bot opens its persistent conversation stream with header controls for profile/instructions, active schedules, and collapsed quiet routine runs.
4. **Remote Control Integration (`packages/remote/src/desktop-contract.ts`):**
   - Expose `bots:list`, `bots:get`, `bots:create`, `bots:update`, `bots:delete`, and `bots:send-message` via `desktopChannels` so Bots work seamlessly in Web Remote (`apps/harness/web`) and Mobile (`apps/harness/mobile`).

### 3.3 Future Follow-Up (Post-v0.0.4 / v0.0.5)
- **Inter-Bot Collaboration:** `send_to_bot` handoffs and shared multi-bot channels.
- **External Messaging Connectors:** Long-polling / WebSocket adapters for Telegram (`grammy`) and Discord (`discord.js`) hosted from the desktop runtime.

---

## 4. Verification Checklist for v0.0.4
- `pnpm --filter @const/harness-desktop check-types`
- `pnpm --filter @const/harness-mobile check-types`
- `pnpm --filter @const/harness-web check-types`
- `pnpm --filter @const/harness-desktop test:updates`
- `pnpm --filter @const/harness-desktop test:remote`
- `pnpm --filter @const/harness-desktop test:models`
- Unit & integration tests for `bots` SQLite CRUD, FIFO queue recovery, `routine_no_update` quiet runs, and `ReleaseNotes` inline Markdown rendering.
- Rebuild remote bundle (`pnpm --filter @const/harness-mobile sync:android` & `pnpm --filter @const/harness-web build:workspace`) before packaging release artifacts.
