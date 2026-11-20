---
name: computer-use
description: >-
  Drives the GUI of visible local desktop applications through native `agent-desktop` computer-use tools: accessibility tree snapshots with snapshot-scoped @refs, headless semantic clicks and value entry, typing, shortcuts, window management, waits, clipboard, and on-demand screenshots. Prefer a programmatic path (shell, filesystem, git, HTTP, existing CLIs) whenever it can complete the task. Use only when a desktop app needs GUI control those cannot reach.
---

# Computer Use (Native Desktop GUI Automation via `agent-desktop`)

Use this skill to inspect and operate local desktop applications on Windows, macOS, and Linux via the native Rust `agent-desktop` engine using Accessibility Trees (UI Automation / AX / AT-SPI) and snapshot-scoped element refs (`@sXXXX:eN`).

## When to Use

- Interacting with native desktop applications (Notepad, Calculator, Explorer/Finder, Settings, Office, Slack/WhatsApp, media players, desktop utilities).
- GUI workflows that lack a CLI or API.
- Note: for web pages, prefer the built-in `browser_*` tools instead of driving an external desktop browser.

> [!IMPORTANT]
> **CRITICAL RULE FOR AGENTS**:
> NEVER write or execute PowerShell, CMD, Bash, VBScript, C#, or Python scripts to automate mouse clicks, keyboard typing, window focus, OCR, or screenshots (e.g., `System.Windows.Forms`, `SendKeys`, `UIAutomationClient`).
> ALWAYS use the native `computer_*` tools.

## Available Native Tools

- `computer_list_apps`: Lists visible running desktop applications (`name`, `pid`, `bundle_id`, window count).
- `computer_list_windows`: Lists visible top-level windows with `windowId`, title, focus/minimized state, and bounds.
- `computer_launch_app`: Launches a local app by name, executable path, or bundle ID (`notepad`, `calc`, `explorer`, etc.) and activates its window.
- `computer_snapshot`: Captures a compact interactive accessibility tree with snapshot-scoped refs (`@sXXXX:eN`). Supports `skeleton: true` for large apps, `root: "@sXXXX:eN"` for subtrees, `surface` (`window`, `focused`, `menu`, `taskbar`, `start-menu`), and `includeBounds: true`. Accessibility-first (no automatic screenshot).
- `computer_find`: Searches elements by `role`, `name`, `text`, `value`, `nativeId`, or `state` and returns actionable `@sXXXX:eN` refs directly.
- `computer_screenshot`: Captures an on-demand PNG screenshot of an app window or display and saves it to disk. Use only when visual verification or a saved screenshot is needed.
- `computer_click`: Clicks or runs semantic ref actions (`click`, `double_click`, `triple_click`, `right_click`, `hover`, `focus`, `toggle`, `check`, `uncheck`, `expand`, `collapse`, `clear`, `scroll_to`, `select`) on a `@sXXXX:eN` ref. Supports absolute screen coordinate fallback (`x`, `y`) when a ref is missing or ambiguous.
- `computer_set_value`: Directly sets text/value on an editable ref (`@sXXXX:eN`) via headless accessibility without stealing focus.
- `computer_type`: Types UTF-8 text into a target ref using physical keystrokes.
- `computer_press_key`: Presses a key or keyboard shortcut chord (`return`, `escape`, `tab`, `CmdOrCtrl+S`, `ctrl+shift+p`). `CmdOrCtrl` automatically maps to `ctrl` on Windows/Linux and `cmd` on macOS.
- `computer_paste_text`: Writes text to the system clipboard and pastes it via `ctrl+v` / `cmd+v`. Preferred for long multiline text or code.
- `computer_scroll`: Scrolls a container ref (`direction`, `amount`) or absolute screen coordinates (`x`, `y`).
- `computer_drag`: Drags between element refs (`fromRef` → `toRef`) or screen coordinates.
- `computer_window`: Manages windows (`focus`, `restore`, `minimize`, `maximize`, `resize`, `move`, `close`).
- `computer_wait`: Waits for an element predicate (`exists`, `enabled`, `visible`, `actionable`, `value`), window title, text appearance, desktop lifecycle event (`window-opened`, `focus-changed`, etc.), or a bounded `ms` delay.
- `computer_clipboard`: Reads (`get`), writes (`set`), or clears (`clear`) the system clipboard.

## Core Interaction Loop

```text
1. Discover or launch app:
   computer_list_apps()
   # or:
   computer_launch_app(app: "notepad", activate: true)

2. Inspect accessibility tree & locate @ref:
   computer_snapshot(app: "Notepad")
   -> Returns refs like @s8f3k2p9:e1 document "Text Editor", @s8f3k2p9:e4 menuitem "File"
   # or find a specific button directly:
   computer_find(app: "Calculator", role: "button", name: "Seven")

3. Act on the qualified ref:
   computer_set_value(ref: "@s8f3k2p9:e1", value: "Hello from Const!")
   # or click:
   computer_click(ref: "@s8f3k2p9:e4")

4. Verify updated state:
   computer_snapshot(app: "Notepad")
```

## Rules & Best Practices

1. **Always Use Qualified Refs (`@sXXXX:eN`)**: Refs embed their snapshot ID. Never strip the `@sXXXX:` prefix. If an action returns `STALE_REF` or `AMBIGUOUS_TARGET`, re-run `computer_snapshot` (or `computer_snapshot` with `includeBounds: true` and fall back to `computer_click(x, y)` for ambiguous twin controls).
2. **Headless-First Semantics**: `computer_click` (single left click), `computer_set_value`, and `computer_scroll` run headlessly via native UIA/AX without stealing focus or moving the cursor. Physical actions (`double_click`, `computer_type`, `computer_press_key`, `computer_drag`, coordinate clicks) automatically take focus as needed.
3. **Minimized Windows**: Minimized windows report offscreen controls. Call `computer_window(action: "restore", app: "<app>")` (or `computer_snapshot(app: "<app>", restoreWindow: true)`) before inspecting.
4. **Large Apps & Dialogs**: Use `computer_snapshot(app: "<app>", skeleton: true)` first, then drill into a container with `computer_snapshot(root: "@sXXXX:eN")`, or jump straight to controls with `computer_find`.
5. **Prefer `computer_wait` Over Blind Delays**: Wait for a window, text, or element predicate instead of fixed sleeps.
6. **Delivery Is Not Verification**: Inspect the updated accessibility tree (via `computer_snapshot` or `computer_find`) before claiming success. On timeout, inspect fresh state before retrying so actions are not duplicated.
7. **Safety & Sensitive Apps**: Never automate password entry or sensitive credential stores without explicit user confirmation.
8. **One Desktop Owner**: Only one conversation can drive the desktop at a time. If another conversation holds the lock, wait rather than running shell workarounds.
