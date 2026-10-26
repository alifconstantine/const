---
name: context7
description: Look up current third-party library documentation and code examples through the connected Context7 MCP server.
---

Use Context7's discovered tools; tool names are namespaced by the host. Resolve the library with `resolve-library-id`, then use the returned ID with `query-docs`. Skip resolution only when the user already supplied a Context7 library ID. Include the actual task and relevant library version in the query. Read the retrieved documentation before implementing version-sensitive behavior and cite its sources when available.

If the tools are missing or authentication is required, direct the user to this plugin's connection in Settings > MCP Servers. OAuth and API key modes use different endpoints; the settings preset handles that switch. Do not invent documentation or tool responses.
