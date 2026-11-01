"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, Input, Skeleton, cn } from "@const/ui";
import { ArrowUpRight, Search } from "lucide-react";
import { formatUsd } from "@/lib/router-analytics";

type WalletData = {
  balanceUsd: number;
  availableUsd: number;
  reservedUsd: number;
  totalDepositedUsd: number;
  totalSpentUsd: number;
  topUpAvailable?: boolean;
};
type Transaction = {
  _id: string;
  type: string;
  amountUsd: number;
  balanceAfterUsd: number;
  status: string;
  description: string;
  createdAt: number;
  requestId?: string;
};

export function CreditsView({
  wallet,
  transactions,
  loading,
  more,
  loadMore,
}: {
  wallet?: WalletData;
  transactions: Transaction[];
  loading?: boolean;
  more?: boolean;
  loadMore?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const filtered = transactions.filter(
    (tx) =>
      (type === "all" || tx.type === type) &&
      (status === "all" || tx.status === status) &&
      `${tx.description} ${tx.requestId ?? ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const hasFilters = Boolean(search || type !== "all" || status !== "all");
  const amount = (tx: Transaction) =>
    `${tx.type === "deduction" ? "−" : "+"}${formatUsd(Math.abs(tx.amountUsd))}`;
  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Credits & balance
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your paid model balance and every settled transaction.
        </p>
      </header>
      <section
        className="overflow-hidden rounded-xl border border-border bg-card"
        aria-label="Credit balance"
      >
        <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-sm text-muted-foreground">
              Available credit <span className="ml-2 text-xs">USD</span>
            </h2>
            {wallet ? (
              <p className="mt-4 break-words text-4xl font-medium tracking-tight tabular-nums">
                {formatUsd(wallet.availableUsd)}
              </p>
            ) : (
              <Skeleton className="mt-4 h-10 w-52" />
            )}
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Ready to spend on paid models. No subscription required.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-7 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            {[
              {
                label: "Account balance",
                value: wallet?.balanceUsd,
                detail: "Before active reservations",
              },
              {
                label: "Reserved credit",
                value: wallet?.reservedUsd,
                detail: "Held for requests in progress",
              },
              {
                label: "Total credited",
                value: wallet?.totalDepositedUsd,
                detail: "Lifetime account credits",
              },
              {
                label: "Total spent",
                value: wallet?.totalSpentUsd,
                detail: "Settled paid model usage",
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-2 text-lg font-medium tabular-nums">
                  {item.value === undefined ? (
                    <Skeleton className="h-6 w-24" />
                  ) : (
                    formatUsd(item.value)
                  )}
                </dd>
                <dd className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  {item.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 sm:px-6">
          <p className="max-w-2xl text-xs leading-6 text-muted-foreground">
            Reservations reduce available credit while a request runs. Once it
            finishes, actual usage is settled and the remaining reservation is
            released.
          </p>
          <Link
            href="/docs#metering"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium hover:text-[var(--router-highlight)]"
          >
            How billing works <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </section>
      <section
        className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-7"
        aria-label="Adding credit"
      >
        <div>
          <h2 className="text-sm font-medium">
            Adding credit is currently unavailable
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            You can keep using models marked <code>:free</code> within your
            weekly token allowance.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/models">
            Browse free models <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </section>
      <section className="space-y-5" aria-label="Transaction history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium">Transaction history</h2>
          <p className="text-xs text-muted-foreground">
            All amounts in USD · up to 6 decimal places
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Search loaded transactions"
              className="h-10 bg-card pl-9"
              placeholder="Search description or request ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Transaction type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="all">All types</option>
              {Array.from(new Set(transactions.map((tx) => tx.type)))
                .sort()
                .map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
            </select>
            <select
              aria-label="Transaction status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="all">All statuses</option>
              {Array.from(new Set(transactions.map((tx) => tx.status)))
                .sort()
                .map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
            </select>
          </div>
        </div>
        {(hasFilters || more) && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing {filtered.length} of {transactions.length} loaded
            transactions. {more && "Load more to search earlier activity."}
          </p>
        )}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border sm:hidden">
            {filtered.map((tx) => (
              <article key={tx._id} className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 break-words text-sm font-medium">
                    {tx.description}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-sm tabular-nums",
                      tx.type === "deduction"
                        ? "text-foreground"
                        : "text-[var(--router-highlight)]",
                    )}
                  >
                    {amount(tx)}
                  </span>
                </div>
                {tx.requestId && (
                  <code className="block break-all text-[11px] text-muted-foreground">
                    {tx.requestId}
                  </code>
                )}
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <time>{new Date(tx.createdAt).toLocaleString()}</time>
                  <span className="capitalize">{tx.status}</span>
                </div>
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Balance after{" "}
                  <span className="float-right tabular-nums text-foreground">
                    {formatUsd(tx.balanceAfterUsd)}
                  </span>
                </p>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  {[
                    "Date & time",
                    "Description",
                    "Amount",
                    "Status",
                    "Balance after",
                  ].map((label, index) => (
                    <th
                      key={label}
                      className={cn(
                        "px-5 py-3.5 font-medium",
                        (index === 2 || index === 4) && "text-right",
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((tx) => (
                  <tr key={tx._id} className="hover:bg-secondary/30">
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground tabular-nums">
                      <p>{new Date(tx.createdAt).toLocaleDateString()}</p>
                      <p className="mt-1.5 text-[11px]">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="max-w-sm px-5 py-4">
                      <p className="font-medium">{tx.description}</p>
                      {tx.requestId && (
                        <code className="mt-1.5 block break-all text-[11px] text-muted-foreground">
                          {tx.requestId}
                        </code>
                      )}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-5 py-4 text-right tabular-nums",
                        tx.type === "deduction"
                          ? "text-foreground"
                          : "text-[var(--router-highlight)]",
                      )}
                    >
                      {amount(tx)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-secondary px-2 py-1 text-[11px] capitalize text-muted-foreground">
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums">
                      {formatUsd(tx.balanceAfterUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && !transactions.length ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            !filtered.length && (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium">
                  {hasFilters
                    ? "No matching transactions"
                    : "No transactions yet"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                  {hasFilters
                    ? "Adjust the filters or load earlier transactions to continue your search."
                    : "Paid usage and account credit adjustments will appear here once they settle. Free model requests do not debit this balance."}
                </p>
                {hasFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearch("");
                      setType("all");
                      setStatus("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )
          )}
        </div>
        {more && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loading || !loadMore}
          >
            {loading ? "Loading transactions…" : "Load more transactions"}
          </Button>
        )}
      </section>
    </div>
  );
}

function ConnectedCredits() {
  const { isAuthenticated } = useRouterAuth();
  const wallet = useQuery(
    api.router.credits.getUserCredits,
    isAuthenticated ? {} : "skip",
  );
  const txs = usePaginatedQuery(
    api.router.credits.getCreditTransactions,
    isAuthenticated ? {} : "skip",
    { initialNumItems: 20 },
  );
  return (
    <CreditsView
      wallet={wallet}
      transactions={txs.results}
      loading={
        txs.status === "LoadingFirstPage" || txs.status === "LoadingMore"
      }
      more={txs.status === "CanLoadMore"}
      loadMore={() => txs.loadMore(20)}
    />
  );
}
export default function CreditsPage() {
  return (
    <QueryBoundary name="Credits">
      <ConnectedCredits />
    </QueryBoundary>
  );
}
