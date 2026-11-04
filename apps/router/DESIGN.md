---
name: Const Router
description: Black and graphite API workspace with warm type and restrained champagne state.
colors:
  public-background: "#09090b"
  public-panel: "#121214"
  public-line: "#29292e"
  public-text: "#f4f1eb"
  public-muted: "#a3a3ab"
  champagne: "#cfbd9c"
  console-background: hsl(240 10% 3.5%)
  console-text: hsl(40 23% 94%)
  console-card: hsl(240 5% 7%)
  console-secondary: hsl(240 5% 11%)
  console-secondary-text: hsl(40 12% 89%)
  console-muted: hsl(240 5% 14%)
  console-muted-text: hsl(240 5% 66%)
  console-border: hsl(240 5% 17%)
  console-input: hsl(240 5% 21%)
  console-ring: hsl(38 35% 70%)
  console-primary-ink: hsl(240 10% 4%)
  console-destructive: hsl(0 63% 52%)
  sidebar-background: hsl(240 7% 5.5%)
  sidebar-active: hsl(35 8% 12%)
  chart-paid: "#94adbd"
  light-background: hsl(45 15% 97%)
  light-text: hsl(240 6% 10%)
  light-card: hsl(0 0% 100%)
  light-secondary: hsl(40 8% 93%)
  light-secondary-text: hsl(240 6% 15%)
  light-muted: hsl(40 6% 91%)
  light-muted-text: hsl(240 4% 41%)
  light-border: hsl(40 5% 84%)
  light-ring: hsl(35 24% 42%)
  light-highlight: "#78613e"
  light-sidebar: hsl(40 10% 94%)
  light-sidebar-text: hsl(240 4% 38%)
  light-sidebar-active: hsl(40 6% 88%)
  light-chart-free: "#817255"
  light-chart-paid: "#637c96"
  light-destructive: hsl(0 68% 45%)
typography:
  display:
    fontFamily: Manrope, sans-serif
    fontSize: clamp(3.25rem, 5.5vw, 5.25rem)
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: -0.04em
  headline:
    fontFamily: Manrope, sans-serif
    fontSize: clamp(2.4rem, 3.4vw, 3.25rem)
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: -0.035em
  console-title:
    fontFamily: Manrope, sans-serif
    fontSize: 1.875rem
    fontWeight: 600
    lineHeight: 2.25rem
    letterSpacing: -0.025em
  docs-title:
    fontFamily: Manrope, sans-serif
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.035em
  body:
    fontFamily: Manrope, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5rem
  label:
    fontFamily: Manrope, sans-serif
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1rem
rounded:
  public-control: 6px
  public-panel: 10px
  console-control: 0.75rem
  console-filter: calc(0.75rem - 2px)
  console-panel: 0.75rem
  field-default: 1rem
  badge: 9999px
spacing:
  "2": 0.5rem
  "3": 0.75rem
  "4": 1rem
  "5": 1.25rem
  "6": 1.5rem
  "7": 1.75rem
  "8": 2rem
components:
  public-button-primary:
    backgroundColor: "{colors.public-text}"
    textColor: "{colors.public-background}"
    rounded: "{rounded.public-control}"
    padding: 12px 21px
    height: 48px
  public-button-primary-hover:
    backgroundColor: "{colors.champagne}"
  console-button-primary:
    backgroundColor: "{colors.console-text}"
    textColor: "{colors.console-primary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.console-control}"
    height: 2.5rem
    padding: 0.5rem 1.25rem
  console-button-outline:
    backgroundColor: "{colors.console-background}"
    textColor: "{colors.console-text}"
    typography: "{typography.label}"
    rounded: "{rounded.console-control}"
    height: 2.5rem
    padding: 0.5rem 1.25rem
  catalog-search:
    backgroundColor: "{colors.console-card}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.field-default}"
    height: 2.5rem
    padding: 0.5rem 1rem 0.5rem 2.25rem
  console-panel:
    backgroundColor: "{colors.console-card}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.console-panel}"
    padding: 1.25rem
  category-selected:
    backgroundColor: "{colors.console-secondary}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.console-filter}"
    typography: "{typography.label}"
    padding: 0.5rem 0.75rem
