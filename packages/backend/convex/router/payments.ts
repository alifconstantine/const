import {
  action,
  query,
  internalMutation,
  httpAction,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { resolveIdentity } from "./access";
import {
  checkoutConfig,
  quotePayment,
  isPaymentLink,
  verifyPaymentWebhook,
} from "./paymentContract";
import { NANO_USD } from "./modelCatalog";
import { readCheckoutConfig } from "./exchangeRates";

export const getCheckoutConfig = query({
  args: {},
  handler: async (ctx) => {
    await resolveIdentity(ctx);
    const { returnUrl: _, ...config } = await readCheckoutConfig(ctx);
    return config;
  },
});
export const listPayments = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await resolveIdentity(ctx);
    const orders = await ctx.db
      .query("routerPayments")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return orders.map((order) => ({
      ...order,
      status:
        order.status === "pending" &&
        order.expiresAt &&
        order.expiresAt <= Date.now()
          ? "expired"
          : order.status,
    }));
  },
});
export const preparePayment = internalMutation({
  args: {
    creditCents: v.number(),
    requestId: v.string(),
    orderId: v.string(),
    expectedIdrPerUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await resolveIdentity(ctx);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(args.requestId))
      throw new ConvexError("Invalid checkout request.");
    const previous = await ctx.db
      .query("routerPayments")
      .withIndex("by_user_request", (q) =>
        q.eq("userId", userId).eq("requestId", args.requestId),
      )
      .unique();
    if (previous) {
      if (previous.creditCents !== args.creditCents)
        throw new ConvexError("Checkout amount changed. Start a new payment.");
      return { order: previous, isNew: false };
    }
    const config = await readCheckoutConfig(ctx);
    if (!config.available || !config.idrPerUsd)
      throw new ConvexError(
        "QRIS checkout or its exchange rate is temporarily unavailable. Try again later.",
      );
    if (
      args.expectedIdrPerUsd !== undefined &&
      args.expectedIdrPerUsd !== config.idrPerUsd
    )
      throw new ConvexError(
        "The exchange rate changed. Review the updated total and try again.",
      );
    const quote = quotePayment(args.creditCents, config.idrPerUsd);
    const recent = await ctx.db
      .query("routerPayments")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
    if (recent.length >= 5 && recent[4]!.createdAt > Date.now() - 15 * 60_000)
      throw new ConvexError(
        "Too many checkout requests. Wait 15 minutes before creating another.",
      );
    const id = await ctx.db.insert("routerPayments", {
      userId,
      requestId: args.requestId,
      orderId: args.orderId,
      creditCents: args.creditCents,
      ...quote,
      idrPerUsd: config.idrPerUsd,
      status: "creating",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { order: (await ctx.db.get(id))!, isNew: true };
  },
});
export const attachPayment = internalMutation({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    paymentLinkUrl: v.string(),
    expiresAt: v.number(),
    feeIdr: v.number(),
    netAmountIdr: v.number(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("routerPayments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .unique();
    if (!order || (order.paymentId && order.paymentId !== args.paymentId))
      throw new Error("Payment identity mismatch");
    const duplicate = await ctx.db
      .query("routerPayments")
      .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
      .unique();
    if (duplicate && duplicate._id !== order._id)
      throw new Error("Payment already belongs to another order");
    await ctx.db.patch(order._id, {
      paymentId: args.paymentId,
      paymentLinkUrl: args.paymentLinkUrl,
      expiresAt: args.expiresAt,
      feeIdr: args.feeIdr,
      netAmountIdr: args.netAmountIdr,
      status: order.status === "creating" ? "pending" : order.status,
      updatedAt: Date.now(),
    });
  },
});
export const markCreationFailed = internalMutation({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("routerPayments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .unique();
    if (order?.status === "creating")
      await ctx.db.patch(order._id, {
        status: "failed",
        updatedAt: Date.now(),
      });
  },
});

export const createPayment = action({
  args: {
    creditCents: v.number(),
    requestId: v.string(),
    expectedIdrPerUsd: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ orderId: string }> => {
    const { order, isNew }: { order: Doc<"routerPayments">; isNew: boolean } =
      await ctx.runMutation(internal.router.payments.preparePayment, {
        ...args,
        orderId: `CONST-${crypto.randomUUID()}`,
      });
    if (!isNew) return { orderId: order.orderId };
    const config = checkoutConfig();
    let response: Response;
    try {
      response = await fetch("https://api-pay.sumopod.com/api/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.SUMOPOD_API_KEY!,
        },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          order_id: order.orderId,
          amount: order.amountIdr,
          currency: "IDR",
          expires_in_hours: 24,
          success_return_url: config.returnUrl,
          cancel_return_url: config.returnUrl,
          payment_method_type_code: "QRIS",
        }),
      });
    } catch {
      // The provider may have accepted the invoice. Never retry this order or claim it failed.
      throw new ConvexError(
        "Payment confirmation is delayed. Check your payment history before creating another checkout.",
      );
    }
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500)
        await ctx.runMutation(internal.router.payments.markCreationFailed, {
          orderId: order.orderId,
        });
      throw new ConvexError(
        "Could not create the QRIS checkout. Check payment history and try again later.",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ConvexError(
        "The payment provider returned an incomplete checkout. Check payment history shortly.",
      );
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new ConvexError(
        "The payment provider returned an invalid checkout. Check payment history before trying again.",
      );
    const expiresAt = Date.parse(
      typeof data.expires_at === "string" ? data.expires_at : "",
    );
    if (
      typeof data.payment_id !== "string" ||
      !data.payment_id ||
      data.order_id !== order.orderId ||
      data.amount !== order.amountIdr ||
      !isPaymentLink(data.payment_link_url) ||
      data.status !== "pending" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      !Number.isSafeInteger(data.fee) ||
      data.fee < 0 ||
      !Number.isSafeInteger(data.net_amount) ||
      data.net_amount < 0 ||
      data.fee + data.net_amount !== order.amountIdr
    )
      throw new ConvexError(
        "The payment provider returned an invalid checkout. Check payment history before trying again.",
      );
    await ctx.runMutation(internal.router.payments.attachPayment, {
      orderId: order.orderId,
      paymentId: data.payment_id,
      paymentLinkUrl: data.payment_link_url,
      expiresAt,
      feeIdr: data.fee,
      netAmountIdr: data.net_amount,
    });
    return { orderId: order.orderId };
  },
});

