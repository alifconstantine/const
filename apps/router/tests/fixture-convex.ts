import { useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import {
  analytics,
  logs,
  quota,
  settings,
  transactions,
  wallet,
} from "./fixture-data";
let revision = 0;
const subscribers = new Set<() => void>();
const subscribe = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};
const update = () => {
  revision++;
  subscribers.forEach((callback) => callback());
};
const empty: never[] = [];
export const fixtureCounters = {
  mutations: [] as { name: string; args: unknown }[],
  ranges: [] as string[],
  generationRequests: [] as unknown[],
  loadMore: 0,
  setPaymentState: (status: string) => {
    const payments = records["router/payments:listPayments"] as Array<Record<string, unknown>>;
    records["router/payments:listPayments"] = payments.map(payment => ({ ...payment, status: status === "elapsed" ? "pending" : status, ...(status === "elapsed" ? { expiresAt: Date.now() - 60_000 } : {}) }));
    update();
  },
};
const records: Record<string, unknown> = {
  "router/payments:getCheckoutConfig": { available: true, idrPerUsd: 17000, referenceDate: "2026-11-04", minCreditCents: 100, maxCreditCents: 50000 },
  "router/payments:listPayments": [],
  "router/settings:getSettings": settings,
  "router/credits:getUserCredits": wallet,
  "router/credits:getCreditTransactions": transactions,
  "router/logs:getDashboardAnalytics": analytics,
  "router/logs:listLogs": logs,
  "router/combos:listCombos": empty,
  "router/providers:listProviders": empty,
  "router/models:listCustomModels": empty,
  "auth/queries:currentUser": {
    _id: "fixture_user",
    name: "Alex Morgan",
    email: "alex@example.test",
  },
};
function read(ref: Parameters<typeof getFunctionName>[0], args?: unknown) {
  if (args === "skip") return undefined;
  const name = getFunctionName(ref);
  const state = new URLSearchParams(window.location.search).get("state");
  if (state === "checkout-unavailable" && name.startsWith("router/payments:")) throw new Error("Fixture checkout service unavailable");
  if (state === "error" && !name.startsWith("auth/"))
    throw new Error(
      "Fixture query failure. Retry after removing ?state=error.",
    );
  if (state === "loading" && !name.startsWith("auth/")) return undefined;
  if (state === "unavailable" && name === "router/payments:getCheckoutConfig") return { available: false, idrPerUsd: null, minCreditCents: 100, maxCreditCents: 50000 };
  return records[name] ?? empty;
}
export function useQuery(
  ref: Parameters<typeof getFunctionName>[0],
  args?: unknown,
): any {
  useSyncExternalStore(subscribe, () => revision);
  return read(ref, args);
}
export function useQueries(
  queries: Record<
    string,
    { query: Parameters<typeof getFunctionName>[0]; args: unknown }
  >,
): Record<string, any> {
  useSyncExternalStore(subscribe, () => revision);
  return Object.fromEntries(
    Object.entries(queries).map(([name, query]) => {
      try {
        return [name, read(query.query, query.args)];
      } catch (error) {
        return [name, error];
      }
    }),
  );
}
export function useMutation(ref: Parameters<typeof getFunctionName>[0]) {
  return async (args?: unknown) => {
    const name = getFunctionName(ref);
    fixtureCounters.mutations.push({ name, args });
    if (name === "router/settings:saveSettings")
      records["router/settings:getSettings"] = args;
    update();
    return { success: true };
  };
}
export function useAction(ref: Parameters<typeof getFunctionName>[0]) {
  return async (args: { creditCents: number; requestId: string }) => {
    const name = getFunctionName(ref);
    fixtureCounters.mutations.push({ name, args });
    if (new URLSearchParams(location.search).get("state") === "checkout-error") throw new Error("Synthetic checkout failure");
    const orderId = "CONST-fixture-" + args.requestId;
    records["router/payments:listPayments"] = [{ orderId, creditCents: args.creditCents, amountIdr: args.creditCents * 170, idrPerUsd: 17000, status: "pending", paymentLinkUrl: "https://pay.sumopod.com/pay/fixture", createdAt: Date.now(), expiresAt: Date.now() + 86400000 }];
    update();
    return { orderId };
  };
}
export function usePaginatedQuery(
  ref: Parameters<typeof getFunctionName>[0],
  args?: unknown,
) {
  const results = useQuery(ref, args);
  return {
    results: results || empty,
    status: results ? "Exhausted" : "LoadingFirstPage",
    loadMore: () => {
      fixtureCounters.loadMore++;
    },
  };
}
export const useConvexAuth = () => ({
  isAuthenticated: true,
  isLoading: false,
});
