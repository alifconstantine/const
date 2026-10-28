# Harness remote control

The desktop account menu opens the horizontal Remote Control dialog. Start creates
an authenticated relay session and a QR link to
`https://harness.const.web.id/r/<sessionId>#key=...`. The browser signs in through
Accounts with the same Const account as the desktop. No public desktop port or
same-Wi-Fi requirement is needed for this transport.

## Architecture

- `packages/remote`: shared command validation, AES-GCM envelopes, browser client,
  and five-language mobile copy.
- `packages/backend/convex/remote.ts`: authenticated realtime mailbox, device
  grants, atomic command claims, presence, expiration, and cleanup.
- `electron/remote-relay.ts`: outbound Convex connection, command dispatch and
  batched streaming. Agent prompts share the desktop `runAgent` execution path.
- `apps/harness/web/src/app/r/[sessionId]`: responsive remote workspace. It reuses
  Radix controls, ScrollArea, branding and the user message surface from `@const/ui`.
- The old LAN daemon remains available for transport regression tests. The desktop
  Start action now selects the encrypted internet relay.

## Pairing and privacy

Both endpoints authenticate as the session owner on every broker operation. A QR
key alone does not authorize another Const account. A separate host capability
prevents a paired browser from impersonating the desktop. Per-tab device grants
are stored in sessionStorage and are revoked on Disconnect. Desktop Stop,
refresh, logout, account switching, renderer failure and window close revoke the
host session. Local shutdown remains bounded even if the network is unavailable.

A random 256-bit key stays in the QR fragment and endpoint session memory/storage.
The page removes pairing and callback credentials from the URL immediately.
AES-GCM encrypts commands, replies and events before upload, binding each packet
to its session, direction and request ID. The broker sees account/device metadata,
timing and ciphertext, but receives no conversation decryption key. HTTPS/WSS
also protects transport. This does not protect against a compromised endpoint.

Pairing expires after 15 minutes; existing grants remain valid for the session's
8-hour lifetime. Heartbeats run every 15 seconds; clients show the desktop offline
after 45 seconds without a heartbeat. Refresh replaces the session and all grants.

Commands are atomically claimed once. Request receipts persist until session
cleanup; ciphertext responses expire after five minutes. Old queued commands
cannot execute after 60 seconds. Bounded event replay triggers a fresh snapshot
when a sequence gap is detected. An uncertain prompt submission is never silently
resent: the draft and target conversation survive reconnect so the user can inspect
whether it was received. Expired sessions and relay packets are cleaned up by
scheduled backend jobs.

## Mobile behavior

The header contains hamburger, one Run/Context/Usage button, conversation actions,
and panel. It has no conversation title. The chat occupies the middle and AI Input
stays above the keyboard/safe area. A first visit opens an unsaved No project draft;
returning restores this tab's last conversation. Desktop/mobile navigation remains
independent. Drafts are scoped to each conversation.

Supported: conversation history and search, projects, sending prompts/model
selection, streaming output, stop, question answers, allow-once/deny approvals,
rename/archive, context/usage, activity panel, language/theme/account menus, and
read-only Scheduled/Marketplace lists. New remote runs use ask-before-changes mode.

Current bounds: bootstrap contains the 100 most recent conversations; a conversation
snapshot includes up to 80 recent messages within 150 KiB plus bounded live output.
Scheduled/Marketplace editing, file editing/attachments, full desktop sidepanel
tabs, and automatic token refresh are not provided by this mobile version. An
expired login returns the user to Accounts; existing backend authority is always
checked again.

## Configuration and rollout

Use the same Convex deployment for Accounts, desktop and web:

- Desktop: `VITE_CONVEX_URL`; built-in production fallback is
  `https://earnest-hawk-132.convex.cloud`.
- Desktop QR origin: `HARNESS_REMOTE_WEB_ORIGIN`, default
  `https://harness.const.web.id`.
- Web: `NEXT_PUBLIC_CONVEX_URL` (same production fallback), and optionally
  `NEXT_PUBLIC_ACCOUNTS_URL` (default `https://accounts.const.web.id`).

Deploy backend functions/indexes with `pnpm --filter @const/backend exec convex deploy`.
Build/deploy `apps/harness/web` using the public variables above, preserving its
existing landing/download routes. A Git push alone is not evidence of a successful
hosting rollout. Rebuild/restart the desktop after updating source.

## Verification

```sh
pnpm --filter @const/backend test:remote
pnpm --filter @const/backend check-types
pnpm --filter @const/harness-web check-types
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-web build
pnpm --filter @const/harness-desktop test:remote
pnpm --filter @const/harness-desktop build
pnpm --filter @const/harness-desktop test:startup
```

`pnpm --filter @const/harness-desktop test:remote:preview` starts the isolated mobile
fixture at `http://127.0.0.1:5198/tests/remote-mobile-preview.html`. It uses synthetic
data and does not contact Accounts, the production relay or a model. Broker tests
exercise account boundaries and encryption; the host/browser transport integration
test runs both real endpoint classes against an in-memory broker.
