import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { resolveIdentity } from "./access";
import { getManagedModel } from "./modelCatalog";
import { DEFAULT_SETTINGS } from "./preferences";
export const getSettings = query({
  args: { rawApiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx, args.rawApiKey);
    const saved = await ctx.db
      .query("routerSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return saved
      ? {
          defaultModel: saved.defaultModel,
          defaultTemperature: saved.defaultTemperature,
          enableStreaming: saved.enableStreaming,
          logPayloads: saved.logPayloads,
          anonymizeTelemetry: saved.anonymizeTelemetry,
          notifyLowQuota: saved.notifyLowQuota,
        }
      : DEFAULT_SETTINGS;
  },
});
export const saveSettings = mutation({
  args: {
    defaultModel: v.string(),
    defaultTemperature: v.number(),
    enableStreaming: v.boolean(),
    logPayloads: v.boolean(),
    anonymizeTelemetry: v.boolean(),
    notifyLowQuota: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    const combo = args.defaultModel.startsWith("combo/")
      ? await ctx.db
          .query("routerCombos")
          .withIndex("by_user_slug", (q) =>
            q.eq("userId", userId).eq("slug", args.defaultModel.slice(6)),
          )
          .unique()
      : null;
    if (
      getManagedModel(args.defaultModel)?.category !== "llm" &&
      (!combo || combo.status !== "active")
    )
      throw new Error("Select an available chat model or active combo");
    if (
      !Number.isFinite(args.defaultTemperature) ||
      args.defaultTemperature < 0 ||
      args.defaultTemperature > 2
    )
      throw new Error("Temperature must be between 0 and 2");
    const saved = await ctx.db
      .query("routerSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const data = { ...args, userId, updatedAt: Date.now() };
    if (saved) await ctx.db.patch(saved._id, data);
    else await ctx.db.insert("routerSettings", data);
    return { success: true };
  },
});