export const settlePayment = internalMutation({
  args: {
    eventType: v.string(),
    orderId: v.string(),
    paymentId: v.string(),
    amountIdr: v.number(),
    status: v.string(),
    paidAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("routerPayments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .unique();
    if (
      !order ||
      order.amountIdr !== args.amountIdr ||
      (order.paymentId && order.paymentId !== args.paymentId)
    )
      throw new Error("Payment does not match an order");
    const duplicate = await ctx.db
      .query("routerPayments")
      .withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId))
      .unique();
    if (duplicate && duplicate._id !== order._id)
      throw new Error("Payment already belongs to another order");
    if (order.status === "completed") return;
    const now = Date.now();
    if (args.eventType !== "payment.completed") {
      const status =
        args.eventType === "payment.expired" ? "expired" : "failed";
      if (args.status !== status) throw new Error("Payment status mismatch");
      await ctx.db.patch(order._id, {
        paymentId: args.paymentId,
        status,
        updatedAt: now,
      });
      return;
    }
    if (args.status !== "completed") throw new Error("Payment status mismatch");
    // Order + ledger + wallet update in a single transaction; duplicate/reordered webhooks cannot credit twice.
    const reference = `sumopod:${order.orderId}`;
    const existing = await ctx.db
      .query("creditTransactions")
      .withIndex("by_request", (q) => q.eq("requestId", reference))
      .unique();
    if (!existing) {
      const wallet = await ctx.db
        .query("userCredits")
        .withIndex("by_user", (q) => q.eq("userId", order.userId))
        .unique();
      if (!(await ctx.db.get(order.userId)))
        throw new Error("Payment user missing");
      const balance =
        (wallet?.balanceNanoUsd ??
          Math.round((wallet?.balanceUsd ?? 0) * NANO_USD)) +
        order.creditNanoUsd;
      const totalDepositedUsd =
        (wallet?.totalDepositedUsd ?? 0) + order.creditNanoUsd / NANO_USD;
      if (wallet)
        await ctx.db.patch(wallet._id, {
          balanceNanoUsd: balance,
          balanceUsd: balance / NANO_USD,
          totalDepositedUsd,
          updatedAt: now,
        });
      else
        await ctx.db.insert("userCredits", {
          userId: order.userId,
          balanceNanoUsd: balance,
          balanceUsd: balance / NANO_USD,
          totalDepositedUsd,
          totalSpentUsd: 0,
          createdAt: now,
          updatedAt: now,
        });
      await ctx.db.insert("creditTransactions", {
        userId: order.userId,
        requestId: reference,
        type: "deposit",
        amountNanoUsd: order.creditNanoUsd,
        amountUsd: order.creditNanoUsd / NANO_USD,
        balanceAfterUsd: balance / NANO_USD,
        paymentMethod: "QRIS (IDR)",
        status: "completed",
        description: `QRIS credit purchase · ${order.orderId}`,
        createdAt: now,
      });
    }
    await ctx.db.patch(order._id, {
      paymentId: args.paymentId,
      status: "completed",
      paidAt: args.paidAt,
      updatedAt: now,
    });
  },
});
export const sumopodWebhook = httpAction(async (ctx, request) => {
  if (Number(request.headers.get("content-length")) > 65_536)
    return new Response("Payload too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > 65_536)
    return new Response("Payload too large", { status: 413 });
  if (!(await verifyPaymentWebhook(request.headers, raw)))
    return new Response("Invalid webhook authentication", { status: 401 });
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (event?.event_type === "payment.test") return new Response("OK");
  if (
    !["payment.completed", "payment.failed", "payment.expired"].includes(
      event?.event_type,
    )
  )
    return new Response("Ignored");
  const data = event.data;
  if (
    !data ||
    typeof data.order_id !== "string" ||
    typeof data.payment_id !== "string" ||
    !data.payment_id ||
    !Number.isSafeInteger(data.amount) ||
    data.amount <= 0 ||
    typeof data.status !== "string" ||
    (data.currency !== undefined && data.currency !== "IDR")
  )
    return new Response("Invalid payment payload", { status: 400 });
  try {
    await ctx.runMutation(internal.router.payments.settlePayment, {
      eventType: event.event_type,
      orderId: data.order_id,
      paymentId: data.payment_id,
      amountIdr: data.amount,
      status: data.status,
      paidAt: typeof data.paid_at === "string" ? data.paid_at : undefined,
    });
    return new Response("OK");
  } catch {
    return new Response("Payment could not be reconciled", { status: 409 });
  }
});
