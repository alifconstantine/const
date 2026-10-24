import { mutation, query, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import {
  resolveIdentity,
  requireGatewaySecret,
  keyUsageToday,
  dayStart,
} from "./access";
import { calculateQuotaState } from "./quotas";
import { DEFAULT_SETTINGS } from "./preferences";
import { getManagedModel, tokenCostNano, NANO_USD } from "./modelCatalog";

function fail(message: string, status: number): never {
  throw new ConvexError({ message, status });
}
function count(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000_000)
    fail("Invalid usage value", 400);
  return value;
}

export const authenticate = query({
  args: { rawApiKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, key } = await resolveIdentity(ctx, args.rawApiKey);
    if (
      key?.dailyLimitTokens &&
      keyUsageToday(key) +
        (key.dailyPeriodStartAt === dayStart()
          ? (key.reservedTokens ?? 0)
          : 0) >=
        key.dailyLimitTokens
    )
      fail("Daily API key limit reached", 429);
    const settings = await ctx.db
      .query("routerSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return { userId, settings: settings ?? DEFAULT_SETTINGS };
  },
});

export const begin = mutation({
  args: {
    secret: v.string(),
    rawApiKey: v.optional(v.string()),
    requestId: v.string(),
    model: v.string(),
    requestedModel: v.string(),
    comboName: v.optional(v.string()),
    promptTokens: v.number(),
    maxOutputTokens: v.number(),
    units: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireGatewaySecret(args.secret);
    const { userId, key } = await resolveIdentity(ctx, args.rawApiKey);
    const model = getManagedModel(args.model);
    if (!model) fail("Unknown model or unavailable free variant", 400);
    const spec = model!;
    const prompt = count(args.promptTokens);
    let output = count(args.maxOutputTokens);
    if (prompt + output > (spec.contextLength ?? 1_000_000))
      fail("Request exceeds model context window", 400);
    const existing = await ctx.db
      .query("routerRequests")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (existing) fail("Request ID already exists", 409);
    const pending = await ctx.db
      .query("routerRequests")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "pending"),
      )
      .take(9);
    if (pending.length >= 8) fail("Too many concurrent requests", 429);
    const now = Date.now();
    const rateKey = "router:" + userId;
    const rate = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", rateKey))
      .unique();
    if (rate && now < rate.resetAt && rate.attempts >= 60)
      fail("Request rate limit reached; retry in one minute", 429);
    if (rate)
      await ctx.db.patch(rate._id, {
        attempts: now < rate.resetAt ? rate.attempts + 1 : 1,
        resetAt: now < rate.resetAt ? rate.resetAt : now + 60000,
      });
    else
      await ctx.db.insert("rateLimits", {
        key: rateKey,
        attempts: 1,
        resetAt: now + 60000,
      });
    const keyPeriod = dayStart(now);
    const keyUsed = key ? keyUsageToday(key, now) : 0;
    const keyReserved =
      key && (key.dailyPeriodStartAt ?? keyPeriod) === keyPeriod
        ? (key.reservedTokens ?? 0)
        : 0;
    if (key?.dailyLimitTokens) {
      const remaining = key.dailyLimitTokens - keyUsed - keyReserved;
      if (remaining <= prompt) fail("Daily API key limit reached", 429);
      output = Math.min(output, remaining - prompt);
    }
    let periodStartAt: number | undefined;
    if (spec.tier === "free") {
      const doc = await ctx.db
        .query("userQuotas")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const state = calculateQuotaState(doc, now);
      if (state.remainingTokens <= prompt)
        fail(
          "Weekly free token quota exceeded. Select a paid model or wait for reset.",
          429,
        );
      output = Math.min(output, state.remainingTokens - prompt);
      periodStartAt = state.periodStartAt;
      const values = {
        userId,
        weeklyLimitTokens: state.weeklyLimitTokens,
        usedTokens: state.usedTokens,
        reservedTokens: state.reservedTokens + prompt + output,
        usedImages: state.usedImages,
        weeklyLimitImages: state.weeklyLimitImages,
        periodStartAt,
        periodEndAt: state.periodEndAt,
        updatedAt: now,
      };
      if (doc) await ctx.db.patch(doc._id, values);
      else await ctx.db.insert("userQuotas", { ...values, createdAt: now });
    }
    const utilityCost =
      spec.category !== "llm"
        ? Math.ceil(
            Number(spec.pricing?.input.replace("$", "") ?? 0) *
              (args.units ?? 1) *
              NANO_USD,
          )
        : 0;
    const reservedNanoUsd =
      spec.tier === "free"
        ? 0
        : spec.category === "llm"
          ? tokenCostNano(args.model, prompt, output)
          : utilityCost;
    if (!Number.isSafeInteger(reservedNanoUsd) || reservedNanoUsd < 0)
      fail("Invalid reservation", 400);
    if (reservedNanoUsd > 0) {
      const wallet = await ctx.db
        .query("userCredits")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const balance =
        wallet?.balanceNanoUsd ??
        Math.round((wallet?.balanceUsd ?? 0) * NANO_USD);
      if (!wallet || balance - (wallet.reservedNanoUsd ?? 0) < reservedNanoUsd)
        fail("Insufficient credits for this request", 402);
      await ctx.db.patch(wallet._id, {
        balanceNanoUsd: balance,
        reservedNanoUsd: (wallet.reservedNanoUsd ?? 0) + reservedNanoUsd,
        updatedAt: now,
      });
    }
    if (key)
      await ctx.db.patch(key._id, {
        dailyPeriodStartAt: keyPeriod,
        usedTodayTokens: keyUsed,
        reservedTokens: keyReserved + prompt + output,
      });
    const settings =
      (await ctx.db
        .query("routerSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()) ?? DEFAULT_SETTINGS;
    const id = await ctx.db.insert("routerRequests", {
      requestId: args.requestId,
      userId,
      apiKeyId: key?._id,
      model: args.model,
      requestedModel: args.requestedModel,
      comboName: args.comboName,
      tier: spec.tier ?? "paid",
      state: "pending",
      reservedTokens: prompt + output,
      reservedNanoUsd,
      periodStartAt,
      keyPeriodStartAt: keyPeriod,
      pricing: {
        input: Number(spec.pricing?.input.replace("$", "") ?? 0) * 1000,
        output:
          Number(spec.pricing?.output.replace(/[^0-9.]/g, "") ?? 0) * 1000,
        cache:
          Number(
            spec.pricing?.cache?.replace(/[^0-9.]/g, "") ||
              spec.pricing?.input.replace("$", "") ||
              0,
          ) * 1000,
        unit: Number(spec.pricing?.input.replace("$", "") ?? 0) * NANO_USD,
      },
      settings: {
        logPayloads: settings.logPayloads,
        anonymizeTelemetry: settings.anonymizeTelemetry,
      },
      createdAt: now,
    });
    await ctx.scheduler.runAfter(240_000, internal.router.gateway.expire, {
      id,
    });
    return { id, maxOutputTokens: output, tier: spec.tier ?? "paid" };
  },
});

