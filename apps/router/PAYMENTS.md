# QRIS credit payments

Router and Harness use prepaid USD credit for all managed models and utility endpoints. Retired `:free` IDs are rejected. Existing quota records and free request metadata remain only for historical and in-flight settlement; no new requests receive a weekly allowance.

On Credits (also `/deposit`), users choose $1–$500 in USD and pay an IDR invoice using SumoPod QRIS. The rate is shown before checkout and copied into the order. Amounts use integer USD cents, nano-USD ledger values, and integer rupiah rounded upward. Const covers the gateway fee; the user receives the full USD credit purchased. Adjust the purchase limits and fee policy if your merchant agreement requires different values.

## Configuration required before accepting payments

Set these in the **Convex deployment's environment**, not the browser or Router's public environment:

- `SUMOPOD_API_KEY`: project API key.
- `SUMOPOD_WEBHOOK_SECRET`: project signing secret (`whsec_…`), preferred. Or `SUMOPOD_WEBHOOK_TOKEN` (`whtok_…`) for the documented token verification alternative. When both are supplied, signatures are required.
- `ROUTER_PUBLIC_URL`: HTTPS console URL, defaults to `https://router.const.web.id`.

Payment credentials are stored in the ignored `packages/backend/.env.local` and configured separately in the Convex production environment. Never commit their values. Checkout stays disabled when any required deployment configuration is missing.

Production configuration was activated on 2026-11-04 for `earnest-hawk-132`, matching the backend used by `router.const.web.id`.

## Automatic USD/IDR reference rate

The server checks [Frankfurter's blended USD/IDR endpoint](https://api.frankfurter.dev/v2/rate/USD/IDR) every hour. This is a daily reference rate, not an intraday market feed. The public blended API supports commercial SaaS billing without an API key; see [its documentation](https://frankfurter.dev/). No customer data is sent to the rate provider.

The singleton `routerExchangeRates` cache updates subscribed checkout screens. Rates are rounded up to whole rupiah (less than Rp1 per USD), and the final invoice total is rounded up to whole rupiah. No extra exchange-rate margin is added. Presets are $1, $5, $10 and $25; custom purchases remain $1–$500.

After deploying, initialize the cache with `pnpm --filter @const/backend exec convex run router/exchangeRates:refresh '{}' --deployment earnest-hawk-132`. The hourly cron maintains it. `SUMOPOD_IDR_PER_USD` is no longer used. Checkout is disabled until the first successful fetch, after 26 hours without a successful fetch, or if the reference observation is over seven days old (allowing weekends and holidays). Invalid responses never overwrite the last valid rate. The server rechecks freshness and the displayed rate when creating an invoice; changed quotes require review. Existing invoices and retries keep their original amount even if the feed is unavailable.

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

Recent payments keeps a **Continue payment** link for every pending, unexpired invoice, including after the console reloads. Paid, failed and expired invoices have no payment action. An invoice still being created after two minutes is shown as **Needs review**; this is an uncertain checkout, not proof that payment failed. Reconcile it before creating a replacement.

Live SumoPod responses verified on 2026-11-04 return hosted checkout URLs at `https://checkout.pymnt.app/payment-links/…`, whereas the Quick Start example uses `https://pay.sumopod.com/pay/…`. The hosted page can also provide a direct checkout URL at `https://checkout.pymnt.app/<uuid>`. Validation accepts these two exact origins and their payment paths, and rejects lookalike hosts, credentials and other paths. Amount, order, optional currency, expiry, status and fee reconciliation are still checked. An unpaid live diagnostic invoice was created to verify this response format; no payment was made or credit granted.

Historical orders missing their response URL require merchant-provided order-to-link mapping. After checking the hosted checkout's amount, currency, pending status and `SUMOPAY-<payment_id>` reference, an operator can use internal `attachPayment` to restore the corresponding link and payment ID. Do not guess missing fee metadata; recovery allows it to remain absent. Bound the restored expiry to the original 24-hour invoice window. Recovery only restores access to the checkout; signed webhook completion remains required to grant credit.

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

The QRIS section has its own query error boundary so unavailable checkout functions cannot hide the account balance or transaction history. Deploy the backend before the matching frontend when adding new payment queries.
