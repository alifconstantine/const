import { query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { resolveIdentity } from "./access";
import { NANO_USD } from "./modelCatalog";

export const getUserCredits = query({
  args: { rawApiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx, args.rawApiKey);
    const wallet = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const balance =
      wallet?.balanceNanoUsd ??
      Math.round((wallet?.balanceUsd ?? 0) * NANO_USD);
    const reserved = wallet?.reservedNanoUsd ?? 0;
    return {
      balanceUsd: balance / NANO_USD,
      availableUsd: (balance - reserved) / NANO_USD,
      reservedUsd: reserved / NANO_USD,
      totalDepositedUsd: wallet?.totalDepositedUsd ?? 0,
      totalSpentUsd:
        (wallet?.totalSpentNanoUsd ??
          Math.round((wallet?.totalSpentUsd ?? 0) * NANO_USD)) / NANO_USD,
      isAuthenticated: true,
      topUpAvailable: false,
    };
  },
});
export const getCreditTransactions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    return ctx.db
      .query("creditTransactions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(50, args.paginationOpts.numItems),
      });
  },
});
// Internal ledger entry point; no public deposit or simulation mutation.
export const creditAdjustment = internalMutation({
  args: {
    userId: v.id("users"),
    amountNanoUsd: v.number(),
    reference: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.amountNanoUsd) || args.amountNanoUsd <= 0)
      throw new Error("Invalid adjustment");
    const existing = await ctx.db
      .query("creditTransactions")
      .withIndex("by_request", (q) => q.eq("requestId", args.reference))
      .unique();
    if (existing) return { success: true };
    if (!(await ctx.db.get(args.userId))) throw new Error("User not found");
    const wallet = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const balance =
      (wallet?.balanceNanoUsd ??
        Math.round((wallet?.balanceUsd ?? 0) * NANO_USD)) + args.amountNanoUsd;
    const deposited =
      (wallet?.totalDepositedUsd ?? 0) + args.amountNanoUsd / NANO_USD;
    if (wallet)
      await ctx.db.patch(wallet._id, {
        balanceNanoUsd: balance,
        balanceUsd: balance / NANO_USD,
        totalDepositedUsd: deposited,
        updatedAt: Date.now(),
      });
    else
      await ctx.db.insert("userCredits", {
        userId: args.userId,
        balanceNanoUsd: balance,
        balanceUsd: balance / NANO_USD,
        totalDepositedUsd: deposited,
        totalSpentUsd: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      requestId: args.reference,
      type: "bonus",
      amountNanoUsd: args.amountNanoUsd,
      amountUsd: args.amountNanoUsd / NANO_USD,
      balanceAfterUsd: balance / NANO_USD,
      paymentMethod: "Account adjustment",
      status: "completed",
      description: args.description,
      createdAt: Date.now(),
    });
    return { success: true };
  },
});
