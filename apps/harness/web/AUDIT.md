# Landing page audit — 25 October 2026

The in-progress landing page lives in `apps/harness/web`. The desktop app in
`apps/harness/desktop` is the source of product facts; its runtime was not changed.
The user's screenshots and the live MiniMax about page are visual references.

## Reference mapping

| Order | Requested reference | Implemented correction |
| --- | --- | --- |
| 1 | MiniMax navbar and hero | Full-width fixed navigation, blue reference background, product wordmark, download CTA, platform shortcuts, and a Harness workbench illustration. Header changes surface after scrolling. |
| 2 | Learn screenshot 1 | Large, left-aligned statement across the wide page container, with generous vertical whitespace. |
| 3 | MiniMax screenshot 2 | Four selectable task scenarios; active description on the left and the matching reference image on the right. Keyboard arrow/Home/End navigation included. |
| 4 | MiniMax screenshot 3, Learn screenshot 4 layout | Five capability rows, all copy left and media right: plugins, native computer use, browser, creative media, terminal. Added the missing video/media reference asset. |
| 5 | MiniMax use-anywhere | Three illustrated surfaces with actions: desktop, built-in terminal, and local scheduled tasks. |
| 6 | Comparison | Three-column descriptive comparison of Harness and a chat-only workflow. Removed unsupported, undated scores for specific competitors. |
| 7 | MiniMax get-started | Three adjacent plan-style panels for desktop, own provider, and Const Router. No invented subscription prices. |
| 8 | Learn screenshot 5 | Reuses Learn's original WebGL particle shader and CTA parameters, with the same container width, 54 px desktop heading, content inset, vertical padding, and button sizing. |
| 9 | MiniMax FAQ | Collapsed question list with separators and expansion controls. Topics adapted to Harness, including skills/plugins and schedules. |
| 10 | Learn footer | Six link columns, language/theme controls, GitHub link, and oversized Const Harness wordmark. Removed placeholder legal/status claims. |

## Product facts checked in source

- `desktop/src/App.tsx`: the workbench is behind the Const Accounts sign-in.
  Removed the old claim that no account is required.
- `packages/agent/src/const/const-agent.ts`: review, ask-before-changes, and
  full-access modes have different approval behavior. In-workspace file edits can
  proceed in ask-before-changes mode. Removed the absolute claim that every edit
  requires approval.
- `desktop/electron/database.ts` and conversation IPC handlers in
  `desktop/electron/main.ts`: local conversation storage. FAQ also explains that
  prompts/context and tool data can reach configured services.
- `desktop/electron/scheduled-tasks.ts`: local recurring schedules and run
  history; the app and computer must remain running.
- `desktop/src/lib/models-config.ts`: configurable model/provider protocols,
  image, video, and speech categories. Creative workflows depend on configuration.
- `desktop/electron/main.ts`, browser controller, and `desktop/native`:
  real browser/computer-use tools, background work, and subagent control.
- `cli/src/index.ts`: standalone CLI only prints initialization text. Removed
  claims of a production terminal agent with pipes/structured output.
- `desktop/package.json`: Windows/macOS/Linux packaging. Download buttons now
  lead to a build-selection route that reads actual recent GitHub release assets.
  Missing releases or an unavailable API show source/release options instead of
  guessed installer URLs.
- No mobile remote-control implementation was found in the desktop app. The
  reference's mobile/remote claims were adapted to existing local capabilities.

## Smooth scrolling

Uses GSAP 3.15.0 ScrollSmoother, matching Learn's `smooth: 0.6` and nested-scroll
normalization. Navbar remains outside transformed content. Hash clicks, initial
deep links, and browser history honor the header offset. ResizeObserver refreshes
after images, FAQ changes, or locale changes. Listeners and GSAP instances are
cleaned up. Touch and reduced-motion users retain native scrolling.

The download backdrop now uses the original Learn WebGL renderer, rather than a
Canvas 2D approximation. It keeps the source camera, simulation, particle shape,
noise, and pointer response. Parameters match the Learn CTA: ring widths 0.15/0.05,
displacement 0.23, density 220, and particle scale 0.65. React owns one animation
loop, pauses offscreen or in a hidden tab, and disposes GPU resources on unmount.
Reduced-motion users see a settled static frame of the same renderer.

## Asset provenance

Reference page: https://agent.minimax.io/about

Base for existing reference assets:
`https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/agent-archon/download/2026-09-25/`

- `hero-poster.webp`
- `task-presentation.png` ← `ppt-en.png`
- `task-analysis.png` ← `finance-en.png`
- `task-website.png` ← `website-en.png`
- `task-coding.png` ← `coding-en.png`
- `capability-plugins.png` ← `plugin-en.png`
- `capability-browser.png` ← `browser-en.png`
- `capability-terminal.png` ← `terminal-en.png`
- Added `capability-video.png` from
  https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/bb35ace7-9eba-4947-a07c-b79d3a6977fd.png

These are temporary reference assets as requested, and still contain MiniMax
imagery. The hero uses an explicitly labeled Harness product illustration instead
of presenting the old Const Learn screenshot as a Harness screenshot.

## Verification

- Harness web typecheck and production build.
- Harness desktop typecheck.
- Browser review of light/dark appearance, task switching, navigation anchors,
  FAQ expansion, language switching, and download fallback.
- Responsive browser inspection at 390 px and desktop width.
- English, Indonesian, Japanese, Chinese, and Spanish copy; no horizontal page
  overflow observed while switching locales on the mobile download page.
- One-off release-parser assertions: OS/architecture detection, duplicate release
  assets, rejection of unrelated/external URLs, draft/prerelease exclusion, and
  API/network failure fallback.
- Browser environment requests reduced motion; native fallback and static
  particles were confirmed. GSAP's motion path uses the same package/version and
  settings as Learn; it was not visually exercised under no-preference here.
