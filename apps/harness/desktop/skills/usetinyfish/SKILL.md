---
name: usetinyfish
description: >-
  Live web search, clean ad-free webpage extraction (markdown without navigation, cookies, or clutter), and multi-step browser agent automation via TinyFish (tinyfish.ai). Use when needing real-time web research, fast webpage scraping, or autonomous web navigation.
---

# TinyFish (Web Search, Scraping & Automation)

Use this skill when you need fast, high-quality web research, clean markdown extraction from complex URLs, or AI-powered browser automation using the TinyFish agent infrastructure (`https://tinyfish.ai`).

## Capabilities

1. **Clean Web Page Extraction**: Extracts raw content from web pages stripped of cookies, paywalls, popups, and navbars directly into token-efficient markdown.
2. **Real-time Live Web Search**: Queries the live web for the latest facts, technical documentation, API specs, and market information.
3. **Multi-step Web Agent**: Navigates dynamic JS-heavy websites, paginated articles, and complex web structures autonomously.

## When to Use

- When the user asks to "search the web", "look up the latest docs on X", or "scrape this website".
- When an article or URL fails with standard fetch or curl due to JavaScript rendering or cloudflare anti-bot checks.
- When you want to minimize token usage by retrieving clean markdown instead of messy raw HTML.

## MCP & API Usage

TinyFish operates through its hosted MCP endpoint:
- **MCP Server URL**: `https://agent.tinyfish.ai/mcp?source=tinyfish_cli&client=zcode`
- **Transport**: HTTP (SSE / Stream)

If the TinyFish MCP connector is enabled in your workbench, use its native tools:
- `tinyfish_web_search(query: string)`: Searches the live web.
- `tinyfish_fetch_page(url: string)`: Fetches clean markdown for any URL.
- `tinyfish_crawl(url: string, depth: number)`: Crawls linked pages.
