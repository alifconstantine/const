"use client";
import Link from "next/link";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, Skeleton, Badge, ScrollArea } from "@const/ui";
import { ArrowUpRight, Wallet, Clock3, ReceiptText } from "lucide-react";

type WalletData = {
  balanceUsd: number;
  availableUsd: number;
  reservedUsd: number;
  totalDepositedUsd: number;
  totalSpentUsd: number;
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
const money = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
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
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          Credits & balance
        </h1>
        <p className="text-sm text-muted-foreground">
          Your paid model balance, reserved credit, and account transactions.
        </p>
      </header>
      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5">
        <section className="rounded-3xl bg-card p-6 sm:p-8 flex flex-col justify-between gap-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet size={16} />
            Available credit
          </div>
          {wallet ? (
            <div>
              <p className="text-4xl sm:text-5xl font-medium tracking-tight tabular-nums">
                ${money(wallet.availableUsd)}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                USD · Available for paid models
              </p>
            </div>
          ) : (
            <Skeleton className="h-14 w-52" />
          )}
          <div className="grid grid-cols-2 gap-4 pt-5 border-t border-border/60">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Account balance
              </p>
              <p className="tabular-nums text-sm">
                {wallet ? "$" + money(wallet.balanceUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Reserved for active requests
              </p>
              <p className="tabular-nums text-sm">
                {wallet ? "$" + money(wallet.reservedUsd) : "—"}
              </p>
            </div>
          </div>
        </section>
        <section className="rounded-3xl bg-card p-6 sm:p-8 space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium">Add credit</h2>
            <Badge variant="secondary">Not available yet</Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Top-ups will be available when payment processing is connected.
            There is no active payment address or QR code to use yet.
          </p>
          <div className="rounded-2xl bg-secondary/60 p-4 flex gap-3 text-sm">
            <Clock3 className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              You can keep using the listed{" "}
              <span className="text-foreground">:free</span> models within your
              weekly free allowance.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/models">
              Explore free models <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        {[
          ["Total credited", wallet?.totalDepositedUsd],
          ["Total spent on paid models", wallet?.totalSpentUsd],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl bg-card px-6 py-5 flex justify-between gap-3"
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm tabular-nums">
              {typeof value === "number" ? "$" + money(value) : "—"}
            </span>
          </div>
        ))}
      </div>
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ReceiptText size={17} />
          <h2 className="font-medium">Transaction history</h2>
        </div>
        <div className="rounded-2xl bg-card overflow-hidden">
          <ScrollArea orientation="horizontal" className="w-full">
            <table className="w-full min-w-[680px] text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-secondary/30">
                <tr>
                  {[
                    "Date",
                    "Description",
                    "Amount",
                    "Status",
                    "Balance after",
                  ].map((t) => (
                    <th key={t} className="px-5 py-4 font-normal">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !transactions.length ? (
                  <tr>
                    <td colSpan={5} className="p-8">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : !transactions.length ? (
                  <tr>
                    <td colSpan={5} className="py-14 px-6 text-center">
                      <p>No transactions yet</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Paid usage and account credits will appear here. Free
                        requests are recorded in Usage logs.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="border-t border-border/40">
                      <td className="p-5 text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="p-5">
                        <p>{tx.description}</p>
                        {tx.requestId && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {tx.requestId}
                          </p>
                        )}
                      </td>
                      <td className="p-5 tabular-nums whitespace-nowrap">
                        {tx.type === "deduction" ? "−" : "+"}$
                        {money(tx.amountUsd)}
                      </td>
                      <td className="p-5">
                        <Badge variant="secondary">{tx.status}</Badge>
                      </td>
                      <td className="p-5 tabular-nums">
                        ${money(tx.balanceAfterUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
        {more && (
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            Load more transactions
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
