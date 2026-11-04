# QRIS credit payments

Router and Harness use prepaid USD credit for all managed models and utility endpoints. Retired `:free` IDs are rejected. Existing quota records and free request metadata remain only for historical and in-flight settlement; no new requests receive a weekly allowance.

On Credits (also `/deposit`), users choose $1–$500 in USD and pay an IDR invoice using SumoPod QRIS. The rate is shown before checkout and copied into the order. Amounts use integer USD cents, nano-USD ledger values, and integer rupiah rounded upward. Const covers the gateway fee; the user receives the full USD credit purchased. Adjust the purchase limits and fee policy if your merchant agreement requires different values.

## Configuration required before accepting payments

Set these in the **Convex deployment's environment**, not the browser or Router's public environment:

- `SUMOPOD_API_KEY`: project API key.
- `SUMOPOD_IDR_PER_USD`: your selling exchange rate, a positive integer in IDR per USD. No live exchange-rate feed or automatic exchange-rate adjustment is assumed. Review this rate when currency prices change.
- `SUMOPOD_WEBHOOK_SECRET`: project signing secret (`whsec_…`), preferred. Or `SUMOPOD_WEBHOOK_TOKEN` (`whtok_…`) for the documented token verification alternative. When both are supplied, signatures are required.
- `ROUTER_PUBLIC_URL`: HTTPS console URL, defaults to `https://router.const.web.id`.

The provided API key is saved only in the ignored `packages/backend/.env.local`. This local file does not set the deployment's runtime environment. No signing secret/token or selling exchange rate has been supplied yet. Checkout stays disabled until the required deployment configuration is complete.

In SumoPod Settings, configure the webhook URL as:

```
https://<your-convex-deployment>.convex.site/payments/sumopod/webhook
```

Use the HTTP Actions URL (`.convex.site`), not the `.convex.cloud` client URL. Enable completed, failed, and expired events and send a test event. Deploy the backend schema/functions and Router UI together, then create and pay a small real invoice. Confirm the wallet and deposit ledger update once; resend that webhook and confirm no second credit. A real paid transaction has not been performed during implementation.

## Reconciliation

Only verified webhook completion credits the wallet. Return URLs never grant credit. Signature verification uses the original request body, accepts rotated v1 signatures, and enforces a five-minute timestamp window. Replays and duplicate completion events cannot credit twice because order state, deposit ledger, and wallet update commit in one Convex mutation.

Each order stores user, amount, conversion rate, and expected payment identity. Mismatched IDs, amounts, and statuses are rejected. Failed or expired events do not deduct credit. Completion may arrive after expiry; a verified completed payment still grants the purchased credit. Later failed/expired notifications cannot undo a completed deposit.

Checkout requests use a client request ID and are limited to five new orders per user per 15 minutes. If the provider times out or returns an ambiguous response, the order stays in “Confirming checkout” and retrying the same request never sends a second provider request. The supplied API docs contain no payment lookup/cancellation endpoint: reconcile such orders in the SumoPod dashboard and resend its authenticated webhook. Automatic polling of SumoPod or invoice cancellation is not claimed.

Recent payment status and wallet balance update through Convex subscriptions. The payment link opens in a new tab, so the console remains available while the user pays. A payment is marked expired locally when its recorded expiry passes.

## Verification

```
pnpm --filter @const/router test
pnpm --filter @const/router check-types
pnpm --filter @const/backend check-types
pnpm --filter @const/harness-desktop test:models
pnpm --filter @const/harness-desktop test:updates
pnpm --filter @const/harness-desktop check-types
pnpm --filter @const/harness-mobile check-types
```

The tests use synthetic provider responses and signing secrets and never issue a live payment.
