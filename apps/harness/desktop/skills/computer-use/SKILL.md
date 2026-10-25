---
name: computer-use
description: >-
  Drives the GUI of visible local desktop applications through native computer-use tools: accessibility tree, clicks, typing, menus, dialogs, and screenshots in native apps and external windows (Chrome, Edge, Spotify, VS Code, Office, Settings, etc.). Prefer a programmatic path (shell, filesystem, git, HTTP, existing CLIs) whenever it can complete the task. Use only when a visible window needs GUI control those cannot reach.
---

# Computer Use (Desktop GUI Automation)

Use this skill to inspect and drive visible local application windows on Windows, macOS, and Linux using native Accessibility Trees, UI Automation, and Win32/OS input events.

## When to Use

- Interacting with native desktop applications (system settings, media players, messaging apps, IDEs, desktop utilities).
- When a web page or application must be operated through an external desktop browser window rather than headless HTTP.
- GUI workflows that lack a CLI or API.

> [!IMPORTANT]
> **CRITICAL RULE FOR AGENTS**:
> NEVER write or execute PowerShell, CMD, Bash, VBScript, C#, or Python scripts to automate mouse clicks, keyboard typing, window focus, OCR, or capture screenshots (e.g., `Add-Type -AssemblyName System.Windows.Forms`, `SendKeys`, `Windows.Media.Ocr`, `UIAutomationClient`).
> You MUST ALWAYS use the native `computer_*` tools (`computer_click`, `computer_set_value`, `computer_type_text`, `computer_press_key`, `computer_hotkey`, `computer_get_app_state`).
> If an element index is not found in the accessible UI tree (common in UWP/WinUI apps like WhatsApp or Spotify), look at the screenshot provided in `Screenshot File` and click using window-local coordinates: `computer_click(app: "<app>", x: <x>, y: <y>)`, or use standard keyboard shortcuts (`computer_hotkey`).

## Available Native Tools

- `computer_list_apps`: Lists visible and running desktop applications (`name`, `pid`, `bundleId`).
- `computer_list_windows`: Lists all windows for a given app.
- `computer_get_app_state`: Fetches the accessibility tree with numbered element indices (e.g. `[42] Button 'Save'`) and captures an optional visual screenshot.
- `computer_click`: Clicks a UI element by `elementIndex` (recommended) or window-local `x, y` coordinates. Supports `mouseButton` (`left`, `right`, `middle`), `clickCount` (1 or 2), and `modifiers` (`CmdOrCtrl`, `Shift`, `Alt`).
- `computer_set_value`: Directly writes text or values into editable UI controls without keyboard typing delay.
- `computer_type_text`: Synthesizes character typing into the focused control.
- `computer_press_key`: Presses single keys (`Return`, `Escape`, `Tab`, `Backspace`, arrows, etc.).
- `computer_hotkey`: Triggers keyboard chords (e.g. `CmdOrCtrl+A`, `Ctrl+Shift+P`, `Alt+F4`).
- `computer_paste_text`: Pastes large text via system clipboard.
- `computer_scroll`: Scrolls containers up, down, left, or right.
- `computer_drag`: Performs drag-and-drop between elements or coordinates.

## Core Interaction Loop

```text
1. Discover app:
   computer_list_apps()

2. Inspect state & locate element:
   computer_get_app_state(app: "notepad.exe", restoreWindow: true)
   -> Reads treeText: "[12] MenuItem 'File'", "[42] Edit 'Text Editor'"

3. Act on element index:
   computer_set_value(app: "notepad.exe", elementIndex: 42, value: "Hello from Const!")

4. Or trigger navigation / shortcut:
   computer_hotkey(app: "notepad.exe", key: "Ctrl+S")
```

## Rules & Best Practices

1. **Element Indexes Are Ephemeral**: Always use the fresh state returned by each action or call `computer_get_app_state` before selecting the next element index. Indices change after scrolling, dialog popups, or window focus shifts.
2. **Prefer Semantic Actions**: Use `computer_set_value` for form inputs and text fields instead of clicking and typing character-by-character.
3. **Screenshots & Scaling**: Screenshots are attached as visual tool observations. Window-local coordinates use the unscaled window bounds. Compute both `action_x = pixel_x / screenshotScale` and `action_y = pixel_y / screenshotScale`. Do not add the screen origin. If the model cannot receive images, use accessible elements; do not guess coordinates from file metadata.
4. **Safety & Sensitive Apps**: Password managers and password fields are protected and blocked from observation. Never attempt to automate credential entry or expose secrets unless explicitly instructed by the user.
5. **Delivery Is Not Verification**: An action can deliver input while its intended effect remains `unverified`. Inspect the returned screenshot/tree before stating that a chat opened, text appeared, or a message was sent. If the observation is insufficient, report that limit explicitly.
6. **Timeouts & Changed Windows**: Input may have occurred before a timeout or failed post-action snapshot. Inspect fresh state before retrying so clicks, pastes, and messages are not duplicated. Refresh the app state after `snapshot_required` or `stale_element`.
7. **One Desktop Owner**: If `desktop_busy` is returned, another chat owns the desktop. Wait for that chat to finish; do not bypass the lock through shell scripts.

## App Notes & Troubleshooting

- **WhatsApp / Messaging Apps (UWP / WinUI)**:
  - If WhatsApp elements (such as the search bar or message box) do not show element indices in the tree, use `computer_hotkey(app: "WhatsApp", key: "Ctrl+F")` to immediately focus the search/chat bar.
  - Or use `computer_hotkey(app: "WhatsApp", key: "Ctrl+N")` to start a new chat.
  - Alternatively, view the saved screenshot file and click directly using `computer_click(app: "WhatsApp", x: <x>, y: <y>)`.
  - Type messages using `computer_type_text` or `computer_paste_text`, then press Enter with `computer_press_key(app: "WhatsApp", key: "Return")`.
  - **NEVER attempt to write PowerShell or OCR scripts in the terminal to interact with WhatsApp.**

- **Web Browsers (Chrome, Edge, Brave)**:
  - Use `computer_hotkey(app: "<browser>", key: "Ctrl+L")` to focus the address bar.
  - Set URL with `computer_type_text` or `computer_paste_text`, followed by `computer_press_key(key: "Return")`.
  - Use `Tab` / `Shift+Tab` to navigate interactive controls.

- **Window Focus**:
  - Always call `computer_get_app_state(app: "<app>", restoreWindow: true)` to ensure the window is unminimized and frontmost before interacting.
