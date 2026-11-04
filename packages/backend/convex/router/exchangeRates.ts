import {
  internalAction,
  internalMutation,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { checkoutConfig } from "./paymentContract";
import {
  parseReferenceRate,
  usableReferenceRate,
} from "./exchangeRateContract";

export async function readCheckoutConfig(ctx: Pick<QueryCtx, "db">) {
  const rate = await ctx.db
    .query("routerExchangeRates")
    .withIndex("by_pair", (q) => q.eq("pair", "USD_IDR"))
    .unique();
  const idrPerUsd = usableReferenceRate(rate);
  return {
    ...checkoutConfig(idrPerUsd),
    rateSource: "Frankfurter" as const,
    referenceDate: idrPerUsd ? rate!.referenceDate : null,
  };
}

export const storeReferenceRate = internalMutation({
  args: { idrPerUsd: v.number(), referenceDate: v.string() },
  handler: async (ctx, args) => {
    const validated = parseReferenceRate({
      base: "USD",
      quote: "IDR",
      date: args.referenceDate,
      rate: args.idrPerUsd,
    });
    const previous = await ctx.db
      .query("routerExchangeRates")
      .withIndex("by_pair", (q) => q.eq("pair", "USD_IDR"))
      .unique();
    // A delayed response must not replace a more recent observation.
    if (previous && previous.referenceDate > validated.referenceDate) return;
    const value = { ...validated, fetchedAt: Date.now() };
    if (previous) await ctx.db.patch(previous._id, value);
    else
      await ctx.db.insert("routerExchangeRates", { pair: "USD_IDR", ...value });
  },
});

export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const response = await fetch(
      "https://api.frankfurter.dev/v2/rate/USD/IDR",
      {
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(`Exchange rate source unavailable (${response.status})`);
    const rate = parseReferenceRate(await response.json());
    await ctx.runMutation(
      internal.router.exchangeRates.storeReferenceRate,
      rate,
    );
    return rate;
  },
});
