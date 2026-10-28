# Obsidian and Figma

These optional MCP-only plugins use the existing plugin inventory, settings, approval engine and native Main Chat tool adapter. Neither includes a placeholder skill. Packaged logos come from the installed `@thesvg/react` library.

## Obsidian

Install/enable Obsidian in Plugins, open its MCP tab, and choose an existing vault folder containing `.obsidian`. The folder dialog is owned by the desktop main process. Cancellation makes no change. A settings edit or disablement while the picker is open invalidates the pending selection. The resulting connection is immediately tested through the actual MCP SDK.

No publisher OAuth app, API key, community plugin, Python/Node installation, or running Obsidian process is required. This is a **Const-owned local vault adapter**, not an official hosted Obsidian MCP service. [Obsidian vaults are local folders](https://obsidian.md/help/vault). The official CLI is an alternative for live-app features, but requires enabling it and running Obsidian; this adapter deliberately works directly with Markdown notes.

Results are saved directly to the selected vault as `.md` notes. Main Chat can list notes, read paginated content, search literal text, create/replace notes, append text, and inspect outgoing links/backlinks. Read/write results include the real local file path. The adapter preserves Markdown/frontmatter text rather than executing Dataview, templates or other plugin code. It does not control the active Obsidian window, Canvas, Bases, Sync or Publish.

The `builtin` transport uses an in-process MCP SDK server and linked transports. It starts no child process or network listener. The vault path participates in the configuration trust fingerprint. Generic custom MCP connections cannot impersonate the bundled adapter. A workspace override starts without a selected vault and never falls back to the global vault. Disabling the plugin or connection removes its tools on the next discovery round and prevents subsequent dispatch.

Writes require a fresh whole-file SHA-256 `expectedHash` when the note already exists. New notes use exclusive creation, and updates use a temporary file and rename after rechecking the current content. This detects stale edits and avoids partially written notes; it does not provide a distributed filesystem transaction against arbitrary external writers. The adapter exposes Markdown only, rejects traversal/device names/hidden folders, and refuses symlinks, junctions and hardlinks. Limits: 1 MB per note, 10,000 entries per scan, 32 levels, 32 MB searched, bounded result pages. It provides no delete tool.

## Figma

### Desktop mode (default)

This uses Figma's official local MCP endpoint, `http://127.0.0.1:3845/mcp`, with no Const OAuth configuration. The user must:

1. Have a Figma plan and Dev/Full seat eligible for the desktop server.
2. Open a design in Figma Desktop, enter Dev Mode, and enable the desktop MCP server.
3. Leave Figma Desktop running, then test the connection in Const.

The server exposes design-reading tools according to Figma's actual discovery response. Desktop mode does **not** support writing to the canvas or sending UI to Figma. [Official desktop setup and limitations](https://developers.figma.com/docs/figma-mcp-server/local-server-installation/).

### Remote mode and publisher setup

The connection selector can switch to the official `https://mcp.figma.com/mcp` endpoint with OAuth and `mcp:connect`. It never silently switches between endpoints or reuses credentials for a different endpoint.

**This is not yet a public one-click remote connection for Const.** Figma's current documentation limits remote access to registered/catalog MCP clients and asks new client developers to apply for access. Const's publisher must obtain approval before enabling remote OAuth for ordinary users. Registering an arbitrary Figma REST OAuth app is not evidence of MCP-client approval. [Official remote setup](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/), [MCP catalog](https://www.figma.com/mcp-catalog/).

For an approved private pilot, the existing advanced OAuth settings accept the approved client ID and, when required, client secret. They remain in the existing encrypted credential store. The current loopback redirect is `http://127.0.0.1:24139/oauth/callback`. Confirm this redirect and client authentication method with Figma when requesting approval. Do not ship a shared confidential client secret in the desktop binary: if Figma requires shared confidential credentials, a managed Accounts exchange/refresh broker is a separate prerequisite for public one-click release. Approval does not automatically supply or implement that broker. Ordinary users should not create developer apps or fill desktop environment variables.

The remote Connect account button remains disabled until an approved client ID is configured. The UI explains the publisher prerequisite and offers independent Desktop mode. Never impersonate another catalog client or copy another application's OAuth credentials.

## Verification

- `electron/mcp/obsidian.test.ts`: local Markdown behavior, pagination/search/links, concurrent edits, filesystem boundaries, real in-process MCP, vault selection/cancellation, workspace isolation and legacy fingerprint compatibility.
- `electron/mcp/design-notes-chat.test.ts`: real native agent, MCP SDK and approval routing for Figma Desktop + Obsidian; allow/deny cases; publisher gating for remote Figma. Figma and model responses are fixtures; actual user accounts are not accessed.
- `tests/plugins.html`: simulated UI fixture for vault selection, Figma modes, setup guidance, disabled remote auth and localization.

Public Figma OAuth metadata was inspected without credentials: its protected-resource document declares `https://api.figma.com` as the authorization server and `mcp:connect`; authorization-server metadata declares PKCE S256 and client-secret basic/post token authentication. No approved Const client or real Figma account was available for live authorization, and no claim of completed remote access is made.
