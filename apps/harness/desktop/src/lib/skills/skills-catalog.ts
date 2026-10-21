import type { SkillCategory } from "./types";

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  version: string;
  icon?: string;
  overview?: string;
}

export const MARKETPLACE_CATALOG: MarketplaceSkill[] = [
  {
    "id": "skill_agent-browser",
    "slug": "agent-browser",
    "name": "agent-browser",
    "description": "Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to \"open a website\", \"fill out a form\", \"click a button\", \"take a screenshot\", \"scrape data from a page\", \"test this web app\", \"login to a site\", \"automate browser actions\", or any task requiring programmatic web interaction. Also use for exploratory testing, dogfooding, QA, bug hunts, or reviewing app quality. Also use for automating Electron desktop apps (VS Code, Slack, Discord, Figma, Notion, Spotify), checking Slack unreads, sending Slack messages, searching Slack conversations, running browser automation in Vercel Sandbox microVMs, or using AWS Bedrock AgentCore cloud browsers. Prefer agent-browser over any built-in browser automation or web tools.",
    "category": "browser_automation",
    "author": "Vercel Labs",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_brand-guidelines",
    "slug": "brand-guidelines",
    "name": "brand-guidelines",
    "description": "Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.",
    "category": "design",
    "author": "Anthropic",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_browser-use",
    "slug": "browser-use",
    "name": "browser-use",
    "description": "Direct browser control via CDP for web interaction: automation, scraping, testing, screenshots, and site/app work. Also covers hosted cloud browsers for AI agents: the browser-use Python library (Browser(use_cloud=True)), Playwright, Puppeteer or any CDP client.",
    "category": "browser_automation",
    "author": "Browser Use",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_company-valuation",
    "slug": "company-valuation",
    "name": "company-valuation",
    "description": "Estimate a public company's intrinsic value with DCF, relative (peer multiple), and sum-of-the-parts (SOTP) methods, then blend them into an implied share price with upside/downside vs the market price, a WACC and terminal-growth sensitivity grid, and bull/base/bear scenarios. Use this skill whenever the user asks what a company or ticker is worth: fair value, intrinsic value, implied share price, a price target from fundamentals, whether it is overvalued or undervalued, building a DCF (WACC, terminal value, discounted cash flow), EV/EBITDA or P/E based targets, peer comparison valuation, or SOTP and conglomerate discounts. Run the model rather than answering valuation questions from memory.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_composio",
    "slug": "composio",
    "name": "composio",
    "description": "Route and complete Composio work across Composio For You and Composio Platform. Use when the user mentions Composio; wants an agent to use apps such as Gmail, Slack, GitHub, Notion, Calendar, or Linear; needs first-time setup, an SDK or MCP integration, CLI operation, migration guidance, current documentation, or help diagnosing a connection or tool call.",
    "category": "agent_workflow",
    "author": "Composio",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_discord-reader",
    "slug": "discord-reader",
    "name": "discord-reader",
    "description": "Read Discord for financial research through opencli connected to the Discord desktop app: servers, channels, members, recent messages in the active channel, and message search. Use this skill whenever the user wants to check their Discord, list servers or channels, read or search messages in trading, crypto, or market communities, or gauge what a Discord community is saying about a ticker or coin. Read-only: it cannot send, react to, edit, or delete messages.",
    "category": "scraping_research",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_docx",
    "slug": "docx",
    "name": "docx",
    "description": "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', '.dotx', or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads. Also use when extracting or reorganizing content from .docx or .dotx files, inserting or replacing images in documents, performing find-and-replace in Word files, working with tracked changes or comments, or converting content into a polished Word document. If the user asks for a 'report', 'memo', 'letter', 'template', or similar deliverable as a Word or .docx file, use this skill. Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks unrelated to document generation.",
    "category": "document",
    "author": "Anthropic",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_earnings-preview",
    "slug": "earnings-preview",
    "name": "earnings-preview",
    "description": "Build a pre-earnings briefing for a stock from Yahoo Finance data (yfinance): the upcoming report date and timing, consensus EPS and revenue estimates with their range, the beat/miss track record, analyst ratings and price targets, and what to watch in the print. Use this skill whenever the user is preparing for an upcoming earnings report or asks what the street expects — consensus or whisper numbers, EPS expectations, whether a company will beat, an earnings setup, or an earnings-season preview — and whenever a ticker comes up in the context of upcoming earnings, even without the word \"preview\". For results that are already out, use earnings-recap.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_earnings-recap",
    "slug": "earnings-recap",
    "name": "earnings-recap",
    "description": "Analyze a company's most recent (or a specified past) earnings report from Yahoo Finance data (yfinance): actual vs estimated EPS, surprise size, revenue and margin trends, and the stock's price reaction. Use this skill whenever the user asks how earnings went — beat or miss, earnings surprise, quarterly results, the post-earnings move, or an earnings call recap — including casual references to a past report such as \"AMZN reported last night\" or \"how did they do\". For an upcoming report, use earnings-preview.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_embedded-captions",
    "slug": "embedded-captions",
    "name": "embedded-captions",
    "description": "Add captions or subtitles to an existing single-subject talking-head video without editing the footage. Use for plain verbatim captions, cinematic captions embedded behind the subject, VFX captions, “炸/特效/酷炫字幕,” or a named identity from the 35-style catalog. Route by visual identity, not by backend engine. The quiet `anchor` rail is the default; embed every word only when the user explicitly wants a fully cinematic treatment. The workflow runs locally end to end, including transcription and subject matting; split multi-shot footage before applying it.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_estimate-analysis",
    "slug": "estimate-analysis",
    "name": "estimate-analysis",
    "description": "Analyze sell-side analyst estimates and how they are changing, using Yahoo Finance data (yfinance): EPS and revenue consensus by period, estimate ranges and dispersion, revision trends over 7/30/60/90 days and up/down revision breadth, growth estimates vs industry, sector, and the S&P 500, and historical estimate accuracy. Use this skill when the user wants more than a single estimate lookup: estimate revisions or momentum, EPS trend, consensus changes, forward or next-quarter and annual estimates, the bull vs bear estimate spread, or growth projections across periods.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_etf-premium",
    "slug": "etf-premium",
    "name": "etf-premium",
    "description": "Calculate an ETF's premium or discount to NAV from Yahoo Finance data (yfinance), compare or screen ETFs by premium, explain why a gap exists, and decompose a sudden ETF move into NAV-driven vs structural components (dealer gamma exposure, blocked AP arbitrage, sentiment). Use this skill whenever the user asks whether an ETF trades above or below NAV, compares ETF premiums or discounts, screens for the biggest ones, asks about ETF arbitrage or premium convergence, or wants to know why an ETF jumped or diverged from its holdings — including gamma squeezes, dealer gamma exposure (GEX), and blocked creation/redemption. Especially relevant for leveraged, inverse, international, bond, commodity, and crypto ETFs (IBIT, BITO, HYG, KWEB).",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_faceless-explainer",
    "slug": "faceless-explainer",
    "name": "faceless-explainer",
    "description": "Turn arbitrary text — an article, notes, a topic, a brief — into a faceless explainer video: there is no site or footage to capture, so the visuals are invented per scene (typography, abstract graphics, diagrams, data-viz). Use for topic explainers, concept breakdowns, how-tos, listicles. Not a video built from a website (/product-launch-video — promo or tour). Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_figma",
    "slug": "figma",
    "name": "figma",
    "description": "Import Figma content into a HyperFrames composition — rendered assets, brand tokens, components, storyboard sections → reconstructed motion (frames read as states, not slides) (REST/CLI), connector-assisted motion when available, and shaders from a connector or native export. Use when the user pastes a figma.com link or asks to bring a Figma design, frame, logo, brand, or animation into a video/composition.",
    "category": "design",
    "author": "skills.sh",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_finance-sentiment",
    "slug": "finance-sentiment",
    "name": "finance-sentiment",
    "description": "Fetch normalized stock sentiment across Reddit, X.com, financial news, and Polymarket from the Adanos Finance API: buzz score, bullish percentage, mention or trade counts, and trend. Use this skill whenever the user asks how much a stock is being discussed or how hot it is on social platforms, how many Reddit mentions or Polymarket bets a company has, whether Reddit, X, and news agree, or wants to compare stock buzz and sentiment across tickers. Read-only: it never places trades or modifies anything.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_fintel-data",
    "slug": "fintel-data",
    "name": "fintel-data",
    "description": "Query Fintel (fintel.io) institutional market data through its REST API or official MCP server. Use this skill whenever the user mentions Fintel or asks about short interest, short interest ratio or days to cover, short squeeze data, borrow rate or cost to borrow, shares available to borrow, daily short volume, fails-to-deliver (FTD), 13F institutional owners (\"who owns X\"), insider buying or selling from SEC Form 3/4/5, analyst price targets, ratings and forecasts, dividend or earnings history and calendars, EOD or last prices, security lookup by ticker, CUSIP, ISIN, or FIGI, Fintel leaderboards, or their Fintel watchlists and alerts. Read-only: GET endpoints only.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_frontend-design",
    "slug": "frontend-design",
    "name": "frontend-design",
    "description": "Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.",
    "category": "design",
    "author": "Anthropic",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_gemini-infographic",
    "slug": "gemini-infographic",
    "name": "gemini-infographic",
    "description": "Generate hand-drawn whiteboard, notebook, and visual infographic prompts from source materials. Takes source content (a post, newsletter, blog, research note, lecture) and produces an infographic brief and high-impact image generation prompt. Use whenever the user asks for a \"whiteboard infographic\", \"gemini infographic\", \"hand-drawn graphic\", or wants an AI-generated infographic for study notes or social posts.",
    "category": "agent_workflow",
    "author": "Google",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_general-video",
    "slug": "general-video",
    "name": "general-video",
    "description": "Author or edit a custom HyperFrames composition when no specialized workflow fits, or when BRIEF.md sets flow: companion. Use for longer or multi-scene pieces, brand and sizzle reels, montages, static loops, static title cards, footage remixes, and freeform builds. Use motion-graphics instead for a short unnarrated motion-first unit, including an animated title. Route fresh creation through hyperframes before using this skill.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_generative-ui",
    "slug": "generative-ui",
    "name": "generative-ui",
    "description": "Design system and templates for Claude's built-in generative UI — the show_widget tool that renders interactive HTML/SVG widgets inline in claude.ai conversations. Use this skill whenever the user wants visual or interactive output rather than plain text or markdown: charts and dashboards, diagrams, flowcharts and architecture drawings, mockups, comparison grids, illustrations, interactive explainers (\"explain how X works\" with a visual), or tools with sliders, toggles, and live-updating displays — including financial data shown visually and requests phrased as \"show me\", \"visualize\", \"draw\", or \"chart this\".",
    "category": "design",
    "author": "Vercel",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_grill-me",
    "slug": "grill-me",
    "name": "grill-me",
    "description": "A relentless interview to sharpen a plan or design.",
    "category": "coding_dev",
    "author": "Matt Pocock",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_grill-with-docs",
    "slug": "grill-with-docs",
    "name": "grill-with-docs",
    "description": "A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.",
    "category": "coding_dev",
    "author": "Matt Pocock",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_grilling",
    "slug": "grilling",
    "name": "grilling",
    "description": "Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.",
    "category": "coding_dev",
    "author": "Matt Pocock",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hormuz-strait",
    "slug": "hormuz-strait",
    "name": "hormuz-strait",
    "description": "Check the live status of the Strait of Hormuz from the Hormuz Strait Monitor dashboard: open, restricted, or closed status, tanker transits vs normal, stranded vessels, Brent price impact, war-risk insurance levels, cargo throughput, tanker freight rates, diplomatic developments, and global trade impact. Use this skill whenever the user asks about the Strait of Hormuz or the Persian Gulf in the context of oil, shipping, or geopolitical risk — whether Hormuz is open, chokepoint or transit disruption, Gulf tanker traffic, war-risk premiums, Middle East shipping routes, or energy supply-chain risk.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes",
    "slug": "hyperframes",
    "name": "hyperframes",
    "description": "Mandatory entry point: read this first for any request to make, create, edit, animate, or render a video, animation, or motion graphic, including a promo, explainer, captioned clip, title card, overlay, slideshow or interactive deck, Remotion port, or any HyperFrames HTML composition. Also use it to inspect, diagnose, validate, preview, publish, or batch-render an existing HyperFrames project. Inputs may be a website URL, GitHub PR, Figma design or URL, text or brief, existing footage, or music. It resumes project state, captures intent when applicable, selects and installs the owning workflow, and routes domain capabilities. HyperFrames is the default output framework unless the user explicitly chooses another framework for the deliverable or asks only to record a browser session.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-animation",
    "slug": "hyperframes-animation",
    "name": "hyperframes-animation",
    "description": "All animation knowledge for HyperFrames — atomic motion rules, multi-phase scene blueprints, scene transitions, broader motion-design techniques, AND the seven runtime adapters (GSAP default, plus Lottie, Three.js, Anime.js, CSS keyframes, Web Animations API, TypeGPU). Use for any motion or animation task: pick 2-4 rules and compose, or load a blueprint, or look up runtime-specific API (e.g. GSAP eases / Lottie player / Three.js mixer). Also covers auditing an existing composition's choreography (animation map) and 24 named text-animation effects. HyperFrames-native: single paused timeline, seek-safe, deterministic.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-audio",
    "slug": "hyperframes-audio",
    "name": "hyperframes-audio",
    "description": "Use when audio already placed in a HyperFrames composition needs to be mixed: fade-in/fade-out, crossfade, track gain or volume, volume automation, ducking, a music bed that fights a voiceover (voiceover carve), effects on a track (EQ, compressor, limiter, gate, saturation, delay, reverb, chorus, phaser, bitcrush), automation envelopes drawn on a track's volume or any effect parameter, or one submix bus carrying a chain, a fader and an automation clock for several tracks at once (`<hf-audio-group>`). Don't use for sourcing or generating audio — finding BGM, SFX, or making a voiceover is `/media-use`. Don't use for clip timing or track layout, which is `/hyperframes-core`.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-cli",
    "slug": "hyperframes-cli",
    "name": "hyperframes-cli",
    "description": "Use the HyperFrames CLI development loop: init, add, catalog, capture, lint, check, snapshot, compare, grade-compare, preview, play, present, beats, keyframes, single or batch render, publish, cloud, cloudrun, feedback, lambda, doctor, browser, info, upgrade, skills, compositions, timeline, history, clean, docs, benchmark, telemetry, transcribe, auth, tts, and remove-background. Also use when diagnosing build or render failures. validate, inspect, and layout are deprecated aliases; use check. Covers local, HeyGen-hosted cloud, AWS Lambda, and Google Cloud Run rendering.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-core",
    "slug": "hyperframes-core",
    "name": "hyperframes-core",
    "description": "The HyperFrames composition contract — build one renderable project. Use for composition structure, the `data-*` timing attributes, `class=\"clip\"`, tracks, sub-compositions, variables, framework-owned media playback, deterministic-render rules, and validation. Read before writing composition HTML.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-creative",
    "slug": "hyperframes-creative",
    "name": "hyperframes-creative",
    "description": "Non-animation creative direction for HyperFrames videos. Use for design spec (frame.md / design.md) handling, palettes, typography, narration, beat planning, audio-reactive visuals, composition patterns, and brand / style decisions. For atomic motion patterns and scene blueprints, use `hyperframes-animation`.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-keyframes",
    "slug": "hyperframes-keyframes",
    "name": "hyperframes-keyframes",
    "description": "Use when a HyperFrames composition needs a punch-in, punch-out, zoom, reframe, Ken Burns treatment, camera move, visual match/whip handoff, or other seek-safe 2D/3D keyframes; also for GSAP, CSS keyframes, Anime.js, WAAPI, FLIP, paths, masks, SVG morph/draw, text trails, 3D depth, or `hyperframes keyframes` diagnostics. Don't use for broad scene strategy, brand design, media sourcing, captions, or general video planning.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-registry",
    "slug": "hyperframes-registry",
    "name": "hyperframes-registry",
    "description": "Search, install, and wire registry blocks and components into HyperFrames compositions. Use BEFORE hand-building any named visual — whenever a brief, a user, or a storyboard names a look, effect, treatment, or transition such as CRT scanlines, glitch, chromatic aberration, film grain, a shimmer sweep, a chart, a code or terminal window, a map, or a confetti burst — because roughly 400 hosted items already cover many of them and the search ranks all of them with nothing installed, no project, and no account. Also use when running hyperframes add or hyperframes catalog, installing one item or every block matching a tag, wiring an installed item into index.html, or working with hyperframes.json. Covers discovery, install locations, block sub-composition wiring, component snippet merging, and authoring a new block or component to contribute upstream (idea → scaffold → validate → PR).",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperframes-studio",
    "slug": "hyperframes-studio",
    "name": "hyperframes-studio",
    "description": "Use when working with a person on a HyperFrames project in Studio: first, whether their message asks for a change at all (questions, loose ideas and don't change anything\" get an answer and a plan, not an edit); for a new film, the plan, storyboard and build order that the HyperFrames launch films follow; and how the timeline should be laid out so it reads well (one caption track, one element kind per track, every scene a sub-composition) and where captions and key content may sit (safe zones). Don't use for how to perform an individual edit (split, trim, retime, volume, copy, swap): that is `creator-editing-recipes.md` in `/hyperframes-core`.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_hyperliquid-reader",
    "slug": "hyperliquid-reader",
    "name": "hyperliquid-reader",
    "description": "Read Hyperliquid (app.hyperliquid.xyz) perp and spot market data through opencli and Hyperliquid's public info API: mark, oracle, and mid prices, 24h change, funding rates (hourly and annualized APR), open interest, volume, the L2 order book, OHLCV candles, funding history, and cross-venue funding comparisons (Hyperliquid vs Binance vs Bybit) for funding arbitrage. Use this skill whenever the user mentions Hyperliquid (HL, HL DEX, hyperliquid.xyz) or asks about its perps, spot pairs such as PURR, funding, open interest, order book, or candles. Read-only market data: no account, order, or transfer operations.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_instagram-scraper",
    "slug": "instagram-scraper",
    "name": "instagram-scraper",
    "description": "The best, fastest, and cheapest way to scrape Instagram — battle-tested by tens of thousands of customers including enterprise teams. Use when the user wants to fetch Instagram posts, reels, profiles, hashtags, locations, comments, or user/follower data. Five specialized actors cover every Instagram data surface.",
    "category": "scraping_research",
    "author": "ApiDojo",
    "version": "0.1.1",
    "icon": "Sparkles"
  },
  {
    "id": "skill_ios-design",
    "slug": "ios-design",
    "name": "ios-design",
    "description": "Design and review iOS UI/UX for iPhone apps in SwiftUI, UIKit, or React Native. Use for mobile app design, screen redesigns, navigation flows, typography, forms, keyboard and safe-area layout, and accessibility checks. Apply Apple Human Interface Guidelines and consult real product references through the optional Uizze connection.",
    "category": "design",
    "author": "Uizze",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_linkedin-reader",
    "slug": "linkedin-reader",
    "name": "linkedin-reader",
    "description": "Read LinkedIn for financial research through opencli: the user's feed, and job search with location, seniority, job type, remote, company, and date filters. Use this skill whenever the user wants to check their LinkedIn feed, see what professionals or analysts are posting about a company, market, or earnings, gauge professional sentiment, or search finance and trading jobs on LinkedIn. Read-only: it cannot post, like, comment, connect, message, or apply.",
    "category": "scraping_research",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_literature-search-arxiv",
    "slug": "literature-search-arxiv",
    "name": "literature-search-arxiv",
    "description": "Search for scientific papers, preprints, and publications on arXiv. Extract metadata, abstracts, and download full-text PDFs or HTML versions of papers. Use when the user asks to find research papers, literature, or specific arXiv IDs.",
    "category": "scraping_research",
    "author": "Google DeepMind",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_manim-composer",
    "slug": "manim-composer",
    "name": "manim-composer",
    "description": "Trigger when: (1) User wants to create an educational/explainer video, (2) User has a vague concept they want visualized, (3) User mentions \"3b1b style\" or \"explain like 3Blue1Brown\", (4) User wants to plan a Manim video or animation sequence, (5) User asks to \"compose\" or \"plan\" a math/science visualization. Transforms vague video ideas into detailed scene-by-scene plans (scenes.md). Conducts research, asks clarifying questions about audience/scope/focus, and outputs comprehensive scene specifications ready for implementation with ManimCE or ManimGL. Use this BEFORE writing any Manim code. This skill plans the video; use manimce-best-practices or manimgl-best-practices for implementation.",
    "category": "motion_video",
    "author": "Adithya S K",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_manimce-best-practices",
    "slug": "manimce-best-practices",
    "name": "manimce-best-practices",
    "description": "Trigger when: (1) User mentions \"manim\" or \"Manim Community\" or \"ManimCE\", (2) Code contains `from manim import *`, (3) User runs `manim` CLI commands, (4) Working with Scene, MathTex, Create(), or ManimCE-specific classes. Best practices for Manim Community Edition - the community-maintained Python animation engine. Covers Scene structure, animations, LaTeX/MathTex, 3D with ThreeDScene, camera control, styling, and CLI usage. NOT for ManimGL/3b1b version (which uses `manimlib` imports and `manimgl` CLI).",
    "category": "motion_video",
    "author": "Adithya S K",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_manimgl-best-practices",
    "slug": "manimgl-best-practices",
    "name": "manimgl-best-practices",
    "description": "Trigger when: (1) User mentions \"manimgl\" or \"ManimGL\" or \"3b1b manim\", (2) Code contains `from manimlib import *`, (3) User runs `manimgl` CLI commands, (4) Working with InteractiveScene, self.frame, self.embed(), ShowCreation(), or ManimGL-specific patterns. Best practices for ManimGL (Grant Sanderson's 3Blue1Brown version) - OpenGL-based animation engine with interactive development. Covers InteractiveScene, Tex with t2c, camera frame control, interactive mode (-se flag), 3D rendering, and checkpoint_paste() workflow. NOT for Manim Community Edition (which uses `manim` imports and `manim` CLI).",
    "category": "motion_video",
    "author": "Adithya S K",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_media-use",
    "slug": "media-use",
    "name": "media-use",
    "description": "Agent Media OS for a HyperFrames project. Resolve BGM, SFX, image, icon, brand logo, voice, color grade, or LUT into a frozen local file or paste-ready block + ledger record (one verb, `resolve`); generate via TTS / music / image models when the catalog misses; produce voiceover, transcription, captions, and background removal through one shared audio engine; operate on media (cut / reframe / transform); and reuse assets across projects. Also use for vague feedback that real footage looks dark, flat, boring, should feel retro/camcorder/print/ASCII, needs privacy, or needs a media reveal. When the host app provides its own music or sound-effect tools, use those for music and sound effects; `resolve --type bgm|sfx` needs the heygen CLI. When `HEYGEN_API_BASE` is set, HeyGen calls go through that host with no CLI sign-in.",
    "category": "agent_workflow",
    "author": "skills.sh",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_motion-graphics",
    "slug": "motion-graphics",
    "name": "motion-graphics",
    "description": "A short, design-led motion graphic where motion is the message — kinetic typography, stat count-up, chart/data-viz hit, logo sting / brand lockup, lower-third / callout / social overlay, animated map (highlight regions, connect places, zoom to a location), animated tweet / news-article / headline, webpage / UI animation (scroll, cursor, callouts), or fusing a real image's geometry into a chart. Usually under 10s (up to ~30s), no narration or live-action subject; renders to MP4 or transparent overlay. Longer / narrated / multi-scene → /general-video. Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_music-to-video",
    "slug": "music-to-video",
    "name": "music-to-video",
    "description": "Turn a music track (an audio file, a video to pull audio from, or a track generated from a mood brief) into a beat-synced video — lyric video, slideshow, or kinetic promo. The music drives all pacing; any user-supplied images/videos are cut onto the same beat grid, and a complete video needs zero assets. Narrated pieces → the input-matched workflow (see /hyperframes). Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_no-ai-slop",
    "slug": "no-ai-slop",
    "name": "no-ai-slop",
    "description": "Edit drafts into sharper, more human writing while preserving the writer's personal voice, or detect AI-slop patterns without rewriting. Use when the user wants a draft clearer, more direct, more opinionated, or less AI-sounding, or asks whether writing reads as AI.",
    "category": "coding_dev",
    "author": "Peter Yang",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_opencli-reader",
    "slug": "opencli-reader",
    "name": "opencli-reader",
    "description": "Generic read-only fallback for sources opencli supports but no dedicated skill covers: finance sites (Yahoo Finance, Bloomberg, Reuters, Barchart, Eastmoney, Xueqiu, Sinafinance), communities (Reddit, HackerNews, Weibo, Zhihu, Xiaohongshu, Bilibili), newsletters and blogs (Substack, Medium), research (arXiv, Google Scholar), podcasts and video (Apple Podcasts, Xiaoyuzhou, Spotify, YouTube), Weixin, Amazon, and more. Use it when the user asks to read or fetch from such a site — for example r/wallstreetbets, the HackerNews front page, Eastmoney hot stocks, the Xueqiu feed, Bloomberg markets headlines, or an arXiv search — or says \"use opencli to read\". Prefer twitter-reader, linkedin-reader, discord-reader, telegram-reader, or yc-reader when the source matches. Read-only: never runs write commands.",
    "category": "scraping_research",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_options-payoff",
    "slug": "options-payoff",
    "name": "options-payoff",
    "description": "Render an interactive options payoff chart — expiry P&L plus Black-Scholes theoretical value — with sliders for strikes, premium, IV, DTE, and spot. Use this skill whenever the user describes or shares an options position or strategy and wants to see how it makes or loses money: vertical, calendar, diagonal, or ratio spreads, butterflies, condors and iron condors, straddles, strangles, covered calls, protective or naked puts, or any multi-leg structure. This includes pasted strikes, premiums, and expiries, requests like \"show me the payoff\" or \"draw the P&L curve\", and broker screenshots (IBKR, TastyTrade, Robinhood). Use it even when details are partial — defaults fill the gaps.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_pdf",
    "slug": "pdf",
    "name": "pdf",
    "description": "Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.",
    "category": "document",
    "author": "Anthropic",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_pptx",
    "slug": "pptx",
    "name": "pptx",
    "description": "Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx or .potx file (even if the extracted content will be used elsewhere, like in an email or summary); editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates (.potx), layouts, speaker notes, or comments. Trigger whenever the user mentions \\\"deck,\\\" \\\"slides,\\\" \\\"presentation,\\\" or references a .pptx or .potx filename, regardless of what they plan to do with the content afterward. If a .pptx or .potx file needs to be opened, created, or touched, use this skill.",
    "category": "document",
    "author": "Anthropic",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_pr-to-video",
    "slug": "pr-to-video",
    "name": "pr-to-video",
    "description": "Turn a GitHub pull request (a PR URL, owner/repo#N, or 'this PR' in a checked-out repo) into a code-change explainer video — changelog, feature reveal, fix, or refactor walkthrough built from the diff, commits, and files: the input is a code change, not a website. Not a product promo (/product-launch-video) or a no-PR topic explainer (/faceless-explainer). Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_product-launch-video",
    "slug": "product-launch-video",
    "name": "product-launch-video",
    "description": "Turn a product or marketing URL, pasted script, or brief into a product launch / promo video — SaaS promos, feature reveals, product demos, app and company launches. Use when the user wants to market, launch, promote, or reveal a product; the default for any commercial URL. Site tours / showcases of a website route here too — the brief carries the show-it-as-is intent. Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_remote-browser",
    "slug": "remote-browser",
    "name": "remote-browser",
    "description": "Controls an isolated Browser Use Cloud browser from a sandboxed machine with the current Browser Use CLI.",
    "category": "browser_automation",
    "author": "Browser Use",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_remotion-to-hyperframes",
    "slug": "remotion-to-hyperframes",
    "name": "remotion-to-hyperframes",
    "description": "Port an existing Remotion (React) composition''s source to HyperFrames HTML. Use ONLY on an explicit ask to port/convert/migrate/translate a Remotion source — one-way, Remotion-only. A passing Remotion mention, reference-only code, or \"make something like my Remotion video\" is a fresh build (/general-video). Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_saas-valuation-compression",
    "slug": "saas-valuation-compression",
    "name": "saas-valuation-compression",
    "description": "Analyze how a private SaaS company's ARR valuation multiple changed across funding rounds, and attribute the compression or expansion to rate cycles and macro selloffs, growth deceleration, narrative shifts (including an AI premium), competition, and investor demand, benchmarked against private-market medians and peers. Use this skill whenever the user asks about valuation compression, ARR multiples, round-to-round valuation or multiple changes, down rounds, or wants to compare a VC-backed software company's funding rounds. Research the rounds rather than answering from memory.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_sepa-strategy",
    "slug": "sepa-strategy",
    "name": "sepa-strategy",
    "description": "Analyze stocks with Mark Minervini's SEPA (Specific Entry Point Analysis) methodology: stage analysis, the 8-condition trend template, fundamentals, VCP and other base patterns, pivot-point entries, market environment, and risk-based position sizing. Use this skill whenever the user mentions SEPA, Minervini, superperformance, the trend template, VCP (volatility contraction pattern), Stage 2, pivot or breakout entries, moving-average stacking (price above the 50/150/200-day MAs), breakout volume, position sizing from risk percentage, growth-stock screening or swing-trade entry criteria, or bases such as cup-with-handle, flat base, bull flag, or high tight flag. Also use it when the user asks \"should I buy this stock\" or \"is this a good setup\" about a growth or momentum name, or shares a chart for pattern analysis.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_skill-creator",
    "slug": "skill-creator",
    "name": "skill-creator",
    "description": "Create, improve, and evaluate agent skills (SKILL.md plus reference files). Use this skill whenever the user wants to build, scaffold, or design a new skill, improve or fix an existing skill that isn't working well, score or benchmark a skill's quality or run evals on it, or turn a repeated manual workflow into a skill (\"I keep doing X manually\", \"can you remember how to do X\", \"turn this into a skill\").",
    "category": "coding_dev",
    "author": "Anthropic",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_slideshow",
    "slug": "slideshow",
    "name": "slideshow",
    "description": "Author a HyperFrames slideshow — a presentation, pitch deck, or interactive deck with discrete slides, fragment reveals, branching, hotspot navigation, and built-in presenter mode with speaker notes; also converts an existing page into a deck. Output is a navigable deck, not a rendered MP4. If the user didn't explicitly ask for a slideshow, confirm before authoring. Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_startup-analysis",
    "slug": "startup-analysis",
    "name": "startup-analysis",
    "description": "Analyze a startup from three perspectives — VC investor, job applicant, and CEO/founder — covering market, traction, unit economics, team, defensibility, runway, equity value, culture, and competitive position, with a verdict for each. Use this skill whenever the user wants to evaluate a startup or private tech company: due diligence, whether to invest in it or join it, weighing a startup job offer, company health, outlook, or competitive position, or open-ended asks such as what do you think of [company]\" or \"research [company] for me\".",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_stock-correlation",
    "slug": "stock-correlation",
    "name": "stock-correlation",
    "description": "Analyze how stocks move together using Yahoo Finance price history (yfinance): find correlated peers for a ticker, measure correlation, beta, and spread between specific tickers, cluster a group into a correlation matrix, and track rolling or regime-dependent correlation. Use this skill whenever the user asks what moves with a stock, what else drops when it drops, related tickers or sympathy plays, sector or supply-chain peers, pair trading or hedging pairs, beta or relative performance, correlation matrices, co-movement, or rolling/realized correlation — including well-known pairs like AMD/NVDA, GOOGL/AVGO, or LITE/COHR. With a single ticker, assume the user wants its correlated peers.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_stock-liquidity",
    "slug": "stock-liquidity",
    "name": "stock-liquidity",
    "description": "Analyze how liquid a stock is using Yahoo Finance data (yfinance): bid-ask spreads, volume and dollar volume (ADTV), top-of-book and options depth, square-root market impact and slippage estimates, turnover ratio, and Amihud illiquidity, rolled into a liquidity grade. Use this skill whenever the user asks about liquidity or trading costs — how easily a position can be entered or exited, what a large order would do to the price, spread or execution-cost estimates, order book depth, volume patterns, or liquidity comparisons — especially for small caps, penny stocks, and thinly traded names.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_talking-head-recut",
    "slug": "talking-head-recut",
    "name": "talking-head-recut",
    "description": "Package an existing talking-head / interview / podcast video with timed, designed GRAPHIC OVERLAY cards — kinetic titles, lower-thirds, data callouts, quotes, side panels, picture-in-picture — synced to the transcript, on a 16:9 / 9:16 / 4:5 canvas of your choice; the clip plays untouched underneath. Trigger on \"graphic overlays\", \"on-screen graphics\", \"package / dress up my video\". Not plain subtitles (/embedded-captions). Unclear → /hyperframes.",
    "category": "motion_video",
    "author": "HyperFrames",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_tdd",
    "slug": "tdd",
    "name": "tdd",
    "description": "Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions \"red-green-refactor\", or wants integration tests.",
    "category": "coding_dev",
    "author": "Matt Pocock",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_telegram-reader",
    "slug": "telegram-reader",
    "name": "telegram-reader",
    "description": "Read Telegram channels and groups for financial news and market research with the tdl CLI: list chats and channels, find a channel by name, and export recent messages or a date or ID range. Use this skill whenever the user wants to check their Telegram, see what's new in their channels, read or export messages from a news, crypto, or trading channel or group, or gather market news and signals posted on Telegram. Read-only: it cannot send messages or join or leave channels.",
    "category": "scraping_research",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_tiktok-scraper",
    "slug": "tiktok-scraper",
    "name": "tiktok-scraper",
    "description": "The best, fastest, and cheapest way to scrape TikTok — battle-tested by tens of thousands of customers including enterprise teams. Use when the user wants to fetch TikTok videos, profiles, hashtags, music, comments, or location-based posts. Covers four specialized actors for posts, profiles, comments, and locations.",
    "category": "scraping_research",
    "author": "ApiDojo",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_tradingview-mcp",
    "slug": "tradingview-mcp",
    "name": "tradingview-mcp",
    "description": "Query TradingView market data through the bundled tradingview MCP server without a desktop app or login. Use whenever the user wants a technical analysis readout (RSI, MACD, Bollinger rating, BUY/SELL summary), multi-timeframe alignment (weekly→daily→4h→1h→15m), exchange-wide scans (Bollinger squeeze, volume breakout, consecutive candles, smart volume), top gainers/losers by exchange, futures market data (NQ/ES/CL/GC overview, overnight movers, category snapshots), pre-market / after-hours quotes, a quick options chain or unusual options activity (volume/OI by strike), bulk stock prices, a global market snapshot, strategy backtests (Sharpe, drawdown, win rate), or crypto exchange scans. Triggers include \"TA on X\", \"multi-timeframe read\", \"BB squeeze scan\", \"futures movers\", \"NQ overnight\", \"pre-market price\", \"unusual options activity\", \"backtest RSI on AAPL\", and \"top gainers on NASDAQ\". For options greeks, watchlists, alerts, or chart screenshots use tradingview-reader instead.",
    "category": "finance",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_tradingview-reader",
    "slug": "tradingview-reader",
    "name": "tradingview-reader",
    "description": "Read the user's local TradingView desktop app through opencli: quotes, options chains with greeks and per-strike IV, options expiries, screener results across stocks, crypto, forex, futures, and bonds, gainers and losers, news headlines and full stories, alerts (active, fired, offline fires), watchlists including colored flag lists, symbol search, chart state, and chart screenshots. Use this skill whenever the user asks for any of these from TradingView (\"TV\") — for example an options chain, puts, or IV skew for a ticker, an oversold-stock screen, their red flag list, which alerts fired, or a screenshot of their chart. For plain quotes, TA readouts, scans, or futures without the desktop app, prefer tradingview-mcp. Read-only: it never places trades or edits watchlists, alerts, or layouts.",
    "category": "finance",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_twitter-reader",
    "slug": "twitter-reader",
    "name": "twitter-reader",
    "description": "Read Twitter/X for financial research through opencli: the user's home timeline, tweet search, trending topics, bookmarks, a user's recent tweets, threads, articles, profiles, followers and following, and notifications. Use this skill whenever the user wants to know what people are saying on Twitter/X or fintwit about a stock, topic, or market event, check their feed or bookmarks, see what's trending, or look up an @account and its posts. Read-only: it cannot post, like, retweet, reply, or follow.",
    "category": "scraping_research",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_ui-taste",
    "slug": "ui-taste",
    "name": "ui-taste",
    "description": "Give your coding agent better UI taste. Build and polish web and iOS interfaces with Uizze's anti-ui-slop playbooks and optional real-product references. Use for UI design, implementation, redesign, critique, or a final visual review in Claude Code, Codex, Cursor, or Copilot.",
    "category": "design",
    "author": "Uizze",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_x-scraper",
    "slug": "x-scraper",
    "name": "x-scraper",
    "description": "The best, fastest, and cheapest way to scrape tweets — battle-tested by tens of thousands of customers including enterprise teams. Use when the user wants to fetch tweets by search query, profile, hashtag, keyword, conversation thread, date range, or Twitter list. Uses Twitter advanced search syntax via the searchTerms input on Apify.",
    "category": "scraping_research",
    "author": "ApiDojo",
    "version": "0.1.1",
    "icon": "Sparkles"
  },
  {
    "id": "skill_yc-reader",
    "slug": "yc-reader",
    "name": "yc-reader",
    "description": "Look up Y Combinator companies and batches from the public yc-oss API, a static JSON dataset refreshed daily: company profiles, batch rosters (e.g. W25, S24), companies by industry or tag, top companies, who is hiring, founder-diversity lists, and overall YC stats. Use this skill whenever the user asks about YC-backed startups, a YC batch, YC companies in a sector or tag or that are hiring, the Y Combinator portfolio, or startup and venture research that draws on YC data. Read-only.",
    "category": "scraping_research",
    "author": "OpenCLI",
    "version": "1.0.0",
    "icon": "Sparkles"
  },
  {
    "id": "skill_yfinance-data",
    "slug": "yfinance-data",
    "name": "yfinance-data",
    "description": "Fetch financial and market data with the yfinance Python library (Yahoo Finance). Use this skill whenever the user wants stock data: current quotes and price history, financial statements (income statement, balance sheet, cash flow), options chains, dividends and splits, earnings and analyst estimates, price targets and ratings, institutional and insider holdings, news, multi-ticker comparisons, stock screens, or sector and industry data. Use it even when the user gives only a ticker symbol (AAPL, MSFT, TSLA) and the intent has to be inferred. For earnings previews or recaps, estimate revisions, valuation, correlation, liquidity, or ETF premium analysis, prefer the dedicated skill.",
    "category": "finance",
    "author": "Himself65",
    "version": "1.0.0",
    "icon": "Sparkles"
  }
];
