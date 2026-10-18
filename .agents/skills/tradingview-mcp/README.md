# tradingview-mcp

Read-only, headless TradingView market data through the bundled [tradingview-mcp](https://github.com/atilaahmettaner/tradingview-mcp) server. It uses TradingView scanner data and Yahoo Finance without requiring the TradingView desktop app or an account.

## What it does

- Technical analysis and multi-timeframe alignment
- Exchange-wide gainers, losers, squeeze, candle, and volume scans
- Futures overviews, category snapshots, and overnight movers
- Regular and extended-hours quotes
- US options chains and volume/OI unusual-activity scans (no greeks)
- Nine-strategy and walk-forward backtests
- Global market and Bitcoin snapshots
- Optional Marketaux-powered news and sentiment

All 39 bundled MCP tools are annotated read-only. The skill never places trades or changes an account.

## When to choose the desktop reader instead

Use [`tradingview-reader`](../tradingview-reader/) for per-strike greeks, detailed IV skew, account watchlists and alerts, TradingView news, chart state, or screenshots. It requires the logged-in macOS desktop app and the opencli adapter.

## Installation

```bash
# Choose finance-data-providers when the plugin installer prompts.
npx plugins add himself65/finance-skills

# Or install only this Agent Skill.
npx skills add himself65/finance-skills --skill tradingview-mcp
```

Restart the agent after enabling the plugin so its bundled MCP server is loaded.

## Requirements

- `uv` / `uvx` (`brew install uv` on macOS)
- Python 3.10–3.13
- Optional `MARKETAUX_API_TOKEN` for news and sentiment tools

The first call downloads the pinned server and dependencies, so it can take about 30 seconds. Subsequent starts use the local `uv` cache.

## Upstream pin

The plugin pins an immutable upstream Git SHA in [`../../.mcp.json`](../../.mcp.json). Maintainers should upgrade the SHA deliberately: pick a reviewed commit, update the pin, run a real MCP initialize + `tools/list` handshake, confirm every tool is still read-only, and reconcile the tool catalog in `SKILL.md` with the registered tool names and schemas before release.
