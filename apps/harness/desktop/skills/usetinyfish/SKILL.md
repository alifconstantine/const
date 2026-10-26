---
name: usetinyfish
description: Search the web, extract page content, and run user-directed browser workflows through a connected TinyFish MCP server.
---

# TinyFish

This skill supplies workflow instructions, not a server connection. Connect the TinyFish plugin or add its hosted MCP server in Settings > MCP Servers first. The official endpoint is `https://agent.tinyfish.ai/mcp`; authenticate using the server's OAuth flow or a configured API key. Never put credentials in URLs or skill files.

Use tool names and schemas discovered from the connected server. Const namespaces those names by connection. Current upstream names include:

- `search`: find relevant web pages.
- `fetch_content`: read and extract page content without an interactive browser run.
- `run_web_automation`: perform a specific browser workflow when clicking, navigation, or forms are required.
- `run_web_automation_async` and `get_run`: start and check longer workflows.
- `cancel_run`: cancel a run when requested.

Choose the smallest operation that completes the user's task. Use saved profiles only for the requested account and workflow. Verify terminal status and the actual result before reporting completion. Do not initiate broad crawling, recurring monitors, payments, or unrelated account actions without the corresponding user request.

When a tool is missing, inspect the available connection rather than fabricating a name or result. Report authentication and provider failures accurately. Consult [official TinyFish MCP documentation](https://docs.tinyfish.ai/mcp-integration) for current capabilities.
