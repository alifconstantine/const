# Harness public pages

Scope: extend the existing Harness site with product, integrations, ecosystem, documentation, and draft legal pages. Persuade for product routes, Read for guides and policies. Keep the home page visual identity and existing image assets. Product claims come from the desktop implementation; no invented prices or available installers.

## Direction contract

THESIS: Explain the workbench with concrete workflows and leave generous reading space. Avoid turning every topic into an identical card.

OWN-WORLD: Existing Inter typography, theme-aware white/near-black surfaces, neutral ink, rounded media, simple inline links. Keep shared navigation and footer controls.

STORY: Visitors understand Harness, choose a relevant guide, and download or connect with a clear picture of model and remote data flows.

FIRST VIEWPORT: Left-aligned large heading and short description below the fixed header. Product routes lead into existing imagery or product rows. Docs use a quiet left sidebar and a readable article column; mobile wraps navigation above the content.

FORM: Code-led extension of the incumbent world, selected for the explicit minimalism brief. seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Existing assets are reused at their original paths without alteration. English editorial content is marked with lang=en; shared navigation keeps all five locales. Policy pages remain drafts/noindex until a monitored contact and retention policy are finalized.

## Completion — 2026-10-29

Finish review: SHIP, with no material findings; all ten final screenshots in `.impeccable/review/` were inspected. Documentation pass compared `content.css`, the shared content shell and footer against the incumbent marketing `globals.css` and `landing.css`, plus root, Harness, and desktop `DESIGN.md` references. The extension reuses Inter, the existing theme tokens, shared navigation and footer, rounded media, and focus treatment. Reading layouts add responsive prose widths and spacing without changing the homepage identity or image assets.

Existing `DESIGN.md` files and token sources are preserved. The documented studio palette and compact desktop type scale already differ from the public marketing palette and larger display scale; the detector reported the typography differences as advisory only. This pass records that existing scope difference without rewriting global design guidance or adding architecture documentation.

## Mobile refinement — 2026-10-29

Removed Changelog from the shared navbar. Mobile documentation and article contents use native disclosures so navigation no longer pushes reading content below the first viewport. Header/footer controls have 44px touch areas; comparison content stacks vertically on phones; download actions and code wrap within narrow screens. Native scrolling is used for small/coarse-pointer devices and GSAP is scoped to desktop with cleaned-up hash listeners. Below-fold task imagery loads lazily. Browser viewport checks cover 320, 390, and 768 CSS pixels; these are Chromium layout checks, not physical iOS/Android gesture tests.

Final mobile review: SHIP after correcting a download-page class collision that duplicated outer padding. All seven captures in `.impeccable/review/mobile-refinement/` were inspected. The independent reviewer hit a usage limit, so the final review and documentation comparison were completed directly. Existing DESIGN.md files and theme tokens remain unchanged; native disclosures and stacked comparison content are responsive adaptations. Production build/typecheck, 15 routes, and 449 internal links passed.