---

# Design System: Const Router

## Overview

**Creative North Star: "The Working Gateway"**

Router uses a black and graphite foundation, warm white text, and restrained champagne emphasis. Manrope carries the public site and working console through the app’s self-hosted next/font setup. The existing Const mark and desktop particle backdrop remain the identity assets.

The finished interface uses open sections, fine dividers, and quiet bordered work areas. Density follows the task: broad public sections, compact console controls, and a narrower documentation reading column. Console preferences retain a light theme; the public site and documentation keep their scoped dark palette.

**Key Characteristics:**

- Warm type on black and graphite surfaces.
- Champagne for selection, focus, and highlighted technical values.
- Manrope throughout the shared shell and public headings.
- Dividers and tonal layering rather than decorative surface shadows.

This is a source-derived record of the finished build, not an independent claim of user-approved naming. Scope: Router only. Sources: `src/app/globals.css`, `src/app/landing.css`, root layout, dashboard shell/sidebar, and the finished dashboard pages. Existing repository logo and particle JavaScript are reused; no new shipping raster assets were created. Review captures are QA artifacts, not shipped imagery.

## Colors

### Primary

Champagne is a restrained interaction and information accent. Public primary actions begin in warm white and become champagne on hover. Console primary actions use the semantic foreground as their fill, with contrasting dark ink. Usage charts use restrained semantic accents; paid cost uses a muted blue-gray.

### Neutral

Public black supplies the canvas, graphite the integration panels, warm white the main ink, muted gray the supporting copy, and the public line tone the dividers. Console neutrals are HSL custom properties with separate dark and light definitions. Frontmatter values preserve those source formats rather than approximating console colors as public hex colors.

Light-theme canvas, card, text, muted, border, ring, sidebar, and chart tokens reflect the existing preference-controlled console. Destructive actions use their semantic red rather than the selection accent.

**The Scope Rule.** Keep the public hex palette scoped to public and documentation surfaces; console components follow the active semantic theme.

## Typography

**Display Font:** Manrope, sans-serif.
**Body Font:** Manrope, sans-serif.

The root layout loads Manrope through `next/font/google` into `--font-router`; app CSS maps `--font-sans` to that variable. Display text is medium weight with tight tracking; working screens use small, conventional labels and semibold page titles.

### Hierarchy

- **Display:** frontmatter display role, used by the desktop landing headline. Below 768px it changes to `clamp(3rem, 12.4vw, 4.6rem)`, line-height 1.07, tracking −0.035em.
- **Headline:** frontmatter headline role, used by public section headings. Mobile uses 2.05rem, line-height 1.17, tracking −0.03em.
- **Console title:** frontmatter console-title role. Settings and the Playground introduction use 1.5rem below the small breakpoint and grow to 1.875rem.
- **Docs title:** frontmatter docs-title role, reduced to 32px on mobile. Documentation section titles use 24px, medium weight, line-height 1.3.
- **Body:** console text commonly uses 14px with 24px leading; documentation prose uses 13px with 1.9 leading and a maximum 72ch measure. Public introductions use 14–15px with generous leading.
- **Label:** 12px working controls; the sidebar uses 13px items and 11px group labels. Smaller metadata stays attached to the related technical content.

Console code uses the framework’s monospace utility where applied. The public CSS references `--font-mono`, but this app does not define it; no custom mono face is recorded as a normative token.

**The Shared Voice Rule.** Use the Router Manrope alias for interface text and headings. Keep tabular numerals on prices, balances, and usage.

## Layout

Public content is centered within a maximum 1280px container, with 56px horizontal padding, reduced to 32px at 1050px and 24px below 768px. Main public sections use 120px vertical padding, reduced to 70px on mobile. The desktop hero pairs copy and an integration sample in a 1.05fr / 1fr grid; mobile stacks copy and connection details, hides the desktop integration panel, and removes the particle backdrop. These are observed landing behaviors, not a composition requirement for every screen.

