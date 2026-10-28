# Plugins and MCP: sessions 0–3

Implemented 2026-10-26. This document describes Const Harness, not the OpenAI plugin directory.

## Package and runtime

The existing filesystem plugin registry now accepts skills, inline `mcpServers`, or both. A skill `entrypoint` is optional; if supplied it must exist. `placeholder: true` permits the empty Const Guide listing. Arbitrary package `ui` declarations remain metadata. The Excalidraw update below adds a sandboxed MCP Apps host for tool-returned resources. Existing HyperFrames and Computer Use packages remain compatible.

Default plugins: Const Guide, Plugins Creator, Skills Creator, Browser Use, and Computer Use. Guide contains no skill or documentation. Default initialization is tracked in `~/.const/harness/default-plugins.json`, so a user uninstalling or disabling a default does not have it silently re-enabled on restart. Browser and computer tools also honor the existing native settings and OS permissions. Global plugin switches and the native settings switches update the same preference. HyperFrames remains opt-in; its runtime is not assumed to be installed.

Context7 and TinyFish are opt-in packages. Both use direct remote MCP; Composio is not an infrastructure dependency. Tool schemas come from the connected server, including paginated discovery and tool-list change notifications. Opaque names bind calls to a specific connection and exact upstream tool name. MCP dispatch runs before the legacy connector name matching, avoiding accidental routing of documentation tools to Google/Composio.

Main Electron owns MCP clients, local stdio subprocesses, and OAuth. Renderer IPC can list public configuration and write secret inputs, but cannot read tokens, header values, or environment values. Settings and plugin connection cards use the same service. Agent runs, scheduled tasks, and permitted child agents receive the same external tool adapter. Restricted child agents do not receive MCP tools.

MCP calls use the existing permission mode. In review/ask modes, calls require approval, including servers claiming their tools are read-only; server annotations cannot grant authorization. Full-access runs retain their existing behavior. Scope, plugin enablement, and configuration identity are checked again at execution time.

## Configuration and credentials

- Global public configuration: `~/.const/harness/mcp.json`.
- Workspace public configuration: `<workspace>/.const/mcp.json`.
- Credentials: `~/.const/harness/mcp-secrets.json`, encrypted with Electron safeStorage; unavailable or plaintext Linux storage backends are refused.
- Approved configuration fingerprints: `~/.const/harness/mcp-trust.json`.

Workspace configuration with the same logical key overrides global configuration, including an explicitly disabled override. The UI's workspace override action creates a separate connection with no copied credentials. An unavailable workspace account never falls back to the global account. Editing a URL, command, transport, client ID, or scope invalidates the prior credential binding. Repository-edited connection settings must be reviewed and saved in Settings before automatic use; merely checking out a project cannot launch its commands or redirect saved credentials.

HTTP supports no auth, bearer API keys, additional headers, and MCP OAuth discovery with dynamic registration or a supplied client ID. Optional scopes and a client secret can be configured. Discovery uses the SDK rather than guessed authorization endpoints. OAuth binds a loopback callback to `127.0.0.1:24139/oauth/callback`, validates state and issuer when advertised, and uses PKCE. One interactive OAuth flow runs at a time. Cancel, timeout, shutdown, and configuration changes clean up the flow. Explicit endpoint overrides for nonstandard authorization servers and tunnels are not implemented.

Local stdio uses a command, JSON argument array, optional absolute working directory, and encrypted environment variables. Provider authentication for stdio belongs in environment variables; generic HTTP bearer/OAuth modes do not apply. Never put secrets in URLs, command arguments, or committed workspace files.

Disabling a connection preserves its saved credentials. Disconnect clears its OAuth tokens/bearer key and disables it. This is local disconnection, not provider-side token revocation. Removing a custom connection removes its locally stored credentials. Plugin-owned primary connections are managed through their plugin; they become unavailable when the plugin is disabled or absent.

Local clients and pending initialization are closed on configuration changes and application exit. Failures have a short automatic retry cooldown; explicit Test connection retries immediately. Chat cancellation stops waiting for discovery and cancels in-flight tool calls. Discovery itself is shared with other chats and may finish in the background. Images are passed through the existing tool-observation path; other results are bounded text/structured data.

