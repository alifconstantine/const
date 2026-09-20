import type { SlideDeckData, SlideItem } from "../db";

export interface PresentationTheme {
  id: string;
  name: string;
  bg: string;
  slideBg: string;
  cardBg: string;
  cardBorder: string;
  ink: string;
  mutedInk: string;
  accent: string;
  accentMuted: string;
  isDark: boolean;
}

export const PRESENTATION_THEMES: Record<string, PresentationTheme> = {
  bold_dark: {
    id: "bold_dark",
    name: "Modern Tech (Deep Dark)",
    bg: "#06080F",
    slideBg: "#080C16",
    cardBg: "rgba(15, 23, 42, 0.75)",
    cardBorder: "rgba(255, 255, 255, 0.09)",
    ink: "#F8FAFC",
    mutedInk: "#94A3B8",
    accent: "#38BDF8",
    accentMuted: "rgba(56, 189, 248, 0.12)",
    isDark: true,
  },
  swiss_blue: {
    id: "swiss_blue",
    name: "Swiss International (Klein Blue)",
    bg: "#f2f2ef",
    slideBg: "#fafaf8",
    cardBg: "#ffffff",
    cardBorder: "#002FA7",
    ink: "#0a0a0a",
    mutedInk: "#525252",
    accent: "#002FA7",
    accentMuted: "rgba(0, 47, 167, 0.1)",
    isDark: false,
  },
  sea_indigo: {
    id: "sea_indigo",
    name: "Sea Indigo (Oceanic)",
    bg: "#060913",
    slideBg: "#0a0e1a",
    cardBg: "rgba(18, 26, 46, 0.8)",
    cardBorder: "rgba(90, 200, 250, 0.2)",
    ink: "#f5f5f7",
    mutedInk: "#8e9bb0",
    accent: "#5ac8fa",
    accentMuted: "rgba(90, 200, 250, 0.14)",
    isDark: true,
  },
  ash_lime: {
    id: "ash_lime",
    name: "Ash & Lime (Editorial)",
    bg: "#e7e5df",
    slideBg: "#f1efea",
    cardBg: "#ffffff",
    cardBorder: "#161616",
    ink: "#161616",
    mutedInk: "#666666",
    accent: "#84a300",
    accentMuted: "rgba(197, 232, 3, 0.3)",
    isDark: false,
  },
};

/**
 * Escapes HTML characters
 */
function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Renders the body content for an individual slide based on its layout and components
 */
