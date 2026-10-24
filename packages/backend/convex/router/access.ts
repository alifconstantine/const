import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export const DAY_MS = 86_400_000;
export const dayStart = (now = Date.now()) => Math.floor(now / DAY_MS) * DAY_MS;
export async function hashKey(key: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function keyUsageToday(
  key: {
    dailyPeriodStartAt?: number;
    lastUsedAt?: number;
    usedTodayTokens: number;
  },
  now = Date.now(),
) {
  return (key.dailyPeriodStartAt ?? dayStart(key.lastUsedAt ?? 0)) ===
    dayStart(now)
    ? key.usedTodayTokens
    : 0;
}

export async function resolveIdentity(
  ctx: QueryCtx | MutationCtx,
  rawApiKey?: string,
) {
  if (rawApiKey) {
    const keyHash = await hashKey(rawApiKey.trim());
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
    if (!key || key.status !== "active" || !(await ctx.db.get(key.userId)))
      throw new ConvexError("Invalid or revoked API key");
    return { userId: key.userId, key };
  }
  const userId = await getAuthUserId(ctx);
  if (!userId || !(await ctx.db.get(userId)))
    throw new ConvexError("Unauthorized");
  return { userId, key: null };
}

export function requireGatewaySecret(secret: string) {
  const expected = process.env.ROUTER_GATEWAY_SECRET;
  if (!expected || expected.length < 32 || secret.length !== expected.length)
    throw new ConvexError("Gateway unavailable");
  let different = 0;
  for (let i = 0; i < expected.length; i++)
    different |= expected.charCodeAt(i) ^ secret.charCodeAt(i);
  if (different !== 0) throw new ConvexError("Unauthorized gateway");
}
