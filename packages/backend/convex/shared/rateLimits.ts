import { mutation } from "../_generated/server";
import { v } from "convex/values";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_WINDOW_MINUTES = 10;

/**
 * Enforces rate limiting on sensitive actions (e.g. Resend magic links).
 * Rule: Maximum 3 attempts per 10 minutes per identifier.
 * Parameters are strictly enforced server-side to prevent client bypass.
 */
export const checkAndConsumeRateLimit = mutation({
  args: {
    key: v.string(),
    maxAttempts: v.optional(v.number()),
    windowMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Server enforces hard bounds: client cannot raise limits beyond server defaults
    const maxAttempts = Math.min(args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);
    const windowMinutes = Math.max(args.windowMinutes ?? DEFAULT_WINDOW_MINUTES, DEFAULT_WINDOW_MINUTES);
    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();

    const normalizedKey = args.key.toLowerCase().trim();

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", normalizedKey))
      .unique();

    if (existing) {
      if (now < existing.resetAt) {
        if (existing.attempts >= maxAttempts) {
          const retryAfterMinutes = Math.max(1, Math.ceil((existing.resetAt - now) / 60000));
          const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
          return {
            allowed: false,
            attempts: existing.attempts,
            maxAttempts,
            retryAfterMinutes,
            retryAfterSeconds,
            message: `Too many requests. For your security, you can only request ${maxAttempts} sign-in emails per ${windowMinutes} minutes. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? "s" : ""}.`,
          };
        }

        // Increment attempt count within active window
        const nextAttempts = existing.attempts + 1;
        await ctx.db.patch(existing._id, {
          attempts: nextAttempts,
        });

        return {
          allowed: true,
          attempts: nextAttempts,
          remaining: maxAttempts - nextAttempts,
          message: null,
        };
      }

      // Window expired, start new window
      await ctx.db.patch(existing._id, {
        attempts: 1,
        resetAt: now + windowMs,
      });

      return {
        allowed: true,
        attempts: 1,
        remaining: maxAttempts - 1,
        message: null,
      };
    }

    // First attempt recorded
    await ctx.db.insert("rateLimits", {
      key: normalizedKey,
      attempts: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      attempts: 1,
      remaining: maxAttempts - 1,
      message: null,
    };
  },
});