function renderSlideContent(slide: SlideItem, theme: PresentationTheme, deckTitle: string): string {
  const layout = slide.layout || "bullets";

  // 1. HERO SLIDE
  if (layout === "hero" || slide.slideNumber === 1) {
    const kicker = slide.kicker || slide.accentTag || "OVERVIEW & SYNTHESIS";
    const bullets = slide.bullets || [];

    return `
      <div class="hero-container">
        <div class="tag-pill">${escapeHtml(kicker)}</div>
        <h1 class="slide-title-hero">${escapeHtml(slide.title)}</h1>
        ${slide.subtitle ? `<p class="slide-subtitle-hero">${escapeHtml(slide.subtitle)}</p>` : ""}
        
        ${
          bullets.length > 0
            ? `<div class="hero-cards-grid">
                ${bullets
                  .slice(0, 3)
                  .map(
                    (b, i) => `
                  <div class="hero-card">
                    <div class="hero-card-num">0${i + 1}</div>
                    <div class="hero-card-text">${escapeHtml(b)}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
    `;
  }

  // 2. METRICS / NUMBERS SLIDE
  if (layout === "metrics" || layout === "big-stat" || layout === "numbers") {
    const numbers = slide.numbers || [];
    const statHighlight = slide.statHighlight;

    return `
      <div class="content-wrapper">
        <div class="section-tag">${escapeHtml(slide.kicker || "KEY METRICS & DATA")}</div>
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        ${slide.subtitle ? `<p class="slide-desc">${escapeHtml(slide.subtitle)}</p>` : ""}

        ${
          statHighlight
            ? `
          <div class="hero-metric-box">
            <div class="stat-highlight-val">${escapeHtml(statHighlight.value)}</div>
            <div class="stat-highlight-label">${escapeHtml(statHighlight.label)}</div>
            ${statHighlight.context ? `<div class="stat-highlight-context">${escapeHtml(statHighlight.context)}</div>` : ""}
          </div>
        `
            : ""
        }

        <div class="metrics-grid">
          ${
            numbers.length > 0
              ? numbers
                  .map(
                    (item) => `
                <div class="metric-card">
                  <div class="metric-val">${escapeHtml(item.value)}</div>
                  <div class="metric-label">${escapeHtml(item.label)}</div>
                  ${item.note ? `<div class="metric-note">${escapeHtml(item.note)}</div>` : ""}
                </div>
              `
                  )
                  .join("")
              : (slide.bullets || [])
                  .map(
                    (bullet, i) => `
                <div class="metric-card">
                  <div class="metric-val">#0${i + 1}</div>
                  <div class="metric-label">${escapeHtml(bullet)}</div>
                </div>
              `
                  )
                  .join("")
          }
        </div>
      </div>
    `;
  }

  // 3. COMPARISON SLIDE
  if (layout === "comparison") {
    const comp = slide.comparisonDetails;
    const leftTitle = comp?.leftTitle || slide.leftColumn?.title || "Konsep A";
    const leftItems = comp?.leftItems || slide.leftColumn?.items || [];
    const rightTitle = comp?.rightTitle || slide.rightColumn?.title || "Konsep B";
    const rightItems = comp?.rightItems || slide.rightColumn?.items || [];

    return `
      <div class="content-wrapper">
        <div class="section-tag">${escapeHtml(slide.kicker || "COMPARISON & ANALYSIS")}</div>
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        ${slide.subtitle ? `<p class="slide-desc">${escapeHtml(slide.subtitle)}</p>` : ""}

        <div class="comparison-grid">
          <div class="comparison-col left-col">
            <div class="comparison-head">${escapeHtml(leftTitle)}</div>
            <ul class="comparison-list">
              ${leftItems.map((item) => `<li><span class="bullet-dot"></span><span>${escapeHtml(item)}</span></li>`).join("")}
            </ul>
          </div>
          <div class="comparison-col right-col ${comp?.winner === "right" ? "highlight-col" : ""}">
            <div class="comparison-head">${escapeHtml(rightTitle)}</div>
            <ul class="comparison-list">
              ${rightItems.map((item) => `<li><span class="bullet-dot"></span><span>${escapeHtml(item)}</span></li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // 4. TIMELINE / PROCESS SLIDE
  if (layout === "timeline") {
    const steps = slide.timelineSteps || [];
    return `
      <div class="content-wrapper">
        <div class="section-tag">${escapeHtml(slide.kicker || "WORKFLOW & PROGRESSION")}</div>
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        ${slide.subtitle ? `<p class="slide-desc">${escapeHtml(slide.subtitle)}</p>` : ""}

        <div class="timeline-grid">
          ${
            steps.length > 0
              ? steps
                  .map(
                    (s) => `
                <div class="timeline-item">
                  <div class="timeline-step-tag">${escapeHtml(s.step)}</div>
                  <div class="timeline-item-title">${escapeHtml(s.title)}</div>
                  <div class="timeline-item-desc">${escapeHtml(s.desc)}</div>
                </div>
              `
                  )
                  .join("")
              : (slide.bullets || [])
                  .map(
                    (b, i) => `
                <div class="timeline-item">
                  <div class="timeline-step-tag">Step 0${i + 1}</div>
                  <div class="timeline-item-desc">${escapeHtml(b)}</div>
                </div>
              `
                  )
                  .join("")
          }
        </div>
      </div>
    `;
  }

  // 5. BENTO GRID / CARDS SLIDE
  if (layout === "bento-grid" || layout === "agenda") {
    const bento = slide.bentoCards || [];
    return `
      <div class="content-wrapper">
        <div class="section-tag">${escapeHtml(slide.kicker || "CORE PILLARS")}</div>
        <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
        ${slide.subtitle ? `<p class="slide-desc">${escapeHtml(slide.subtitle)}</p>` : ""}

        <div class="bento-grid">
          ${
            bento.length > 0
              ? bento
                  .map(
                    (c) => `
                <div class="bento-card">
                  ${c.badge ? `<span class="bento-badge">${escapeHtml(c.badge)}</span>` : ""}
                  <div class="bento-title">${escapeHtml(c.title)}</div>
                  <div class="bento-desc">${escapeHtml(c.desc)}</div>
                </div>
              `
                  )
                  .join("")
              : (slide.bullets || [])
                  .map(
                    (b, i) => `
                <div class="bento-card">
                  <span class="bento-badge">0${i + 1}</span>
                  <div class="bento-desc">${escapeHtml(b)}</div>
                </div>
              `
                  )
                  .join("")
          }
        </div>
      </div>
    `;
  }

  // 6. QUOTE SLIDE
  if (layout === "quote" && slide.quote) {
    return `
      <div class="content-wrapper quote-wrapper">
        <div class="quote-mark">“</div>
        <blockquote class="quote-text">${escapeHtml(slide.quote.text)}</blockquote>
        ${slide.quote.author ? `<div class="quote-author">— ${escapeHtml(slide.quote.author)}</div>` : ""}
        ${slide.quote.context ? `<div class="quote-context">${escapeHtml(slide.quote.context)}</div>` : ""}
      </div>
    `;
  }

  // 7. DEFAULT: BULLETS / TAKEAWAYS SLIDE
  const bullets = slide.bullets || [];
  return `
    <div class="content-wrapper">
      <div class="section-tag">${escapeHtml(slide.kicker || (layout === "takeaway" ? "SUMMARY & ACTION POINTS" : "KEY INSIGHTS"))}</div>
      <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
      ${slide.subtitle ? `<p class="slide-desc">${escapeHtml(slide.subtitle)}</p>` : ""}

      <div class="bullets-container">
        ${bullets
          .map(
            (b, i) => `
          <div class="bullet-row">
            <div class="bullet-badge">0${i + 1}</div>
            <div class="bullet-content">${escapeHtml(b)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Builds a single self-contained HTML presentation from SlideDeckData
 */
export function buildPresentationHtml(
  deck: Partial<SlideDeckData> & { title: string; slides: SlideItem[] }
): string {
  const theme = PRESENTATION_THEMES[deck.themeId || "bold_dark"] || PRESENTATION_THEMES.bold_dark!;
  const slides = deck.slides || [];
  const totalSlides = slides.length;
  const title = deck.title || "Slide Presentasi";

  return `<!DOCTYPE html>
<html lang="${deck.language || "id"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

  @page {
    size: 1920px 1080px;
    margin: 0;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
    --bg-color: ${theme.bg};
    --slide-bg: ${theme.slideBg};
    --card-bg: ${theme.cardBg};
    --card-border: ${theme.cardBorder};
    --ink-color: ${theme.ink};
    --muted-ink: ${theme.mutedInk};
    --accent-color: ${theme.accent};
    --accent-muted: ${theme.accentMuted};
  }

  html, body {
    width: 100%;
    height: 100%;
    background-color: var(--bg-color);
    color: var(--ink-color);
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Presentation Viewport Stage */
  #viewport {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  #deck-container {
    width: 1920px;
    height: 1080px;
    transform-origin: center center;
    position: absolute;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
  }

  /* Slide Canvas Specification (1920 x 1080) */
  .slide {
    width: 1920px;
    height: 1080px;
    position: absolute;
    top: 0;
    left: 0;
    background: var(--slide-bg);
    padding: 70px 110px 50px 110px;
    display: none;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    page-break-inside: avoid;
    page-break-after: always;
    break-after: page;
  }

  .slide.active {
    display: flex;
  }

  /* Ambient Glow for Dark Themes */
  ${
    theme.isDark
      ? `
  .ambient-glow {
    position: absolute;
    width: 800px;
    height: 800px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent-muted) 0%, rgba(0,0,0,0) 70%);
    filter: blur(90px);
    pointer-events: none;
    top: -200px;
    right: -200px;
    z-index: 0;
  }
  `
      : ""
  }

  /* Slide Chrome: Header & Footer */
  .slide-header {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--card-border);
    padding-bottom: 20px;
  }

  .deck-title-crumb {
    font-size: 14px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted-ink);
    font-weight: 600;
  }

  .slide-counter {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: var(--accent-color);
    background: var(--accent-muted);
    padding: 6px 14px;
    border-radius: 20px;
  }

  .slide-footer {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--card-border);
    padding-top: 18px;
    font-size: 14px;
    color: var(--muted-ink);
  }

  /* Main Slide Content Area */
  .slide-body {
    position: relative;
    z-index: 2;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 24px 0;
  }

  /* Typography */
  .section-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--accent-color);
    margin-bottom: 14px;
    font-weight: 700;
  }

  .slide-title {
    font-size: 48px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -1.2px;
    color: var(--ink-color);
    margin-bottom: 14px;
    max-width: 1400px;
  }

  .slide-desc {
    font-size: 20px;
    line-height: 1.5;
    color: var(--muted-ink);
    margin-bottom: 36px;
    max-width: 1200px;
  }

  /* HERO LAYOUT */
  .hero-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    height: 100%;
  }

  .tag-pill {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--accent-color);
    background: var(--accent-muted);
    border: 1px solid var(--accent-color);
    padding: 6px 16px;
    border-radius: 20px;
    margin-bottom: 24px;
    font-weight: 700;
  }

  .slide-title-hero {
    font-size: 64px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -2px;
    color: var(--ink-color);
    margin-bottom: 22px;
    max-width: 1500px;
  }

  .slide-subtitle-hero {
    font-size: 24px;
    line-height: 1.5;
    color: var(--muted-ink);
    max-width: 1100px;
    margin-bottom: 48px;
  }

  .hero-cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    width: 100%;
  }

  .hero-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 28px;
  }

  .hero-card-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: var(--accent-color);
    margin-bottom: 12px;
  }

  .hero-card-text {
    font-size: 17px;
    line-height: 1.5;
    color: var(--ink-color);
  }

  /* BULLETS LAYOUT */
  .bullets-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 1500px;
  }

  .bullet-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 24px 32px;
  }

  .bullet-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 700;
    color: var(--accent-color);
    background: var(--accent-muted);
    border-radius: 8px;
    padding: 4px 10px;
    shrink: 0;
  }

  .bullet-content {
    font-size: 20px;
    line-height: 1.6;
    color: var(--ink-color);
  }

  /* METRICS & NUMBERS LAYOUT */
  .hero-metric-box {
    background: var(--accent-muted);
    border: 1px solid var(--accent-color);
    border-radius: 20px;
    padding: 32px 40px;
    margin-bottom: 32px;
  }

  .stat-highlight-val {
    font-size: 72px;
    font-weight: 800;
    color: var(--accent-color);
    letter-spacing: -2px;
    line-height: 1;
    margin-bottom: 10px;
  }

  .stat-highlight-label {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink-color);
    margin-bottom: 6px;
  }

  .stat-highlight-context {
    font-size: 16px;
    color: var(--muted-ink);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 28px;
    width: 100%;
  }

  .metric-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 18px;
    padding: 30px;
  }

  .metric-val {
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -1.5px;
    color: var(--accent-color);
    margin-bottom: 10px;
  }

  .metric-label {
    font-size: 18px;
    font-weight: 600;
    color: var(--ink-color);
    line-height: 1.4;
  }

  .metric-note {
    font-size: 14px;
    color: var(--muted-ink);
    margin-top: 6px;
  }

  /* COMPARISON LAYOUT */
  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    width: 100%;
  }

  .comparison-col {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 20px;
    padding: 36px;
  }

  .comparison-col.highlight-col {
    border-color: var(--accent-color);
    background: var(--accent-muted);
  }

  .comparison-head {
    font-size: 24px;
    font-weight: 700;
    color: var(--ink-color);
    margin-bottom: 24px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--card-border);
  }

  .comparison-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .comparison-list li {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-color);
  }

  .bullet-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-color);
    margin-top: 10px;
    shrink: 0;
  }

  /* TIMELINE & BENTO */
  .timeline-grid, .bento-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 28px;
    width: 100%;
  }

  .timeline-item, .bento-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 18px;
    padding: 32px;
  }

  .timeline-step-tag, .bento-badge {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-color);
    background: var(--accent-muted);
    padding: 4px 10px;
    border-radius: 8px;
    margin-bottom: 14px;
  }

  .timeline-item-title, .bento-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--ink-color);
    margin-bottom: 10px;
  }

  .timeline-item-desc, .bento-desc {
    font-size: 16px;
    line-height: 1.6;
    color: var(--muted-ink);
  }

  /* QUOTE LAYOUT */
  .quote-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 0 100px;
  }

  .quote-mark {
    font-size: 120px;
    line-height: 1;
    color: var(--accent-color);
    font-family: Georgia, serif;
    opacity: 0.35;
    margin-bottom: -40px;
  }

  .quote-text {
    font-size: 40px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink-color);
    margin-bottom: 30px;
  }

  .quote-author {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent-color);
    margin-bottom: 8px;
  }

  .quote-context {
    font-size: 16px;
    color: var(--muted-ink);
  }

  /* PRINT MODE OVERRIDE (For perfect PDF rendering via Chromium) */
  @media print {
    html, body {
      background: #000000 !important;
      overflow: visible !important;
      width: 1920px !important;
      height: auto !important;
    }

    #viewport {
      display: block !important;
      width: 1920px !important;
      height: auto !important;
      position: static !important;
      overflow: visible !important;
    }

    #deck-container {
      width: 1920px !important;
      height: auto !important;
      transform: none !important;
      position: static !important;
      box-shadow: none !important;
    }

    .slide {
      display: flex !important;
      position: relative !important;
      width: 1920px !important;
      height: 1080px !important;
      page-break-after: always !important;
      break-after: page !important;
      margin: 0 !important;
    }

    #controls-overlay, #speaker-notes-drawer {
      display: none !important;
    }
  }
</style>
</head>
<body>

<div id="viewport">
  <div id="deck-container">
    ${slides
      .map(
        (slide: SlideItem, index: number) => `
      <div class="slide ${index === 0 ? "active" : ""}" data-slide-index="${index}" data-slide-id="${slide.id}">
        <div class="ambient-glow"></div>
        <div class="slide-header">
          <span class="deck-title-crumb">${escapeHtml(title)}</span>
          <span class="slide-counter">№ ${index + 1}/${totalSlides}</span>
        </div>

        <div class="slide-body">
          ${renderSlideContent(slide, theme, title)}
        </div>

        <div class="slide-footer">
          <span>${escapeHtml(slide.accentTag || deck.topic || "Const Studio")}</span>
          <span>Const Learn Platform</span>
        </div>

        ${slide.speakerNotes ? `<div class="slide-notes-hidden" style="display:none;">${escapeHtml(slide.speakerNotes)}</div>` : ""}
      </div>
    `
      )
      .join("")}
  </div>
</div>

<script>
  (function() {
    let currentSlide = 0;
    const slides = Array.from(document.querySelectorAll('.slide'));
    const total = slides.length;
    const container = document.getElementById('deck-container');

    // Responsive Auto-Scaling to fit 1920x1080 to any window
    function updateScale() {
      if (!container) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleX = vw / 1920;
      const scaleY = vh / 1080;
      const scale = Math.min(scaleX, scaleY) * 0.98;
      container.style.transform = 'scale(' + scale + ')';
    }

    window.addEventListener('resize', updateScale);
    updateScale();

    function showSlide(index) {
      if (index < 0 || index >= total) return;
      slides.forEach((s, idx) => {
        s.classList.toggle('active', idx === index);
      });
      currentSlide = index;
      window.location.hash = '#slide-' + (index + 1);

      // Notify parent frame (React presentation viewer)
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'SLIDE_CHANGED', index: index }, '*');
        }
      } catch (err) {}
    }

    // Listen to parent frame navigation commands
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'GOTO_SLIDE' && typeof e.data.index === 'number') {
        showSlide(e.data.index);
      }
    });

    // Keyboard navigation
    window.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        showSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        showSlide(currentSlide - 1);
      } else if (e.key === 'Home') {
        showSlide(0);
      } else if (e.key === 'End') {
        showSlide(total - 1);
      }
    });

    // Hash sync support
    const hash = window.location.hash;
    if (hash && hash.startsWith('#slide-')) {
      const parsed = parseInt(hash.replace('#slide-', ''), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= total) {
        showSlide(parsed - 1);
      }
    }
  })();
</script>
</body>
</html>`;
}
