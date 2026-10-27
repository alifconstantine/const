# Remote control, phase 1

Open the account menu → Remote Control → Start. The desktop creates a local HTTP
listener on an OS-assigned port, bound to one private IPv4 interface. Scan the QR
with a phone on the same trusted network. The phone opens a small pairing page
served by that listener and establishes a WebSocket connection. Closing the dialog
keeps the session running; Stop, logout, account switching, closing the desktop
window, or renderer failure revokes it.

This phase provides the desktop daemon, QR dialog, pairing shell, and agent event
bridge. The full mobile workspace, starting/sending agent prompts from mobile,
remote approvals, and internet access are future work. The pairing shell only
displays connection status; it does not render conversations yet.

## Transport and authorization

- LAN HTTP/WS is **not encrypted**. Use a trusted network. No TLS or internet relay
  is claimed by the UI. An HTTPS website cannot reliably connect to this plaintext
  socket; the QR therefore points to the desktop's own HTTP origin.
- A 256-bit random bearer key is carried in the URL fragment, omitted from the
  pairing HTTP request, and removed from browser history by the pairing page.
  Anyone with the QR/link can access conversations and the supported commands.
- Pairing credentials expire for new connections after 15 minutes. Existing
  connections remain active. Refresh replaces the session/key and immediately
  disconnects all clients. Stop also closes the listener.
- Host and browser Origin checks precede the WebSocket upgrade. There is no wildcard
  CORS or unauthenticated status endpoint. At most four clients may connect.
- Commands have runtime schemas and 64 KiB message limits. Heartbeats remove dead
  clients; slow consumers are disconnected rather than buffered indefinitely.
- Starting the listener requires the main desktop renderer's IPC, never a guest
  browser frame. The listener is off by default.

## Protocol

Connect to the `localBridgeUrl` returned by the desktop status IPC, with `session`
and `key` query parameters obtained from the QR. After `handshake:ack`, send JSON:

```json
{"type":"state:get","requestId":"1"}
{"type":"conversation:get","requestId":"2","payload":{"conversationId":"..."}}
{"type":"agent:abort","requestId":"3","payload":{"conversationId":"...","runId":"..."}}
{"type":"agent:answer-question","requestId":"4","payload":{"toolCallId":"...","runId":"...","answer":{}}}
```

Replies use `{type: "response", requestId, payload}`. `state:get` includes running
conversation IDs and their run IDs. Mutating commands require the matching current
run ID so stale clients cannot affect replacement runs. Transport errors use
`{type: "error", error: "CODE"}` without exposing exception details.

Agent events use `{type: "agent:stream-event", conversationId, runId, event}`;
session lifecycle events use `agent:session-started` / `agent:session-ended`.

## Next architecture step

For access across networks, add an authenticated HTTPS/WSS relay. The desktop
should establish an outbound connection, with expiring one-time pairing grants,
device authorization/revocation, account/workspace scoping, and encrypted transport.
Reuse desktop conversation components through a shared mobile client that consumes
the same typed command/event protocol. Do not expose this LAN listener to the
internet or change the QR to an external `/r/...` route before the relay exists.

## Verification

```sh
pnpm --filter @const/harness-desktop test:remote
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-desktop build
pnpm --filter @const/harness-desktop test:startup
```
