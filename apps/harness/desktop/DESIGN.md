---
version: alpha
name: Const Harness Design System
description: Master design language and interface architecture for Const Harness — the local-first agent workbench and developer studio. Built on an austere studio monochrome palette (#161616 canvas, #2b2b2b sidebar & input fields, #222222 project headers, #d4d4d4 crisp interface ink, #5d5d5d secondary elements, and #969696 utility chips). Zero drop shadows, pure fill elevation, hairline boundaries, 16px/24px geometry, with an integrated 1-line prompt input architecture.

colors:
  canvas: "#161616"
  sidebar: "#2b2b2b"
  header-strip: "#222222"
  field: "#2b2b2b"
  field-hover: "#383838"
  chip-bg: "#1b1b1b"
  chip-hover: "#252528"
  ink: "#d4d4d4"
  ink-bright: "#ffffff"
  text-muted: "#969696"
  text-faint: "#5d5d5d"
  hairline: "#383838"
  hairline-chip: "#2e2e2e"
  accent: "#0066ff"

typography:
  display:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.01em
  title:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
    fontSize: 14px
    fontWeight: 450
    lineHeight: 1.43
    letterSpacing: 0
  body-sm:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.38
    letterSpacing: 0
  label:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0
  caption:
    fontFamily: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0.02em

rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

components:
  chat-card:
    outerBackground: "{colors.header-strip}"
    outerBorder: "{colors.hairline}"
    outerRounded: "{rounded.lg}"
    headerPadding: "8px 14px 6px"
    inputBackground: "{colors.field}"
    inputBorder: "{colors.hairline}"
    inputRounded: "{rounded.lg}"
    inputPadding: "10px 14px"
    inputHeight: "28px"
    fontSize: "14px"
    textColor: "{colors.ink}"
    placeholderColor: "{colors.text-faint}"

  action-chip:
    backgroundColor: "{colors.chip-bg}"
    hoverBackground: "{colors.chip-hover}"
    borderColor: "{colors.hairline-chip}"
    textColor: "{colors.text-muted}"
    hoverTextColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    fontSize: "12px"

  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.ink}"
    iconColor: "{colors.ink}"
    secondaryTextColor: "{colors.text-muted}"
    hoverBackground: "{colors.field-hover}"
    width: "256px"

  top-toolbar:
    height: "44px"
    iconColor: "{colors.ink}"
    iconHoverColor: "{colors.ink-bright}"
    hoverBackground: "{colors.header-strip}"

---

## Overview

**Const Harness** is a high-performance local AI agent workbench and developer studio. Designed to disappear behind the agent tasks and codebases it orchestrates, its aesthetic is disciplined, dark-calibrated studio monochrome.

Unlike the marketing surfaces of Const Web (which balance light canvas with dark ink), Harness is built around an intentional dark IDE paradigm:
- **Canvas Base (`#161616`)**: Deep, low-fatigue workspace canvas.
- **Sidebar & Input Field (`#2b2b2b`)**: Tactile surfaces providing gentle structural contrast.
- **Attached Header Strip (`#222222`)**: Dark header well for project context.
- **Primary Ink (`#d4d4d4`)**: Crisp, glare-free interface text and icons rendered bright by default.
- **Faint Accent & Placeholders (`#5d5d5d`)**: De-emphasized secondary chrome and input hints.
- **Action Chips (`#969696`)**: Intermediate utility text.

Structure is achieved entirely through **fill variation and razor-sharp 1px hairlines**. Drop shadows are completely prohibited.

---

## Colors

### Primary Palette

