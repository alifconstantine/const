# Google Workspace: prerequisites before sessions 4 and 5

Researched 2026-10-27. This is a decision record; Google plugins and a hosted OAuth service have not been implemented.

## Recommendation for Const

Register one developer-owned Google Cloud project and OAuth application for Const. End users click Connect Google, sign in in their system browser, and grant access. They do not create Cloud projects or edit environment files. An environment file is one development configuration mechanism, not an OAuth requirement.

For a product integration using Google's remote Workspace MCP servers, use a Const backend for confidential-client credentials and token exchange. Keep client secrets off the shipped desktop bundle. The desktop starts a short-lived login session with state and PKCE; the backend completes Google consent through a registered HTTPS callback and returns only a single-use result bound to that desktop session. The desktop must never accept arbitrary callback tokens or exchange another user's login result. Store credentials per account and scope; retain the existing global/workspace availability controls. Whether the backend also proxies MCP calls or returns a user-bound access token is a separate implementation decision. No hosted service is required by the generic custom-MCP feature.

This is an architecture recommendation derived from Google's documented confidential web-client setup and the security properties of distributed desktop apps, not a claim that Google requires every desktop integration to have a backend.

## Two valid integration paths

| Path                                 | Developer setup                                                                                                                                    | End-user setup             | Tradeoff                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Official remote Workspace MCP        | Cloud project, product APIs and MCP services, eligible preview access, OAuth consent, registered client; confidential credentials on Const backend | Connect Google and consent | Reuses Google's tools, but currently gated by Developer Preview and needs compatibility testing        |
| Google REST APIs via a Const adapter | Cloud project, Drive/Docs/Sheets/Slides APIs, Desktop OAuth client, consent, public client configuration shipped with the app, PKCE and loopback   | Connect Google and consent | Can keep tokens local and avoid a confidential-client backend; Const must implement and maintain tools |

The [official MCP setup guide](https://developers.google.com/workspace/guides/configure-mcp-servers) currently requires Developer Preview membership and enabling the corresponding services. Its documented product-client examples create a Web application client ID/secret, select “Use this client for an AI-powered agent,” and register the host's callback. Do not assume a generic Desktop client works against these MCP endpoints without testing. Google also requires access_type=offline for refresh tokens; an offline_access scope alone is insufficient. Generic Const OAuth does not yet expose provider authorization parameters, so this must be addressed in the Google-specific implementation.

The [desktop OAuth guide](https://developers.google.com/identity/protocols/oauth2/native-app) documents public desktop clients, system-browser consent, loopback redirects, and PKCE. A generated desktop client secret cannot be kept confidential. This supports the REST-adapter alternative, not an assumption of remote-MCP compatibility.

## What the Const developer needs to prepare

1. A Google Cloud project owned by the intended Const publisher, with the relevant APIs enabled. For official MCP, confirm Developer Preview access and enable the corresponding MCP services too.
2. OAuth branding, support/contact email, audience, and consent scopes. Add designated test accounts while developing. Prepare a publisher domain and public privacy policy for [production brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
3. Choose the path above. For remote MCP with a confidential client, provision the Const auth backend and HTTPS callback before generating its client credentials. For REST, create a Desktop app client and package public configuration through the normal release/configuration process.
4. Choose file access deliberately. Start with files created or explicitly selected by the user where practical. drive.file is recommended and non-sensitive; drive.readonly and broad Drive access are restricted. Review the additional verification requirements before offering whole-Drive search. [Drive scope guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
5. Test login, cancellation, denied consent, token refresh, revoked access, multiple accounts, workspace overrides, and a real read/write operation before labeling the integration ready.

Keep four plugin listings (Drive, Docs, Sheets, Slides), with a shared Google account layer. Separate listings do not require four developer projects. Request only permissions the implemented features need; verify each MCP server's accepted token scopes/resource audience before reusing account credentials across servers.

Suggested order: first settle registration and hosting, then session 4 (Drive + Docs), then session 5 (Sheets + Slides). Bring-your-own OAuth client fields in Settings can support personal development without .env, but are not the recommended onboarding experience for ordinary users. Composio remains an optional provider, not a required platform dependency.
