---
version: beta
name: Const Design System
description: Master design language and interface architecture for the Const Studio Platform (Const Harness & Const Learn) — local-first AI workspaces and developer studios. Built on an austere studio monochrome palette (#161616 canvas, #2b2b2b sidebar & input fields, #222222 card headers, #ffffff crisp white reading ink, #d4d4d4 secondary interface ink, and #969696 utility chips). Seamless borderless panels, hairline boundaries, 16px/24px geometry, pure sans-serif UI typography, and high-contrast readable markdown.

colors:
  canvas: "#161616"
  sidebar: "#2b2b2b"
  header-strip: "#222222"
  field: "#2b2b2b"
  field-hover: "#383838"
  chip-bg: "#1b1b1b"
  chip-hover: "#252528"
  ink-bright: "#ffffff"
  ink: "#d4d4d4"
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
    textColor: "{colors.ink-bright}"
    placeholderColor: "{colors.text-faint}"

  action-chip:
    backgroundColor: "{colors.chip-bg}"
    hoverBackground: "{colors.chip-hover}"
    borderColor: "{colors.hairline-chip}"
    textColor: "{colors.text-muted}"
    hoverTextColor: "{colors.ink-bright}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    fontSize: "12px"

  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.ink}"
    iconColor: "{colors.ink}"
    secondaryTextColor: "{colors.text-muted}"
    hoverBackground: "{colors.field-hover}"
    width: "224px"

  top-toolbar:
    height: "44px"
    iconColor: "{colors.ink}"
    iconHoverColor: "{colors.ink-bright}"
    hoverBackground: "{colors.header-strip}"

---

## Overview

**Const Design System** is the unified design language and interface architecture for the Const Platform Ecosystem — encompassing **Const Harness** (local-first agent developer studio) and **Const Learn** (local-first Socratic AI learning studio). Built for deep focus, long-form work, and zero visual friction, its aesthetic is disciplined, dark-calibrated studio monochrome.

The interface prioritizes **clarity, reading comfort, and zero visual noise**:
- **Canvas Base (`#161616`)**: Deep, low-fatigue workspace canvas.
- **Card Panels & Sidebar (`#2b2b2b`)**: Tactile surfaces providing gentle structural contrast.
- **Crisp Reading Ink (`#ffffff`)**: Primary reading text (AI output paragraphs, headings, active chip text, interactive buttons) must be pure bright white in dark mode for maximum legibility.
- **Secondary Ink (`#d4d4d4`)**: Chrome labels, secondary icons, and subtle interface text.
- **Faint Accent & Placeholders (`#5d5d5d`)**: De-emphasized input hints and folder glyphs.
- **Action Chips (`#969696` / `#ffffff`)**: Interactive utility controls.
- **Seamless Paneling**: Panel headers have **no dividing border lines** (`border-b`). Elevation is achieved strictly through fill variations and hairline boundaries.

---

## Colors

### Primary Palette

| Token | Hex | Role & Usage |
|:---|:---|:---|
| `canvas` | `#161616` | Main workbench canvas background. |
| `sidebar` | `#2b2b2b` | Sidebar panel background. |
| `header-strip` | `#222222` | Attached top header strip for card containers. |
| `field` | `#2b2b2b` | AI prompt input container fill and floating panel background. |
| `ink-bright` | `#ffffff` | **Primary text for reading**: AI markdown responses, headings, active chip text, and interactive buttons. |
| `ink` | `#d4d4d4` | Secondary interface text: unhovered toolbar icons, sidebar links, and subtle chrome. |
| `text-muted` | `#969696` | Timestamps, file size metadata, keyboard hints (`Ctrl+N`). |
| `text-faint` | `#5d5d5d` | Input placeholder text and inactive chevrons. |
| `hairline` | `#383838` | Structural 1px boundary lines around floating cards and dialogs. |
| `hairline-chip` | `#2e2e2e` | Hairline border for standalone pill buttons and toolbar controls. |
| `accent` | `#0066ff` | Reserved high-priority signal (live agent executing, active focus ring). |

### Elevation by Fill (Zero Drop Shadows)

Structure in Const is established purely through fill variation:
1. **Level 0 (Canvas)**: `#161616`
2. **Level 1 (Card Headers & Action Chips)**: `#222222` / `#1b1b1b`
3. **Level 2 (Panels, Sidebar & Input Box)**: `#2b2b2b`
4. **Level 3 (Hover States & Control Tracks)**: `#383838`

Drop shadows on internal cards are strictly prohibited.

---

## Typography & Contrast Rules

