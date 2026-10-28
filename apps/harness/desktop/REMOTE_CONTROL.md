# Harness remote control

The desktop account menu opens the horizontal Remote Control dialog. Start creates
an authenticated relay session and a QR link to
`https://harness.const.web.id/r/<sessionId>#key=...`. The web client signs in through
Accounts with the same Const account as the desktop. No public desktop port or
same-Wi-Fi requirement is needed.

## Shared desktop and web UI

The remote client mounts the actual desktop `AuthenticatedContent`, sidebar,
ChatCard, AI Input, Search, Scheduled Tasks, Marketplace, Settings and RightPane.
`vite.remote.config.ts` builds a browser renderer into the web app's generated
`public/remote` directory; Next loads it on `/r/[sessionId]`. Generated bundles are
ignored by Git and built during the web build, including filtered hosting builds.

`src/lib/desktop-bridge.ts` creates the same preload API for Electron and the web.
Electron supplies native IPC; `remote-desktop-transport.ts` supplies encrypted RPC,
run proofs, bounded request concurrency, snapshot/event sequencing and ordered
terminal input. The host dispatches an explicit capability allowlist through the
existing desktop handlers. Arbitrary IPC, native window controls, host login and
new pairing operations are unavailable to the remote transport.

Desktop web branding shows the logo and connected host. Mobile uses the same
sidebar as an overlay, compact chat and AI Input above the keyboard/safe area.
Its header has hamburger, separate Session statistics / Context window / Token
usage controls, the native task action menu and sidepanel toggle. The same tab
chooser offers Review, Terminal, Side chat, Browser and Trajectory. UI navigation
is independent per device; conversation data and run events come from the host.
The first visit opens a No project draft; revisiting restores the tab's selection.

Directory picking and opening host folders use the web's existing Directory
preview. Local media resolves through encrypted file RPC rather than a public
file server. BrowserTab keeps its native controls and uses bounded, ephemeral
host screenshots (approximately every 1.5 seconds when visible) with forwarded
human input, pausing concurrent AI control. This is a frame-based browser surface;
it does not embed the remote page's DOM. Touch keyboard input and the browser
inspector's element-picker/console forwarding still need dedicated mobile work.
OS-native window actions, update installation and host account authentication
remain native operations. Automatic login-token refresh is not implemented;
expired authentication returns the client to Accounts.

## Architecture and access

- `packages/remote`: command capabilities, validation, AES-GCM envelopes, bounded
  multipart transfers, browser client, authentication and five-language gate copy.
- `packages/backend/convex/remote.ts`: account ownership, grants, atomic claims,
  ciphertext mailbox/chunks, presence, expiration and cleanup.
- `electron/remote-relay.ts`: outbound host connection and encrypted event relay.
- `electron/remote-desktop-controller.ts`: remote validation and synchronization
  boundary before the registered native handler runs.
- `electron/desktop-ipc.ts`: native handler registry and allowlisted event fan-out.

Pairing grants control of the desktop workspace, including chats, files,
terminals, scheduled jobs, plugins and settings. Pair only trusted devices. The
full workspace grant intentionally allows host file access and terminal execution;
it is not a read-only viewer or a project sandbox. Agent permission prompts still
use the existing desktop permission mode and run-specific approval handling.

Both endpoints authenticate as the session owner on broker operations. A QR key
alone cannot authorize another Const account. A separate host capability prevents
a paired browser from impersonating the desktop. Device grants are scoped to a
tab and revoked on Disconnect. Desktop Stop, refresh, logout/account switching,
renderer failure and window close revoke the host session. Crashed hosts with
stale heartbeats do not consume the active session limit indefinitely.

A random 256-bit key remains in the QR fragment and endpoint session storage.
The page scrubs pairing/callback credentials from the URL. AES-GCM binds each
command, response, event and transfer part to its session, direction and request
ID. The broker receives ciphertext and routing/timing metadata, without the key.
HTTPS/WSS also protects transport. Compromised endpoints are outside this model.
The web renderer's conversation cache is tab/session scoped. Settings responses
mask credentials and masked saves retain host secrets. Chat inline HTML is
sanitized, remote conversation IDs cannot traverse directories, stale run actions
are rejected, and stale browser checkpoints preserve newer host output.

Pairing expires after 15 minutes; existing grants last up to the session's 8-hour
lifetime. Heartbeats run every 15 seconds; missing heartbeats mark a host offline.
Commands are claimed once and unclaimed work expires after 60 seconds. Claimed
long runs may finish later; response expiry starts on completion. Recent completed
responses are ordered by completion time so long runs remain observable. Session
and ciphertext cleanup is scheduled. Sequence gaps reconnect and hydrate the host
snapshot; uncertain submissions are not automatically repeated.

Transfers are limited to 8 MiB of JSON, compressed and split into authenticated
encrypted parts with bounded decompression. Individual media reads are capped at
5.5 MB to allow base64 overhead. Sidebar lists contain metadata, not all chat
transcripts; selecting a chat loads its full bounded transfer. History search runs
on the host SQLite database and returns bounded matching snippets.

## Configuration and rollout

Use the same Convex deployment for Accounts, desktop and web:

- Desktop: `VITE_CONVEX_URL`; production fallback is
  `https://earnest-hawk-132.convex.cloud`. Local environment file loading is
  development-only.
- QR origin: `HARNESS_REMOTE_WEB_ORIGIN`, default `https://harness.const.web.id`.
- Web: `NEXT_PUBLIC_CONVEX_URL` and optionally `NEXT_PUBLIC_ACCOUNTS_URL`, default
  `https://accounts.const.web.id`.

Deploy the backend before the new web renderer. Run the web build from its
workspace so the shared renderer is generated. Rebuild/restart the native desktop
and generate a fresh QR session after upgrading; an older running host does not
have the new desktop RPC bridge. Git push alone does not establish hosting success.

## Verification

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @const/backend test:remote
pnpm --filter @const/backend check-types
pnpm --filter @const/harness-web check-types
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-web build
pnpm --filter @const/harness-desktop test:remote
pnpm --filter @const/harness-desktop test:markdown
pnpm --filter @const/harness-desktop test:mcp
pnpm --filter @const/harness-desktop test:browser
pnpm --filter @const/harness-desktop exec tsx --test electron/remote-database.test.ts
pnpm --filter @const/harness-desktop build
pnpm --filter @const/harness-desktop test:startup
```

`test:remote:preview` starts the actual shared desktop renderer with synthetic
IPC/profile data at `http://127.0.0.1:5198/tests/remote-workspace.html`. It does not
contact Accounts, production relay or a model. Broker tests cover account/device
boundaries, replay, expiration and chunk ownership. Transport tests run both real
endpoint classes against an in-memory broker and exercise large encrypted payloads.
Controller tests cover host secrets, capability rejection, run proofs, checkpoint
preservation and ID traversal; adapter tests cover native API shapes, snapshot
stream deduplication, event fragmentation and ordered terminal input. Authenticated
physical-phone end-to-end behavior requires a live paired desktop session.