The console uses a full-height viewport shell with an expanded 236px navigation rail or a collapsed 72px rail. Below the medium breakpoint the rail becomes a left sheet, at most 300px wide and constrained by viewport width. The toolbar is 64px high. Main content uses `2rem clamp(1rem, 3.5vw, 3.5rem) 3.5rem` padding; below 768px it uses `1.5rem 1rem 2.5rem`. Console controls have a 44px minimum height on mobile, except switches.

Documentation uses a maximum 1312px shell with a 240px topic column, 70px gap, and an 800px content column. Below 1050px the topic column is 210px with a 40px gap. Below 768px it becomes one column with a sticky topic selector. Desktop comparison tables become labeled mobile rows in both landing pricing and the console catalog; each rate remains associated with its unit.

## Elevation & Depth

Main work areas use tonal layering and one-pixel borders. Public integration panels and console data groups are flat at rest. The desktop hero retains the existing grayscale particle layer at 0.78 opacity, behind the content and outside pointer interaction. This backdrop is hidden for mobile and reduced motion. Overlay primitives retain their own shared-library behavior; this record does not replace it with a global no-shadow rule.

**The Quiet Surface Rule.** Use tonal steps and fine borders for resting work areas; the observed primary panels do not need a decorative shadow.

## Shapes

Public action controls have gently curved 6px corners and code panels have 10px corners, reduced to 8px on mobile. Console panels and common overridden controls use the app’s 0.75rem radius. The framework medium radius subtracts 2px from that base. Catalog search retains the shared input’s 1rem corners. Shared badges use fully rounded ends. There is no single forced radius for every component.

## Components

### Buttons

Public actions are solid, compact rectangles with a 48px minimum height, warm-white fill, black text, and champagne hover. The mobile form is 46px high. Public navigation actions use an outlined transparent treatment and a quiet darker hover. Console primary and outline buttons use semantic theme colors; working screens commonly override the shared pill radius with the app control radius. Shared buttons have a 200ms state transition, a 0.98 active scale, and disabled opacity of 0.5.

### Cards / Containers

Data groups are graphite or semantic card surfaces with fine borders and app panel corners. Overview panels commonly use 20px padding and 24px at the small breakpoint. Model and transaction lists divide rows within one shared container. The Playground composer uses the same card tone and panel radius, with a primary border at 60% opacity on focus within.

### Inputs / Fields

The catalog search is 40px high, uses a card fill, and leaves 36px of left inset for the search icon. The shared input border begins at 70% border opacity, strengthens on hover, and uses a subtle inset focus ring. Settings fields override to 44px height, app control corners, and the semantic background. Disabled fields retain their label and reduce opacity. Global keyboard focus is a 2px highlight outline with 3px offset; public surfaces use a 5px offset.

### Chips

Catalog categories are compact text controls with a secondary fill when selected. All models use prepaid credit; no free-tier tags or allowance tracks are displayed. Credit forms use the console input and button vocabulary, present the USD-to-IDR quote before the checkout action, and show pending, paid, failed, and expired payment states.

### Navigation

The console groups workspace, management, and account routes. Each item has a 40px minimum row, 13px type, app control corners, and a 16px outline icon. The active item uses the sidebar accent surface with foreground text and a highlight-colored icon. Public navigation is an 84px sticky header, reduced to 70px on mobile with an expandable menu. Documentation maintains its own 76px header, reduced to 70px on mobile.

### Integration panels

Code samples combine a tab toolbar, copy action, dark panel, and fine dividers. Selected tabs use champagne text and a bottom rule. Code content scrolls within the panel and uses 12px type with 1.95 leading on desktop; mobile samples use 10px with 1.9 leading.

Reduced-motion preferences disable public transitions and the hero backdrop; global animation and transition durations reduce to 0.01ms.

## Do's and Don'ts

### Do:

- **Do** preserve the Const mark, black public foundation, and existing desktop particle backdrop.
- **Do** retain visible keyboard focus and the reduced-motion behavior.
- **Do** pair mobile rates with their labels and units inside the available width.
- **Do** use semantic theme variables for console text, borders, fields, and controls.

### Don't:

- **Don't** add the desktop hero backdrop to mobile.
- **Don't** replace the Router font alias with the shared package’s Inter default.
- **Don't** force console light-theme controls into the public dark palette.
