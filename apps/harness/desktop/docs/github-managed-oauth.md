# GitHub account connection

The GitHub plugin uses the Const Accounts OAuth broker. App ID 5490453 and the public client ID identify the Const Harness registration. The client secret is read only by Accounts server routes through GITHUB_APP_CLIENT_SECRET. No client secret is packaged in desktop, sent to renderer IPC, or stored in workspace configuration.

## Deployment

Deploy apps/accounts with the server variables from its .env.example. Set a newly generated GITHUB_APP_CLIENT_SECRET through the deployment dashboard. GITHUB_APP_CLIENT_ID, GITHUB_APP_ID and GITHUB_APP_SLUG can override the supplied public defaults. Confirm the slug matches the actual app's GitHub installation URL.

Register this exact redirect URI in the GitHub App:

    https://accounts.const.web.id/oauth/github/callback

Leave wildcard matching off and expiring user authorization tokens on. Enable the permissions needed by the GitHub tools. Users must install the GitHub App on their account/organization and select repositories to grant private repository access. The plugin's Manage repository access link opens this GitHub-controlled consent step; Connect account obtains a user token and does not silently grant repository permissions. Organization administrator approval may be required.

The server endpoints are:

- GET /oauth/github/config: public setup status; returns 503 with error=setup until the secret is configured.
- GET /oauth/github/start: starts browser authorization with the desktop's state and PKCE challenge.
- GET /oauth/github/callback: verifies the signed state and matching HttpOnly browser cookie, then redirects the code to the fixed desktop loopback callback.
- POST /oauth/github/exchange: verifies the ticket and PKCE proof, then exchanges the authorization code at GitHub.
- POST /oauth/github/refresh: refreshes a token after checking a signed receipt bound to that specific refresh token.

These routes bypass the Const sign-in callback middleware so GitHub connector codes are never consumed as Const login codes. The proxy applies its existing per-instance IP rate limit to start/exchange/refresh requests. This is a best-effort application limit; configure platform-level limits for globally enforced production throttling.

The desktop's default broker origin is https://accounts.const.web.id. For local development, set GITHUB_OAUTH_ORIGIN on Accounts and CONST_GITHUB_OAUTH_ORIGIN on the Electron process to the same loopback HTTP origin; register that development callback separately in GitHub. These overrides are developer process configuration and cannot be supplied by workspace MCP files. Desktop listens at http://127.0.0.1:24139/oauth/callback; this loopback URL is not the provider's registered HTTPS callback.

## Account lifecycle

Only the one-time authorization code and signed login ticket cross the browser redirect. Tokens are returned over HTTPS to Electron, encrypted with the existing OS vault, and excluded from public connection views. Backend routes keep no persistent access/refresh tokens and do not require an additional database. Tickets expire and are bound to the client and PKCE challenge; callback targets and upstream token endpoints are fixed. Cookies contain only a hash of the pending state. Responses are not cached; provider errors and codes are not reflected in error pages or logs.

Electron refreshes expiring tokens and retries one rejected MCP request after refresh. Concurrent requests share a refresh operation to avoid rotating the same refresh token twice. Disconnect aborts requests and clears both tokens and the refresh receipt. A late refresh cannot restore a disconnected account. Local disconnect is not provider-side token revocation. Rotate the server secret through the deployment environment when needed; rotating it invalidates old signed receipts and may require reconnecting.

Unmodified bundled GitHub packages upgrade to version 1.1.0. Empty trusted PAT configurations switch to managed OAuth. Existing PATs and manual OAuth client configurations remain available and are not overwritten.

## Verification

Run pnpm --filter @const/harness-desktop test:mcp. Tests use a local Accounts broker and a local MCP server, including real SDK initialization/tool calls, browser callback binding, invalid state, PKCE, denied consent, refresh rotation/concurrency and disconnection. No real user tokens or production client secrets are used. Actual GitHub account consent and production deployment configuration must be verified after setting the server environment.

Reference: [GitHub user access token flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
