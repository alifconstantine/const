---
version: beta
name: Const Design System
description: Master design language and interface architecture for the Const Studio Platform (Const Harness & Const Learn) — local-first AI workspaces and developer studios. Built on an austere studio monochrome palette (#161616 canvas, #2b2b2b sidebar & input fields, #222222 card headers, #ffffff crisp white reading ink, #d4d4d4 secondary interface ink, and #969696 utility chips). Seamless borderless panels, zero divider lines, mandatory Radix ScrollArea, hairline boundaries, 16px/24px geometry, pure sans-serif UI typography, and high-contrast readable markdown.

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
- **Seamless Paneling & Zero Divider Lines**: Panel headers, dropdowns, and popovers have **no dividing border lines** (no `border-b`, `border-t`, or `divide-y`). Elevation is achieved strictly through fill variations and hairline boundaries.
- **Custom Radix ScrollArea**: Native browser scrollbars are prohibited; all scrollable views use `@const/ui`'s `ScrollArea`.

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

### 1. Seamless Borderless Surfaces & Zero Divider Lines
- Inside floating cards, panels, popovers, and dropdown menus (such as the Central Chat Panel, Sources Panel, Studio Panel, File Explorer, and Carried Sources popovers), sections must **never** have arbitrary dividing borders (`border-b`, `border-t`, `divide-y`).
- The top toolbar sits seamlessly atop the content area without any dividing line (`h-12 px-4 sm:px-5 flex items-center justify-between shrink-0 select-none`).
- Inside dropdowns and popovers, headers and footer action buttons must flow naturally with padding/margins instead of harsh horizontal lines (`border-b` / `border-t`).
- Content flows and scrolls naturally beneath headers without decorative or structural partition lines. Elevation and grouping are established strictly through fill variations (Level 0–3) and breathing room.

### 2. Mandatory ScrollArea for All Scrollable Containers
- **Strict Rule**: Raw browser scrollbars via native `overflow-y-auto` or `overflow-x-auto` are strictly **prohibited** on desktop interfaces (to prevent Windows' default boxy, white-tracked scrollbars with up/down arrows).
- All scrollable viewports, lists, popover menus, dialog bodies, and sidebars MUST use the custom `ScrollArea` component (`@const/ui` / `packages/ui/src/components/ui/scroll-area.tsx`).
- `ScrollArea` automatically hides native browser scrollbars (`[scrollbar-width:none]` and `[&::-webkit-scrollbar]:hidden`) and renders minimalist, dark-calibrated Radix thumbs with smooth interaction.

### 3. Panel Geometry & Layout
- **Studio Sidebar**: Fixed 224px (`w-56`), `#2b2b2b`.
- **Floating Cards**: 16px/24px geometry (`rounded-2xl`).
- **Multi-column Layouts**: Floating studio columns (Sources, Central Chat, and Studio/Tools) sit on the `#161616` canvas with hairline boundaries.

### 4. Zero Default Browser Focus Outlines / Yellow Accent Rings on Dialogs & Cards
- **Strict Rule**: All modal dialogs, alert dialogs, popovers, and floating sheets MUST have `outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0` applied on their content containers (`DialogPrimitive.Content`, `AlertDialogPrimitive.Content`).
- **Prohibited**: Default browser/OS focus outlines (e.g., Chromium's 2px yellow/gold/amber focus outline on Windows when clicking or focusing `DialogPrimitive.Content`) are strictly **prohibited**.
- Focus indicators must never encompass an entire modal container or card. Focus states are reserved strictly for internal interactive elements (inputs, textareas, active buttons) with subtle, customized studio styling.

---

## Studio Tools Card Color Palette

Studio tool cards (`StudioPanel`) feature distinctive, muted dark-calibrated colors for fast visual identification:
- **Audio Summary**: Indigo (`dark:bg-[#21232d]`, `dark:border-[#303444]`, `dark:text-[#a5b4fc]`)
- **Slides**: Amber (`dark:bg-[#2b291d]`, `dark:border-[#3e3b2a]`, `dark:text-[#fde047]`)
- **Video Summary**: Emerald (`dark:bg-[#1d2820]`, `dark:border-[#2b3d30]`, `dark:text-[#86efac]`)
- **Mind Map**: Pink (`dark:bg-[#2e212b]`, `dark:border-[#422f3e]`, `dark:text-[#f472b6]`)
- **Study Report**: Warm Sand / Stone (`dark:bg-[#29281e]`, `dark:border-[#3c3a2b]`, `dark:text-[#dedac2]`)
- **Quiz**: Teal (`dark:bg-[#1c2628]`, `dark:border-[#29383c]`, `dark:text-[#5eead4]`)
- **Infographic**: Purple (`dark:bg-[#28202d]`, `dark:border-[#3a2d42]`, `dark:text-[#c084fc]`)
- **Data Table**: Sky (`dark:bg-[#1a252f]`, `dark:border-[#263746]`, `dark:text-[#38bdf8]`)
- **Browser**: Blue (`dark:bg-[#172133]`, `dark:border-[#22334f]`, `dark:text-[#60a5fa]`)

---

## Minimal Browser Chrome & Human-in-the-Loop Architecture

### 1. Minimal Browser Chrome (Zero Mode Friction)
- **Elimination of "AI Pilot" / "You Drive" Mode Friction**: The browser tab functions as a natural, fluid viewport. Artificial takeover buttons, "AI Pilot" pulsing pills, and "You Drive" mode states in the toolbar are strictly eliminated.
- **Always-Interactive Viewport**: The human user and the AI assistant share the viewport seamlessly. The user may click or inspect the page at any time without having to toggle a "Take over" mode.
- **Minimal Navigation Header**: The browser toolbar contains strictly:
  1. Navigation buttons: Back (`ChevronLeft`), Forward (`ChevronRight`), and Reload (`RotateCw`).
  2. Unified Address Bar: Shows current URL or accepts search queries (`#242424` fill, `#333333` hairline border, `font-sans` placeholder).
  3. Viewport Preset Selector: Mobile, Tablet, Desktop responsive testing presets (`MonitorSmartphone`).
  4. More Options: DevTools, copy link, zoom controls, and hard reload (`MoreHorizontal`).

### 2. Human-in-the-Loop Permission Banner Pattern
- **Single Source of Truth**: Human intervention is requested strictly via the tool `browser_request_help` (for CAPTCHAs, 2FA/OTP verification, Cloudflare checks, or sensitive authentication).
- **Non-Intrusive Amber Permission Banner**:
  - Activated strictly when `controlState.requested === true`.
  - Background: `#241508` (dark amber studio fill), hairline boundary `border-amber-500/40`.
  - Iconography: `ShieldAlert` in `amber-400` inside a rounded-lg container.
  - Contextual Message: Displays the assistant's stated reason (`controlState.reason || "Please complete manual verification on the page, then click Done."`).
  - Single Resolution Action: One prominent button: `"Done — Resume AI"` (`bg-amber-500 hover:bg-amber-400 text-black font-semibold`).
  - Clicking `"Done — Resume AI"` calls `window.electron.browser.releaseControl()`, clearing the banner and immediately resolving the agent's waiting promise so execution resumes seamlessly.
- **Prohibited UI Patterns**:
  - Modal blockers that cover the entire browser viewport (preventing the user from solving the CAPTCHA).
  - Floating password forms ("AI Requests Secret") that duplicate browser input fields. Users enter credentials directly into the webpage.
  - Persistent "You have control" banners that clutter the screen when no help is requested.

### 3. Zero Lingering Overlays & Elimination of Static "AI" Pointers
- **Strict Prohibition of Static "AI" Pointers or Badges**: The browser controller must never leave persistent blue dots, crosshairs, or badges labeled "AI" on the webpage after performing an action (such as `browser_click` or `browser_type`).
- **Complete DOM Cleanliness After Tool Calls**: Any transient visual cues (such as click ripples or element outlines) must be brief (under 350ms) and self-destructing. The controller must actively clean up and remove any overlay elements (`__const_ai_pointer`, `__const_ai_cursor_overlay`) in a `finally` block immediately upon tool completion.

---

## Multi-Turn Tool Continuity & Deduplication Protocol

### 1. Tool Call Serialization & Continuation Integrity
- **Full History Preservation**: When formatting chat history for the LLM during continuation turns ("continue", "lanjutkan", "next"), all previous tool calls (`tool_calls`) and their execution results (`role: "tool"`) must be serialized and preserved.
- **No Amnesia on Continue**: Never truncate assistant tool calls to `{ role: "assistant", content: "" }`. Doing so causes amnesia, where the model loses track of elements it clicked, URLs it visited, and data it inspected.
- **Continuation Directive**: When the user requests continuation, the agent must build upon prior results rather than restarting investigations from scratch.

### 2. Sequential Browser Execution & Deduplication
- **Sequential Calls (`parallel_tool_calls: false`)**: Web browser interactions change the live DOM synchronously. Models must execute browser actions sequentially rather than emitting multiple parallel actions in a single turn.
- **In-Turn Deduplication**: Filter out duplicate consecutive identical tool calls within the same turn (e.g., duplicate consecutive clicks on the same element ref or duplicate consecutive snapshots).
- **Single Help Request**: Never issue multiple `browser_request_help` calls in a single turn or loop. Once resolved, the agent immediately inspects the result and proceeds.

### 3. Synthesis Guarantee for Multi-Turn Tasks
- **Never Output Empty Assistant Cards**: If an agent completes multiple tool turns and the model outputs an empty text turn without tools, the system must prompt the model to synthesize a complete final answer rather than terminating with an empty chat card.

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
- **Do** keep panel headers, dropdowns, and popovers seamless and borderless — eliminate all dividing lines (`border-b`, `border-t`, `divide-y`).
- **Do** always use `ScrollArea` (`@const/ui` / `packages/ui/src/components/ui/scroll-area.tsx`) for all scrollable containers and popover lists instead of raw `overflow-y-auto`.
- **Do** always ensure dialog containers, popovers, and floating card wrappers have `outline-none focus:outline-none focus-visible:outline-none ring-0` to suppress unwanted OS/browser accent rings.
- **Do** use `Layers` for the Artifacts tab and empty states.
- **Do** wrap empty state icons in minimalist rounded squircles (`rounded-2xl`).
- **Do** maintain the exact palette: `#161616` for canvas, `#2b2b2b` for sidebar and input, `#222222` for top header, `#ffffff` for primary reading text.
- **Do** keep the browser chrome minimal and clean — toolbar contains only navigation, URL input, responsive presets, and options.
- **Do** display the amber Permission banner only when `browser_request_help` is actively waiting for human intervention.
- **Do** serialize both `tool_calls` and `role: "tool"` messages in full so "continue" retains complete memory of previous actions.

### Don't
- **Don't** apply `font-mono` to UI buttons, project selectors, sources pills, or list numbers.
- **Don't** use muddy or dim gray (`#969696` or `text-foreground/90`) for primary AI reading copy.
- **Don't** add horizontal dividing lines (`border-b`, `border-t`) under workspace headers or inside dropdown/popover menus.
- **Don't** use raw native `overflow-y-auto` or `overflow-x-auto` which exposes Windows' default boxy/arrow scrollbars. Always use `ScrollArea`.
- **Don't** allow default browser/OS focus rings (such as Chromium's 2px yellow/amber outline on Windows) to appear around modal dialogs, cards, or panels when clicked or opened.
- **Don't** use `Sparkles` for Artifacts or non-AI feature tabs.
- **Don't** use emojis as interface icons or empty state visual representations.
- **Don't** use heavy drop shadows (`shadow-md`, `shadow-xl`) on workspace panels.
- **Don't** display "AI Pilot", "You Drive", or "Take over" mode pills in the browser header.
- **Don't** truncate previous tool history into empty assistant strings when sending turns to the LLM.
- **Don't** leave persistent blue pointer dots, "AI" badges, or click overlays on the webpage DOM after tool calls.
