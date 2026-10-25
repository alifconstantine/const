# Router changes and rollout

Implemented 25 October 2026. This document describes the source changes; it does not indicate that production has been deployed.

## Production incident: missing backend deployment

On 25 October 2026, production logs reported `Could not find public function` for `router/settings:getSettings`, `router/credits:getUserCredits`, and `router/gateway:authenticate`. The published Router correctly used `earnest-hawk-132`, but its Convex functions/schema had not been deployed. A Git/Vercel frontend deployment does not deploy Convex by itself.

The backend was deployed to `earnest-hawk-132` after a successful dry run confirmed schema compatibility and no deleted indexes. Authenticated administrative read checks then succeeded for settings, credits, and quota. The sidebar now consumes optional Convex results without throwing on settings/quota errors, preserves navigation, and shows an unavailable state rather than an invented quota. Regression tests cover failure, recovery, and pre-authentication subscription behavior. The global fallback keeps detailed errors in the console instead of printing backend internals to users.

For future Router changes that add backend functions or tables, complete the backend deployment before publishing the dependent frontend, then verify those functions on the production deployment.

## Model IDs and billing

The server catalog is `packages/backend/convex/router/modelCatalog.ts`, re-exported by Router. The free allowlist contains exactly:

- `deepseek-v4.1-flash:free`
- `qwen-3.8-omni-flash:free`
- `glm-5.3-flash:free`

These variants share the weekly 7M-token free allowance. Input (including cached input) and output both count. Other `:free` IDs are rejected. The corresponding IDs without the suffix are paid variants. Existing clients that want free usage must change their model IDs explicitly. Paid chat usage uses separate input, cache, and output rates from the server catalog.

Combos always stream. Their selected target determines free-quota or paid-credit settlement. Priority, random, and round-robin target ordering are supported. Tool message metadata is preserved. Disabling a combo prevents new execution.

## Coordinated deployment is required

1. Set the same cryptographically random, server-only `ROUTER_GATEWAY_SECRET` of at least 32 characters in Router and Convex. A 32-byte random hex value is suitable. Never prefix it with `NEXT_PUBLIC_` or expose it in browser configuration. The Next environment example includes the variable. Use the Convex environment editor or the interactive command below for the matching backend value:

   ```powershell
   pnpm --filter @const/backend exec convex env set ROUTER_GATEWAY_SECRET
   ```

   Explicitly select the intended development/production deployment. No secret value is committed by this change. Missing or mismatched metering configuration rejects execution; it never forwards an unmetered request.

2. Deploy the backend schema/functions and the Router together. The backend includes new request reservations, settings, hourly usage aggregates, messages and file-reference tables. Existing wallet USD values are read compatibly and converted to integer nano-USD when used. No balance is invented or reset.
3. Run the internal `router/migrations:backfillUsage` with `{}` on the selected deployment. It schedules bounded batches and marks every processed log, so restarting it does not double-count history. Old tier/cost data is marked legacy rather than inferred from today's prices. Existing logs remain accessible; historical full-text search and dashboard rollups require this backfill.
4. Run internal `router/keys:removeStoredSecrets` repeatedly until `updated` is zero, after checking users have retained their keys. Existing key hashes remain valid; the migration removes stored plaintext. New keys reveal the secret once and never persist it.
5. Verify SSO login/refresh and the real engine on the deployment. The screenshot's Credits query is protected by verified auth readiness and a local retry boundary, so loading or query failures do not replace the dashboard with a generic telemetry screen. A missing wallet returns a valid zero balance. Deployment-specific server errors still need the backend logs if they persist after rollout.

The payment simulator, fake addresses/QR codes, Router MCP routes/service/logo, and Router's unused local Composio configuration have been removed. Top-ups are explicitly unavailable until an actual payment flow is connected. Integrations UI was left for a later task.

## Data and API behavior

- Trusted gateway calls reserve and settle atomically. Settlement is idempotent and tied to a request ID, pricing snapshot, and selected model. Concurrent requests share held quota/credit. Daily key limits reset at 00:00 UTC. Per-user concurrency is 8 requests and the metered attempt rate is 60/minute.
- Idle reservations expire after four minutes; model calls have a three-minute deadline. Interrupted streams retain partial usage when observed. If a process disappears before settlement, the expiration entry is marked estimated; no unverified provider cost is manufactured.
- When an upstream omits usage, generated-text token estimates are labelled in Usage logs. Transcription reserves a conservative duration and uses engine duration when provided; otherwise it is labelled estimated. No real paid engine calls were made during verification.
- Defaults and privacy flags are stored per user and applied by the gateway. Prompt excerpts are opt-in; IP/user-agent anonymization is enabled by default. These controls apply to future logs and do not delete existing history.
- New Playground messages are separate records. Image uploads up to 5 MB and text files up to 512 KB use Convex storage references. User turns are saved before generation; partial/final responses are saved after completion or cancellation. Failed saves have a visible retry action. Revision checks prevent another tab silently overwriting a chat. Existing inline history remains readable; older inline attachments may need to be re-uploaded before continuing that conversation.
- Usage logs and transaction history are cursor-paginated. Search is server-side. Dashboard totals use hourly aggregates and recorded costs; old logs are not assigned synthetic prices.
- Docs/Endpoints share an available-endpoint registry. Responses, Messages, embeddings, TTS, music, image and video endpoints are not advertised as implemented. Removed MCP routes return 404.
- Public-page fetch checks every redirect and pins a validated public DNS address to the socket. Private/reserved networks, oversized pages and unsupported protocols are rejected.

## Validation

```powershell
pnpm --filter @const/router test
pnpm --filter @const/router check-types
pnpm --filter @const/backend check-types
pnpm --filter @const/router build
```

The tests execute actual source handlers with database/framework/upstream substitutes; they do not replace authenticated tests against a deployed Convex database. Browser fixtures use real Router view components and shared UI primitives with labelled sample data, without a production login bypass. Desktop and 390px mobile layouts, horizontal table scrolling, and model search were checked. Local HTTP smoke checks verified unauthenticated execution returns 401, public discovery works, and removed/unimplemented routes return 404.