| Token | Hex | Role & Usage |
|:---|:---|:---|
| `canvas` | `#161616` | Main workbench canvas background. Sits behind the watermark logo, greeting, and floating card. |
| `sidebar` | `#2b2b2b` | Sidebar panel background. Extends full height on the left; exposed at the curved canvas seam. |
| `header-strip` | `#222222` | Attached top header strip for the project selector (`Outside Project ⌵`). |
| `field` | `#2b2b2b` | AI prompt input container fill. Perfectly balanced against the `#161616` canvas. |
| `ink` | `#d4d4d4` | Primary interface ink: headings, input text, toolbar icons, and sidebar navigation items by default. |
| `ink-bright` | `#ffffff` | Hover state highlight for interactive items and buttons. |
| `text-muted` | `#969696` | Quick action chips text (`PPT Creation`, `Error Fix`), keyboard shortcuts (`Ctrl+N`), section headers. |
| `text-faint` | `#5d5d5d` | Input placeholder text, folder chevron indicators, and de-emphasized secondary glyphs. |
| `hairline` | `#383838` | Structural 1px boundary lines around the chat card and input box. |
| `hairline-chip` | `#2e2e2e` | Hairline border for standalone action pill chips. |
| `accent` | `#0066ff` | Reserved high-priority signal (live agent executing, critical badge). |

### Elevation by Fill (Shadow-Free)

Elevation in Harness follows a flat neutral ladder:
1. **Level 0 (Canvas)**: `#161616`
2. **Level 1 (Header Well & Action Chips)**: `#222222` / `#1b1b1b`
3. **Level 2 (Sidebar & Input Box)**: `#2b2b2b`
4. **Level 3 (Hover States & Control Tracks)**: `#383838`

No drop shadows exist in the application.

---

## Typography

### Font Family
Harness exclusively utilizes **Inter** (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) for all interface utility, code references, toolbars, and prompt fields. Headings leverage natural sentence case without tracking distortion.

### Hierarchy

| Token | Size | Weight | Line Height | Usage |
|:---|:---|:---|:---|:---|
| `display` | 28px | 500 | 1.2 | Main studio greeting ("Morning, how can I help?") |
| `title` | 16px | 500 | 1.3 | Modal dialog headers, task titles |
| `body` | 14px | 450 | 1.43 | AI Chat prompt input text (`text-[14px] leading-5`) |
| `body-sm` | 13px | 450 | 1.38 | Project selector, model dropdown, change mode (`Ask before changes`) |
| `label` | 12px | 500 | 1.33 | Quick action chips, sidebar navigation links |
| `caption` | 11px | 500 | 1.33 | History section eyebrows, fine metadata, timestamps |

---

## Layout & Geometry

### Window & Canvas Architecture
- **Window Shell**: Bound to `100vw` by `100vh` with `bg-[#2b2b2b]`.
- **Sidebar**: Fixed 256px (`w-64`) on the left.
- **Main Canvas (`<main>`)**:
  - Touches top and right window boundaries completely (`rounded-r-none`).
  - Rounds **only** on the left boundary seam against the sidebar (`rounded-l-2xl sm:rounded-l-3xl`).
  - Boundary seam between sidebar and canvas carries an ultra-soft hairline `border-l border-[#333333]/40`.
- **Conversation Bounding Width**:
  - Bound to `max-w-2xl` (672px wide), strictly verified against studio reference measurements.

---

## Component Architecture

### 1. Chat Input Card (`ChatCard`)
The central interaction unit. Follows a unified top-header layout:
- **Outer Shell**:
  - Width: `w-full max-w-2xl` (672px).
  - Background: `#222222`.
  - Border: 1px `#383838`.
  - Corner Radius: 16px (`rounded-2xl`).
- **Attached Header Strip (Only at Top)**:
  - Background: `#222222`.
  - Sits exclusively at the top. There is **no** outer container padding on the left, right, or bottom.
  - Houses the project selector button: `📁 Outside Project ⌵`.
