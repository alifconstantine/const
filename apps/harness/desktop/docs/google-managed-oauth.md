# Google connectors

Seven optional, MCP-only plugin listings: Google Drive, Docs, Sheets, Slides, Gmail, Calendar and Classroom. Install a plugin globally or for a workspace, open its detail page, then **Connect account**. No user client ID, client secret, API key, environment file, service account, or MCP server installation is needed. Logos are packaged from `@thesvg/react`; the existing Blocks fallback remains unchanged.

## Accounts deployment

Use one Google Cloud **Web application** OAuth client owned by Const, separate from the Google client used for Const account sign-in. Server-only environment:

```
GOOGLE_CONNECTOR_CLIENT_ID=<Web application client ID>
GOOGLE_CONNECTOR_CLIENT_SECRET=<client secret>
```

Register exactly `https://accounts.const.web.id/oauth/google/callback` as an authorized redirect URI. No JavaScript origin is used by this flow. Optional `GOOGLE_CONNECTOR_ORIGIN` changes the canonical Accounts origin for development, requiring a matching Google redirect URI. Redeploy Accounts after changing environment variables. `/oauth/google/config` returns only readiness and public app identifiers; it never returns credentials. A missing environment configuration returns 503 `setup`.

Enable Drive API, Google Docs API, Google Sheets API, Google Slides API, Gmail API, Google Calendar API and Google Classroom API in that project's API Library. In **Google Auth Platform → Data Access**, declare the scopes below, plus `openid`, `https://www.googleapis.com/auth/userinfo.email`, and `https://www.googleapis.com/auth/userinfo.profile`. Identity scopes establish and display the shared account; they do not grant app data access.

All application scopes below have the prefix `https://www.googleapis.com/auth/`:

| Plugin    | Scope suffixes                                                                                                                                    | Initial tools                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Drive     | `drive.readonly`, `drive.file`                                                                                                                    | Search, metadata, text download/export, create, copy, rename, trash/restore              |
| Docs      | `documents`                                                                                                                                       | Get with tabs, create, batch edit text/tables/styles with optional revision control      |
| Sheets    | `spreadsheets`                                                                                                                                    | Metadata/grid, create, values read/update/append/clear, batch formatting/charts          |
| Slides    | `presentations`                                                                                                                                   | Read, create, batch edit, slide thumbnails                                               |
| Gmail     | `gmail.modify`                                                                                                                                    | Search/read, labels, UTF-8 drafts, review/send existing draft, modify labels, trash      |
| Calendar  | `calendar.calendarlist.readonly`, `calendar.events`                                                                                               | Calendar list; event list/get/create/patch/delete; explicit attendee notification option |
| Classroom | `classroom.courses`, `classroom.coursework.students`, `classroom.coursework.me.readonly`, `classroom.announcements`, `classroom.rosters.readonly` | Courses, assignments, submissions, announcements, roster; writes subject to account role |

Scopes are requested incrementally when each plugin is connected. Existing grants are carried forward, not assumed. Partial consent does not connect a plugin whose required permissions are missing. Docs/Sheets/Slides access their resource by ID; use Drive to find existing files. Drive can read/search the whole Drive but write only files created by or authorized for this app (`drive.file`). There is no Picker in this release, so an arbitrary pre-existing Drive file may not be writable. Docs/Sheets/Slides use their respective editing scopes. Classroom edits to coursework require the creating OAuth project's client, plus the appropriate teacher/domain permissions. Student access remains subject to the student's permissions. No tools permanently delete Drive files, Gmail messages, or Classroom courses.

For **External / Testing**, add every intended tester under Audience → Test users. Non-basic authorizations in Testing can have refresh tokens expire after seven days. Reconnecting is expected in that mode. Public production access requires the relevant OAuth verification. `drive.readonly` and `gmail.modify` are restricted scopes; this implementation processes Google API data through Accounts, so review Google's restricted-scope/security-assessment requirements before public release. Setting environment variables alone does not bypass Google's verification or organization-admin policies.

## Flow and account isolation

