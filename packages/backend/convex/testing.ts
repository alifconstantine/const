import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Helper internal mutation to quickly clear all authentication and user data
 * for fast testing and QA cycles.
 * Run via terminal with admin deployment auth: `pnpm clear-auth`
 *
 * CRITICAL SECURITY FIX: Must remain internalMutation so it CANNOT be invoked by public clients.
 */
export const clearAuthData = internalMutation({
  args: {
    confirm: v.optional(v.boolean()),
  },
  handler: async (ctx) => {
    const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
    if (deployment.startsWith("prod:")) {
      throw new Error("clearAuthData is strictly prohibited in production deployments.");
    }

    const tablesToClear = [
      "users",
      "authAccounts",
      "authSessions",
      "authVerificationCodes",
      "authRefreshTokens",
      "authVerifiers",
      "authRateLimits",
      "rateLimits",
      "apiKeys",
      "userProviders",
    ] as const;

    let totalDeleted = 0;
    for (const table of tablesToClear) {
      try {
        const docs = await ctx.db.query(table as any).collect();
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
          totalDeleted++;
        }
      } catch (err) {
        // Table may not exist yet if unused
      }
    }

    return { success: true, deletedRecords: totalDeleted };
  },
});