- **AI Input Box**:
  - Position: Flush with the outer card edges on left, right, and bottom (`w-[calc(100%+2px)] -mx-[1px] -mb-[1px]`).
  - Corner Radius: `rounded-2xl` on **all four corners** (top-left, top-right, bottom-left, bottom-right). The top curves cut gracefully into the `#222222` header.
  - Background: `#2b2b2b`.
  - Border: 1px `#383838`.
  - Textarea: Compact 1-line height at rest (`rows={1}`, min-height 24px), font size `14px` (`leading-5`), color `#d4d4d4`, placeholder `#5d5d5d`.
  - Auto-Growing ScrollArea: Textarea auto-expands in height smoothly as text grows, up to `max-h-52` (208px).
  - Custom Scrollbar: When text exceeds `max-h-52`, scrolling is managed strictly by `@packages/ui/src/components/ui/scroll-area.tsx` with zero native browser scrollbars. The thumb uses `#48484e` (hovering to `#5d5d5d`), seamlessly blending with the studio dark palette.
  - Action Toolbar (Bottom Row):
    - Left: Context addition (`+`) and mode selector (`✋ Ask before changes ⌵` / `🛡️ Full access ⌵`).
    - Right: Model selector (`Manage model ⌵`) and squircle send button (`w-7 h-7 rounded-lg bg-[#48484e] text-[#d4d4d4]`).
  - Dropdown Systems:
    - **Choose Project Dropdown**: Defaults to `Outside Project`. Zero dummy workspaces. Popover provides real opened folder workspaces (with search filter), `Open folder` (system directory picker), and `Work outside a project`.
    - **Access Mode Selector**: Strictly 2 items: `Ask before changes` (`✋`, "Ask before file changes.") and `Full access` (`🛡️!`, `#ff7a00`, "Run with fewer confirmations."). When `Full access` is selected, the toolbar trigger button activates vibrant orange styling (`#ff7a00`).
    - **Model Selector Dropdown**: Defaults to `Manage model` (since no models are configured yet). Clean popover showing empty state with `Manage models` action (zero dummy providers or submenus).

### 2. Frameless Window Header & Window Controls
- **Frameless Shell**: Electron BrowserWindow configured with `frame: false`.
- **Draggable Header Region**: Window dragging enabled across empty header regions (`-webkit-app-region: drag`), with `-webkit-app-region: no-drag` strictly enforced on all interactive buttons.
- **Window Controls**:
  - Minimize (`-` / `Minus` icon)
  - Maximize / Restore (`□` / `Square` or `❐` / `Copy` icon reflecting window state)
  - Close (`✕` / `X` icon with Windows-native red hover `#e81123`)

### 3. Quick Action Chips
- Sits centered directly beneath the chat card with `mt-3 gap-2`.
- Items: `Weekly Summary` (`AlarmClock`), `Error Fix` (`Bug`), `PPT Creation` (`Presentation`), `Idle-time task` (`Moon`).
- Pill geometry: 12px radius (`rounded-xl`), background `#1b1b1b`, border 1px `#2e2e2e`.
- Typography: 12px (`text-[12px]`), color `#969696`, hover to `#d4d4d4` with `#252528` background.

### 4. Studio Sidebar
- Background `#2b2b2b`, full height.
- All icons and menu labels render in `#d4d4d4` **by default** (not dimmed to dark gray).
- Hovering an item lifts it to pure white (`text-white`) with a soft `#383838` pill background.
- Preserved Account Settings dropdown at the base with user avatar, name (`#d4d4d4`), and email (`#969696`).

### 5. Watermark Studio Logo
- Positioned above and behind the greeting text (`absolute -top-36 sm:-top-44 left-1/2 -translate-x-1/2`).
- Renders with 20%–25% opacity in `#d4d4d4`.
- Masked with a vertical gradient fade: `linear-gradient(to bottom, rgba(0,0,0,1) 15%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0) 90%)`.
- Light gaussian blur (`blur(0.75px)`) so it recedes into the `#161616` background without competing with interface text.

---

## Do's and Don'ts

### Do
- Maintain the exact palette: `#161616` for canvas, `#2b2b2b` for sidebar and input, `#222222` for top header, `#d4d4d4` for primary text.
- Render all sidebar icons and text in `#d4d4d4` by default; use hover only for bright `#ffffff` highlights.
- Keep the AI input box strictly 1-line height at rest with 14px font size.
- Ensure the AI input box is rounded on top-left and top-right corners (`rounded-2xl`) while staying flush on the left, right, and bottom.
- Anchor the watermark logo directly to the greeting container so it scales predictably on all display sizes.

### Don't
- Don't add drop shadows anywhere (`shadow-md`, `shadow-xl`, `shadow-2xl` are strictly forbidden).
- Don't wrap the AI input box in an outer card that adds padding to the left, right, or bottom.
- Don't dim primary sidebar icons to `#5d5d5d` at rest.
- Don't widen the conversation container beyond `max-w-2xl` (672px).
- Don't introduce saturated accent colors (purples, greens, yellows) for chrome or borders.