### 1. Pure Sans-serif Interface Typography (`font-sans`)
- **Strict Rule**: All UI controls, buttons, dropdown triggers, pills, chips, navigation items, and message body text MUST use standard sans-serif (`font-sans` / `Inter`, `-apple-system`, `sans-serif`).
- **Monospace Usage**: `font-mono` is strictly **prohibited** on interface chrome (e.g., do NOT use `font-mono` on `Default Workspace`, `0 sources`, history badges, or list numbering).
- `font-mono` is reserved **exclusively** for:
  - Fenced code blocks (`<pre><code>`)
  - Terminal outputs and `$ command` lines
  - Raw filesystem paths inside code contexts

### 2. High-Contrast Reading Ink (`dark:text-white` / `#ffffff`)
- In dark mode, do **not** render AI response paragraphs, headings, or list items in muted gray (`#d4d4d4` or `text-foreground/90`).
- Always apply crisp white (`dark:text-white` / `#ffffff`) for:
  - AI markdown paragraphs (`<p>`), headings (`<h1>`–`<h4>`), and list items (`<li>`)
  - Bold / strong text (`<strong>`, `<b>`)
  - Active top toolbar pills (`Default Workspace`, `0 sources ⌵`)
  - Active toolbar icons (`MessageCirclePlus`, `History`, `MoreVertical`)
- Secondary muted colors (`#969696` / `text-muted-foreground`) are reserved for metadata like timestamps (`10:45 AM`) or file sizes (`1.2 MB`).

---

## Workspace & Header Architecture

### 1. Seamless Borderless Headers
- Inside floating cards and panels (such as the Central Chat Panel, Sources Panel, Studio Panel, and File Explorer), the top toolbar must **never** have a bottom border divider (`border-b border-border`).
- The header sits seamlessly atop the content area without any dividing line (`h-12 px-4 sm:px-5 flex items-center justify-between shrink-0 select-none`).
- Content scrolls naturally beneath the header without arbitrary horizontal lines.

### 2. Panel Geometry & Layout
- **Studio Sidebar**: Fixed 224px (`w-56`), `#2b2b2b`.
- **Floating Cards**: 16px/24px geometry (`rounded-2xl`).
- **Multi-column Layouts**: Floating studio columns (Sources, Central Chat, and Studio/Tools) sit on the `#161616` canvas with hairline boundaries.

---

## Iconography & Empty States

### 1. Lucide Vector Icons over Emojis
- **Never** use raw emojis (e.g., 🎨, 📁, 🚀, ✋, 🛡️) as the icon for empty state containers, system navigation tabs, toolbar actions, or dropdown items.
- Always use clean, single-color Lucide vector icons (`w-5 h-5` or `w-6 h-6`) centered in a subtle rounded squircle container (`rounded-2xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838]`).

### 2. Feature & Tab Icon Alignment
- **Artifacts**: Represented strictly by `Layers` (`lucide-react`).
  - Do **not** use `Sparkles` for Artifacts (`Sparkles` is reserved strictly for Generative AI / Chat actions).
  - Empty states in the Artifacts tab must use the matching `Layers` icon.
- **Sources / Files**: `FileText`
- **Workspaces / Folders**: `Folder`
- **Terminal / Execution**: `SquareTerminal` / `Terminal`
- **Settings / Account**: `Settings` / `User`

---

## Do's and Don'ts

### Do
- **Do** use `font-sans` (`Inter`) for all button labels, pills, dropdowns, and counter badges.
- **Do** render AI response text and active header pills in crisp `#ffffff` (`dark:text-white`) for crystal-clear readability.
- **Do** keep panel headers seamless and borderless — remove all `border-b` lines separating headers from content.
- **Do** use `Layers` for the Artifacts tab and empty states.
- **Do** wrap empty state icons in minimalist rounded squircles (`rounded-2xl`).
- **Do** maintain the exact palette: `#161616` for canvas, `#2b2b2b` for sidebar and input, `#222222` for top header, `#ffffff` for primary reading text.

### Don't
- **Don't** apply `font-mono` to UI buttons, project selectors, sources pills, or list numbers.
- **Don't** use muddy or dim gray (`#969696` or `text-foreground/90`) for primary AI reading copy.
- **Don't** add horizontal dividing lines (`border-b`) under the top header of workspace panels.
- **Don't** use `Sparkles` for Artifacts or non-AI feature tabs.
- **Don't** use emojis as interface icons or empty state visual representations.
- **Don't** use heavy drop shadows (`shadow-md`, `shadow-xl`) on workspace panels.
