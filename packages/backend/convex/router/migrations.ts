import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
// Run only during the coordinated backend rollout. Existing prices/tier are never guessed.
export const backfillUsage = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("routerLogs")
      .paginate({ numItems: 100, cursor: args.cursor ?? null });
    for (const log of batch.page) {
      if (log.rollupVersion === 1) continue;
      const bucketAt = Math.floor(log.createdAt / 3600000) * 3600000,
        keyName = log.keyName ?? "Account session";
      const bucket = await ctx.db
        .query("routerUsageBuckets")
        .withIndex("by_identity", (q) =>
          q
            .eq("userId", log.userId)
            .eq("bucketAt", bucketAt)
            .eq("model", log.resolvedModel ?? log.model)
            .eq("keyName", keyName)
            .eq("tier", log.billingTier ?? "legacy"),
        )
        .unique();
      const data = {
        userId: log.userId,
        bucketAt,
        model: log.resolvedModel ?? log.model,
        provider: log.provider,
        keyName,
        tier: log.billingTier ?? "legacy",
        requests: (bucket?.requests ?? 0) + 1,
        successes: (bucket?.successes ?? 0) + (log.status < 400 ? 1 : 0),
        promptTokens: (bucket?.promptTokens ?? 0) + log.promptTokens,
        completionTokens:
          (bucket?.completionTokens ?? 0) + log.completionTokens,
        cachedTokens: (bucket?.cachedTokens ?? 0) + (log.cachedTokens ?? 0),
        totalTokens: (bucket?.totalTokens ?? 0) + log.totalTokens,
        costNanoUsd: (bucket?.costNanoUsd ?? 0) + (log.costNanoUsd ?? 0),
        durationMs: (bucket?.durationMs ?? 0) + log.durationMs,
        ttftSum: (bucket?.ttftSum ?? 0) + (log.ttftMs ?? 0),
        ttftCount:
          (bucket?.ttftCount ?? 0) + (log.ttftMs === undefined ? 0 : 1),
      };
      if (bucket) await ctx.db.patch(bucket._id, data);
      else await ctx.db.insert("routerUsageBuckets", data);
      await ctx.db.patch(log._id, {
        rollupVersion: 1,
        searchText: [log.requestId, log.model, log.provider, log.keyName]
          .filter(Boolean)
          .join(" "),
      });
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.router.migrations.backfillUsage,
        { cursor: batch.continueCursor },
      );
    return { processed: batch.page.length, done: batch.isDone };
  },
});
