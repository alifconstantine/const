---
name: tinyfish
description: Search the web, extract pages, or perform a user-directed browser workflow with TinyFish's hosted MCP tools.
---

Use tools actually discovered from the connected TinyFish server; names are namespaced by Const. Prefer `search` for discovery and `fetch_content` for reading pages. Use `run_web_automation` only when interaction is needed. For long tasks, use the server's async run tools and verify terminal status before reporting completion. A started run is not a completed task.

Keep access and mutations within the user's specified workflow. Use saved profiles only when appropriate to the user's requested account. Return sourced findings or the actual run result, including failures. Do not start monitors, payments, or broad crawling unless requested. If no tools are connected, direct the user to Settings > MCP Servers. Never fabricate tool names, account state, or successful results.
