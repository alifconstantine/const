import { ConvexError } from "convex/values";

export const MIN_CREDIT_CENTS = 100;
export const MAX_CREDIT_CENTS = 50_000;
export function checkoutConfig(rate: number | null = null) {
  const idrPerUsd =
    typeof rate === "number" &&
    Number.isSafeInteger(rate) &&
    rate > 0 &&
    rate <= 1_000_000
      ? rate
      : null;
  const origin = process.env.ROUTER_PUBLIC_URL || "https://router.const.web.id";
  let validOrigin = false;
  try {
    validOrigin = new URL(origin).protocol === "https:";
  } catch {
    /* Configuration error. */
  }
  return {
    available: Boolean(
      idrPerUsd &&
      validOrigin &&
      process.env.SUMOPOD_API_KEY &&
      (process.env.SUMOPOD_WEBHOOK_SECRET || process.env.SUMOPOD_WEBHOOK_TOKEN),
    ),
    idrPerUsd,
    minCreditCents: MIN_CREDIT_CENTS,
    maxCreditCents: MAX_CREDIT_CENTS,
    returnUrl: validOrigin ? new URL("/credits", origin).href : "",
  };
}
export function quotePayment(creditCents: number, idrPerUsd: number) {
  if (
    !Number.isSafeInteger(creditCents) ||
    creditCents < MIN_CREDIT_CENTS ||
    creditCents > MAX_CREDIT_CENTS
  )
    throw new ConvexError("Choose a credit amount between $1 and $500.");
  if (
    !Number.isSafeInteger(idrPerUsd) ||
    idrPerUsd <= 0 ||
    idrPerUsd > 1_000_000
  )
    throw new ConvexError("Checkout exchange rate is unavailable.");
  return {
    amountIdr: Math.ceil((creditCents * idrPerUsd) / 100),
    creditNanoUsd: creditCents * 10_000_000,
  };
}
export function isPaymentLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://pay.sumopod.com" &&
      url.pathname.startsWith("/pay/") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
/** Verify the exact raw bytes and reject stale signatures. Prefer signatures when configured. */
export async function verifyPaymentWebhook(
  headers: Headers,
  raw: string,
  now = Date.now(),
) {
  const secret = process.env.SUMOPOD_WEBHOOK_SECRET;
  if (!secret) {
    const token = process.env.SUMOPOD_WEBHOOK_TOKEN;
    return Boolean(token && equal(token, headers.get("x-webhook-token") || ""));
  }
  const id = headers.get("svix-id"),
    timestamp = headers.get("svix-timestamp"),
    signatures = headers.get("svix-signature");
  if (
    !id ||
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !signatures ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) =>
        c.charCodeAt(0),
      ),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${id}.${timestamp}.${raw}`),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return signatures
      .split(" ")
      .some(
        (signature) =>
          signature.startsWith("v1,") && equal(signature.slice(3), expected),
      );
  } catch {
    return false;
  }
}