const resultValidator = {
  promptTokens: v.number(),
  completionTokens: v.number(),
  cachedTokens: v.number(),
  status: v.number(),
  durationMs: v.number(),
  ttftMs: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  usageEstimated: v.boolean(),
  ip: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  prompt: v.optional(v.string()),
  unitCount: v.optional(v.number()),
};
type Result = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  status: number;
  durationMs: number;
  ttftMs?: number;
  errorMessage?: string;
  usageEstimated: boolean;
  ip?: string;
  userAgent?: string;
  prompt?: string;
  unitCount?: number;
};
async function finalize(
  ctx: MutationCtx,
  request: Doc<"routerRequests">,
  result: Result,
) {
  if (request.state === "settled") return { success: true };
  const prompt = count(result.promptTokens),
    output = count(result.completionTokens),
    cached = count(result.cachedTokens);
  if (cached > prompt) fail("Cached tokens exceed prompt tokens", 400);
  const total = prompt + output,
    now = Date.now();
  const model = getManagedModel(request.model)!;
  if (
    result.unitCount !== undefined &&
    (!Number.isFinite(result.unitCount) || result.unitCount < 0)
  )
    fail("Invalid units", 400);
  const cost =
    request.tier === "free"
      ? 0
      : model.category === "llm"
        ? Math.ceil(
            (prompt - cached) * request.pricing.input +
              output * request.pricing.output +
              cached * request.pricing.cache,
          )
        : result.status < 400
          ? Math.ceil(
              result.unitCount === undefined
                ? request.reservedNanoUsd
                : result.unitCount * request.pricing.unit,
            )
          : 0;
  if (request.tier === "free") {
    const quota = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", request.userId))
      .unique();
    if (quota && quota.periodStartAt === request.periodStartAt)
      await ctx.db.patch(quota._id, {
        usedTokens: quota.usedTokens + total,
        reservedTokens: Math.max(
          0,
          (quota.reservedTokens ?? 0) - request.reservedTokens,
        ),
        lastDeductedAt: now,
        updatedAt: now,
      });
  }
  if (request.apiKeyId) {
    const key = await ctx.db.get(request.apiKeyId);
    if (key && key.dailyPeriodStartAt === request.keyPeriodStartAt)
      await ctx.db.patch(key._id, {
        usedTodayTokens: key.usedTodayTokens + total,
        reservedTokens: Math.max(
          0,
          (key.reservedTokens ?? 0) - request.reservedTokens,
        ),
        lastUsedAt: now,
      });
  }
  if (request.reservedNanoUsd > 0 || cost > 0) {
    const wallet = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", request.userId))
      .unique();
    if (!wallet) throw new Error("Wallet missing during settlement");
    const balance =
      (wallet.balanceNanoUsd ?? Math.round(wallet.balanceUsd * NANO_USD)) -
      cost;
    const spent =
      (wallet.totalSpentNanoUsd ??
        Math.round(wallet.totalSpentUsd * NANO_USD)) + cost;
    await ctx.db.patch(wallet._id, {
      balanceNanoUsd: balance,
      balanceUsd: balance / NANO_USD,
      totalSpentNanoUsd: spent,
      totalSpentUsd: spent / NANO_USD,
      reservedNanoUsd: Math.max(
        0,
        (wallet.reservedNanoUsd ?? 0) - request.reservedNanoUsd,
      ),
      updatedAt: now,
    });
    if (cost > 0)
      await ctx.db.insert("creditTransactions", {
        userId: request.userId,
        requestId: request.requestId,
        type: "deduction",
        amountNanoUsd: cost,
        amountUsd: cost / NANO_USD,
        balanceAfterUsd: balance / NANO_USD,
        paymentMethod: "API usage",
        status: "completed",
        description: request.model + " usage",
        createdAt: now,
      });
  }
  const key = request.apiKeyId ? await ctx.db.get(request.apiKeyId) : null;
  const keyName = key?.name ?? "Account session";
  const duration = Math.max(1, result.durationMs);
  await ctx.db.insert("routerLogs", {
    userId: request.userId,
    apiKeyId: request.apiKeyId,
    requestId: request.requestId,
    keyName,
    keyPrefix: key?.keyPrefix,
    model: request.requestedModel,
    resolvedModel: request.model,
    provider: "Const",
    comboName: request.comboName,
    billingTier: request.tier,
    costNanoUsd: cost,
    searchText: [
      request.requestId,
      request.requestedModel,
      request.model,
      keyName,
      request.tier,
    ].join(" "),
    rollupVersion: 1,
    promptTokens: prompt,
    completionTokens: output,
    cachedTokens: cached,
    totalTokens: total,
    status: result.status,
    errorMessage: result.errorMessage?.slice(0, 500),
    durationMs: duration,
    ttftMs: result.ttftMs,
    tokensPerSecond: (output * 1000) / duration,
    usageEstimated: result.usageEstimated,
    ip: request.settings.anonymizeTelemetry ? undefined : result.ip,
    userAgent: request.settings.anonymizeTelemetry
      ? undefined
      : result.userAgent,
    prompt: request.settings.logPayloads
      ? result.prompt?.slice(0, 4000)
      : undefined,
    createdAt: request.createdAt,
  });
  const bucketAt = Math.floor(request.createdAt / 3600000) * 3600000;
  const bucket = await ctx.db
    .query("routerUsageBuckets")
    .withIndex("by_identity", (q) =>
      q
        .eq("userId", request.userId)
        .eq("bucketAt", bucketAt)
        .eq("model", request.model)
        .eq("keyName", keyName)
        .eq("tier", request.tier),
    )
    .unique();
  const values = {
    userId: request.userId,
    bucketAt,
    model: request.model,
    provider: "Const",
    keyName,
    tier: request.tier,
    requests: (bucket?.requests ?? 0) + 1,
    successes: (bucket?.successes ?? 0) + (result.status < 400 ? 1 : 0),
    promptTokens: (bucket?.promptTokens ?? 0) + prompt,
    completionTokens: (bucket?.completionTokens ?? 0) + output,
    cachedTokens: (bucket?.cachedTokens ?? 0) + cached,
    totalTokens: (bucket?.totalTokens ?? 0) + total,
    costNanoUsd: (bucket?.costNanoUsd ?? 0) + cost,
    durationMs: (bucket?.durationMs ?? 0) + duration,
    ttftSum: (bucket?.ttftSum ?? 0) + (result.ttftMs ?? 0),
    ttftCount: (bucket?.ttftCount ?? 0) + (result.ttftMs === undefined ? 0 : 1),
  };
  if (bucket) await ctx.db.patch(bucket._id, values);
  else await ctx.db.insert("routerUsageBuckets", values);
  await ctx.db.patch(request._id, {
    state: "settled",
    costNanoUsd: cost,
    settledAt: now,
  });
  return { success: true };
}
export const settle = mutation({
  args: { secret: v.string(), id: v.id("routerRequests"), ...resultValidator },
  handler: async (ctx, args) => {
    requireGatewaySecret(args.secret);
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    return finalize(ctx, request, args);
  },
});
export const expire = internalMutation({
  args: { id: v.id("routerRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (request?.state === "pending")
      await finalize(ctx, request, {
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        status: 504,
        durationMs: Date.now() - request.createdAt,
        usageEstimated: true,
        errorMessage: "Request expired before settlement",
      });
  },
});