## Providers and logos

Obsidian and Figma setup and verification are described in [Obsidian and Figma](obsidian-and-figma.md). Obsidian adds the `builtin` MCP transport for Const's local vault adapter; it starts no subprocess and opens no listening port.

Sources consulted:

- [MCP TypeScript SDK client auth](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x/src/client).
- [Context7 client setup](https://context7.com/docs/resources/all-clients): OAuth at `https://mcp.context7.com/mcp/oauth`; API key mode at `https://mcp.context7.com/mcp`. Tools are discovered rather than hardcoded.
- [TinyFish MCP](https://docs.tinyfish.ai/mcp-integration): `https://agent.tinyfish.ai/mcp`, OAuth or bearer key. The packaged skill uses current tool names such as `search`, `fetch_content`, and `run_web_automation`. The older standalone skill is not used by the plugin.
- [theSVG](https://thesvg.org/): use packaged `@thesvg/react` brand assets when available; the installed release has no Context7/TinyFish exports, so these currently use Blocks. Const Guide uses the existing Const logo. Creator, browser, and computer plugins use Blocks as requested. HyperFrames uses its packaged SVG.

## Verification and next sessions

`pnpm --filter @const/harness-desktop test:mcp` exercises encrypted storage boundaries, scope precedence, credential invalidation, real SDK HTTP and stdio calls, and a local OAuth authorization server with DCR, PKCE and invalid-state rejection. No paid provider calls or user credentials are involved.

Registry and approval tests include MCP-only/placeholder packages, all bundled manifests, native disablement, external dispatch, and permission modes. `test:plugins:preview` serves `tests/plugins.html` for browser UI verification. That fixture explicitly simulates connections and does not establish provider/account access.

User-account OAuth and authenticated Context7/TinyFish calls remain pending until an account is connected in the product. Next integrations can reuse the manifest, configuration store, credential vault, and agent adapter. Full plugin UI hosting belongs to the later UI session.

Both hosted provider endpoints were probed without credentials and returned HTTP 401 with an OAuth challenge. This establishes endpoint availability, not successful account authorization. The broader existing subagent suite has three unrelated baseline failures (role normalization, notice wording, concurrency limit); these were reproduced with the original subagent source and are outside this change.

The focused verification set passes 81 agent/registry/approval/native-tool tests, 10 MCP/default-plugin tests, and 7 installer tests. Desktop typecheck and production build pass. Browser fixture checks covered the plugin listing and Const logo, Context7 auth-mode switching, custom connection creation, tool preview, and English/Indonesian rendering. Source dictionaries also include Japanese, Chinese, and Spanish.

## Session 3 and OAuth completion (2026-10-27)

Rebased onto the upstream marketplace/detail-page update. Plugin account controls live in the detail page's MCP tab. Listing cards show authentication requirements, effective connection state, and the most recent successful connection time. Settings > Plugins uses the same detail page as Marketplace. Global/workspace installation scope is selectable; workspace MCP overrides remain available in Settings > MCP Servers.

The loopback callback now returns a localized completion page after token exchange and tool discovery succeed. Failures return a failure page. It removes callback query parameters from browser history and attempts to close the tab, with a visible fallback when the browser prevents script-driven closing. The app is focused after a successful user-initiated login. Callback responses are not cached, never include authorization codes/tokens, and have a restrictive CSP. The HTTP response can finish before the callback server's connections are closed.

Successful connection times are recorded in user-local mcp-state.json with a configuration fingerprint; runtime timestamps are not written into workspace files. Endpoint/client/auth changes invalidate the displayed history.

New opt-in packages:

- GitHub: official remote endpoint https://api.githubcopilot.com/mcp/, bearer PAT by default, optional OAuth with a registered client. No local runtime required. The fine-grained PAT is entered through Edit > Access token/API key, encrypted in the OS-backed vault. A registered OAuth client is necessary because remote GitHub does not support dynamic registration. [GitHub host integration guide](https://github.com/github/github-mcp-server/blob/main/docs/host-integration.md).
- Canva (initial Sesi 3, superseded by the hosted preset below): official remote endpoint https://api.canva.com/connect/v1/mcp. Register a Canva app, start Outside Canva integration, enable Canva MCP, and set the loopback redirect URI shown by Const's OAuth settings. Enter client ID and secret through Edit > Advanced; credentials are user-provided for this initial release, not bundled Const-wide credentials. Public distribution with a developer-owned confidential client should use a backend token exchange. [Canva access](https://www.canva.dev/docs/apps/mcp/access/), [quickstart](https://www.canva.dev/docs/apps/quickstart/).

The initial Sesi 3 packages included workflow skills; version 1.0.1 below removes them. Executable tool schemas are discovered from their servers. Missing registered client IDs disable the account-connect action and show a setup link. GitHub and Canva logos use the installed @thesvg/react exports. Real GitHub/Canva account authorization remains unverified without user-provided credentials; local OAuth and UI fixtures are explicitly simulated.

Focused verification now includes 13 MCP tests (including success/failure callback responses, PKCE, cancellation, secret boundaries, and local-only history), plus the 81 agent tests and 7 installer tests. See google-workspace-oauth-research.md for the prerequisite decision before sessions 4 and 5.

## Simpler account setup (2026-10-27)

GitHub and Canva 1.0.1 are MCP-only plugins. There is no skill to fill in or maintain. MCP-only detail pages open directly on the MCP tab; listing cards show an MCP count instead of zero included skills. OAuth connections without credentials show Connect account as the primary action and do not show a redundant unauthenticated Test connection action.

Canva now uses https://mcp.canva.com/mcp with the SDK's discovery, automatic client registration, PKCE and loopback flow. No client ID/secret is requested from the user. Public metadata on Canva's own host advertises a registration endpoint and public-client authentication. An actual registration request with Const's exact loopback callback returned HTTP 201 and token_endpoint_auth_method=none. This validates registration acceptance, not successful user consent or a real design tool call. No client IDs from other products or hardcoded fallback registrations are reused. [Canva OAuth metadata](https://mcp.canva.com/.well-known/oauth-authorization-server), [Canva MCP overview](https://www.canva.dev/solutions/mcp/).

Untouched bundled v1 packages are upgraded in place when their inventory is loaded. The old skills are archived inside the package outside the active skills directory; customized packages are left alone. An empty, trusted old Canva connection is moved to the hosted endpoint. Saved accounts, custom clients, headers, scopes, enablement, and workspace choices are preserved.

GitHub's PAT path remains optional. Managed OAuth using the Const-owned app is now implemented; deployment requires the Accounts server environment described in github-managed-oauth.md. For browser login without asking users for credentials, register one GitHub App/OAuth app for Const and exchange confidential-client credentials through the Const account backend. A separate device-flow option can use a public client ID without a client secret, but still needs a registered app and typically a user code confirmation. [GitHub OAuth flows](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

Google's developer registration is likewise a publisher task, not end-user onboarding. The target UI is Connect Google followed by browser consent; ordinary users do not enter .env values or create Cloud projects. Keep manual credentials in custom MCP/advanced settings. Google-specific code remains unimplemented. The later managed GitHub OAuth update adds the Accounts callback, token exchange, and refresh endpoints; see github-managed-oauth.md.

Verification: 16 MCP/migration tests, existing bundled-registry checks, and desktop typecheck. Real provider account authorization remains pending.

## Seven managed Google apps (2026-10-27)

Google Drive, Docs, Sheets, Slides, Gmail, Calendar and Classroom are now optional MCP-only plugins with packaged logos and localized descriptions. Each plugin has Connect account in its detail page. Accounts provides the confidential Web OAuth callback/exchange/refresh and seven distinct REST-to-MCP endpoints, with a shared encrypted Google account per global/workspace scope and incremental app permissions. This supersedes the earlier unimplemented Google notes. See [Google deployment, scopes and limitations](google-managed-oauth.md).

## Main Chat audit (2026-10-27)

The production Main Chat and scheduled-task factories supply `McpService.tools` and `McpService.execute` to the native agent. Tools refresh every model round, respect installed/enabled/effective plugin scope and local trust, and dispatch before legacy Google/Canva/Composio aliases. The Electron build resolves the agent source directly, so these callbacks do not depend on a stale published agent bundle.

The harness supplies 64 native functions. When connected MCP definitions exceed 64, the service exposes `mcp_search_tools` and `mcp_call_tool` instead of sending an oversized function list to model providers. Search returns matching tool schemas from available connections; execution still uses the exact opaque tool name and checks current workspace, enablement and trust. Searching tool definitions does not require approval. Execution retains the existing approval policy, including denial and full-access mode. Small catalogs continue exposing direct tool functions.

The audit fixed stale MCP sessions after transport errors (including HTTP 404), repeated GitHub 401s leaving a connection marked connected, and an incremental Google consent race with background refresh. Uncertain failed tool actions are never automatically replayed. Expired MCP sessions are rediscovered for a subsequent explicit action; revoked accounts wait for user reconnection. A Google Connect account click can recover revoked saved credentials by continuing to browser consent on that same click.

Harness chats with a managed MCP handler reject undeclared legacy Google/Canva connector aliases instead of falling through to a different account gateway or a placeholder success response. Explicitly configured legacy tools for other clients retain their existing behavior.

`electron/mcp/main-chat.test.ts` drives the real native agent loop, approval engine, MCP SDK and Google REST adapter through all nine GitHub/Canva/Google plugins. It verifies schemas in the model request, per-call approval, denial without provider execution, full access, returned tool observations in the next model request, and a large catalog using all 64 native functions plus deferred discovery. Provider, model and storage responses are fixtures. This is not evidence of real user consent or permission to every live repository, document or organization resource.

## Excalidraw and MCP Apps (2026-10-27)

Excalidraw is an optional MCP-only plugin using the official `https://mcp.excalidraw.com` endpoint, with no account, API key, local MCP installation, or bundled skill. Enable it in Plugins, then ask Main Chat to draw a diagram. The native agent discovers `read_me` and `create_view` from the provider. Existing approval modes still govern model tool calls.

The result appears as an interactive card in the assistant message. **Open editor** opens the bundled Excalidraw editor in the existing right pane. Its editable file is `<workspace>/artifacts/diagrams/<app-id>.excalidraw`, automatically saved after changes. The workspace is the actual conversation execution directory, including the configured session directory for chats outside a project. SVG, PNG, and native file export use the desktop's normal download flow. Initial generation and checkpoint synchronization contact the hosted provider; the bundled local editor remains usable when that provider is disconnected.

App bindings and initial checkpoint/source are durable under `~/.const/harness/mcp-apps/`. The renderer normalizes the provider's skeleton elements with the official library and materializes the native file when the card first renders. A background result whose card has not rendered yet retains its source/binding, but its advertised native file path is reserved until then. Saved cards reopen the latest local scene, and `mcp_read_app_context` lets the agent read user edits in the same workspace before revising a diagram. Unregistered existing `.excalidraw` files retain the ordinary file preview.

The main process advertises the MCP Apps extension and preserves tool resource metadata. HTML resources execute in an opaque-origin `allow-scripts` iframe with explicit CSP, no Electron preload, no parent DOM, and no unrestricted filesystem or network bridge. App-only tools stay unavailable to model execution. The first app bridge permits only Excalidraw checkpoint reads bound to the current result, own-checkpoint saves, bounded context updates, and share exports following host confirmation. Creating a public Excalidraw link requires a separate confirmation; the native editor itself saves locally. Disabling or modifying the provider invalidates remote access without deleting saved diagrams.

`electron/mcp/apps.test.ts` covers real native agent/MCP routing, approvals, durable app references, resource discovery, hidden-tool isolation, workspace isolation, image preservation, file bounds, symlink rejection, and local editing after disconnect. The optional `tests/excalidraw.live.ts` sends only a synthetic public-provider diagram and produces fixture data for `/tests/diagrams.html`; it requires no account. Browser QA covers cold iframe initialization, native editor, autosave/reopen, preview updates, localization, and the three export formats. No user account or private document is needed for these checks.