1. Electron starts the fixed loopback callback (`127.0.0.1:24139`), generates random state and an S256 PKCE verifier, and preflights Accounts configuration before opening the browser.
2. Accounts `/oauth/google/start` signs a short-lived state ticket and sets an HttpOnly, Secure, SameSite=Lax browser cookie. It sends the user to Google's fixed authorization endpoint with offline access and the selected application's scopes. A prior signed receipt carries only account/scopes metadata and a refresh-token hash, never a raw refresh token.
3. Accounts `/callback` verifies the cookie and signed state, then forwards only the authorization code and signed ticket to the fixed loopback address. Caller-supplied redirect destinations are ignored. Const sign-in middleware bypasses these connector routes and cannot consume their codes.
4. Electron POSTs the code, ticket and verifier to `/exchange`. Accounts validates PKCE, exchanges at Google's token endpoint with the server-only client secret, verifies identity through Google's fixed userinfo endpoint, checks required scopes, and returns whitelisted tokens plus a signed refresh receipt. An incremental connection cannot replace an existing account with a different Google subject.
5. Electron encrypts a shared account in OS safeStorage. Plugin configurations contain no tokens or account email. A local encrypted reference links each connected plugin to the account for its scope. Different workspaces and the global scope have different vault keys. Workspace overrides never copy a global account's credentials.
6. Electron initializes the appropriate `/mcp/google/{app}` endpoint and discovers tools through the MCP SDK. Only then does the browser callback show success, remove sensitive query parameters and attempt to close itself; the desktop regains focus. Browser restrictions may require manually closing the tab.
7. All seven apps share single-flight refresh per account. `/refresh` verifies the receipt against the exact refresh token and account identity. Google commonly omits a new refresh token; the old one is retained. A failed refresh requires reconnection. Cancellation/config changes/disconnection prevent late responses from restoring deleted credentials.

Disconnecting one app removes its local reference and disables that connection. Other linked apps remain available. Disconnect the last linked app to delete the shared account from this desktop. To change accounts, disconnect all Google apps in that scope, or connect the other account in a separate workspace. Local disconnection does not revoke Google's project-wide grant, which might be used by another scope/device; users can revoke it in their Google Account permissions page.

## REST-to-MCP adapter

Accounts exposes a stateless Streamable HTTP adapter over the official Google REST APIs, avoiding dependence on Google's Workspace MCP Developer Preview. The seven tool sets are distinct: a Docs connection cannot invoke Gmail tools. Only fixed API hosts and paths are supported; user-provided IDs are encoded as individual path segments. No arbitrary HTTP proxy, caller-supplied authorization headers, or external URL fetch tool is exposed. API redirects are refused.

The server does not persist user tokens, API results, email, or MCP sessions. It necessarily processes tokens and requested Google data in memory while forwarding calls. Responses use no-store; malformed/oversized requests are rejected and provider bodies are not reflected in failure messages. A provider 401 triggers one managed refresh/retry; writes with uncertain network results are not automatically retried. Pagination tokens are exposed so the agent can request subsequent pages. Text/JSON outputs are capped at 2 MB server-side and subject to the desktop's existing tool-output limits. Binary downloads/attachments are not part of this release. Thumbnails return Google's short-lived URL; the server does not download it.

Gmail creates drafts with the authenticated sender profile, validates recipients, and encodes subject/body as UTF-8 MIME. Sending is a distinct tool that uses an existing reviewed draft. Calendar attendee emails default to `sendUpdates=none`. Every tool still passes through the desktop's existing MCP approval layer; Google resource permissions are enforced by Google.

## Validation

`pnpm --config.verify-deps-before-run=false --filter @const/harness-desktop test:mcp` covers signed state/cookies, PKCE, denied/partial consent, account pinning, refresh receipts, seven real MCP SDK connections with a simulated Google provider, shared refresh, workspace isolation, independent disconnect, delayed-refresh cancellation, REST request mapping, Gmail MIME/header handling, bounded responses and fixed destinations. It does **not** prove live Google consent, Vercel environment readiness, Cloud API activation or public verification; test a real account and a disposable resource per app after deployment.

Primary references: [Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Classroom scopes](https://developers.google.com/workspace/classroom/guides/auth), [Classroom coursework project ownership](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/create), [OAuth verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
