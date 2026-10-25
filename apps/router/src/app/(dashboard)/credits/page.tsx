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
    <div className="max-w-6xl mx-auto space-y-7 pb-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-medium tracking-tight">Credits & balance</h1>
        <p className="text-sm text-muted-foreground">
          Paid model balance, reserved credit, and transaction settlement ledger.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5">
        <section className="rounded-xl bg-card border border-border/60 p-6 flex flex-col justify-between gap-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Wallet size={15} />
            AVAILABLE CREDIT
          </div>
          {wallet ? (
            <div>
              <p className="text-4xl font-medium tracking-tight tabular-nums">
                ${money(wallet.availableUsd)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                USD &bull; Available for paid frontier models
              </p>
            </div>
          ) : (
            <Skeleton className="h-12 w-48" />
          )}

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Account balance</p>
              <p className="tabular-nums text-sm font-mono font-medium">
                {wallet ? "$" + money(wallet.balanceUsd) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Active reservations</p>
              <p className="tabular-nums text-sm font-mono font-medium">
                {wallet ? "$" + money(wallet.reservedUsd) : "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-card border border-border/60 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium">Add credit</h2>
            <Badge variant="secondary" className="font-mono text-[10px]">
              Coming soon
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Direct deposits with QRIS and USDC on Solana will be available upon payment gateway activation. Balance drains purely per token without recurring subscription lock-in.
          </p>
          <div className="rounded-lg bg-secondary/40 border border-border/40 p-3.5 flex gap-2.5 text-xs">
            <Clock3 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-muted-foreground">
              You can currently use all listed <span className="text-foreground font-mono font-medium">:free</span> models within your 7,000,000 weekly token allowance.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href="/models">
              <span>Explore free tier models</span>
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </section>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {[
          ["Total credited", wallet?.totalDepositedUsd],
          ["Total spent on paid models", wallet?.totalSpentUsd],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl bg-card border border-border/60 px-5 py-4 flex justify-between items-center gap-3"
          >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-mono font-medium tabular-nums">
              {typeof value === "number" ? "$" + money(value) : "—"}
            </span>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ReceiptText size={16} className="text-muted-foreground" />
          <h2 className="font-medium text-sm">Transaction history</h2>
        </div>

        <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
          <ScrollArea orientation="horizontal" className="w-full">
            <table className="w-full min-w-[680px] text-xs text-left">
              <thead className="text-muted-foreground bg-secondary/40 border-b border-border/40">
                <tr>
                  {[
                    "Timestamp",
                    "Description",
                    "Amount",
                    "Status",
                    "Balance After",
                  ].map((t) => (
                    <th key={t} className="px-5 py-3.5 font-normal">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading && !transactions.length ? (
                  <tr>
                    <td colSpan={5} className="p-8">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ) : !transactions.length ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-6 text-center">
                      <p className="text-xs text-muted-foreground">No transactions recorded yet.</p>
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        Settled usage and account balance changes will be itemized here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 text-muted-foreground font-mono">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-foreground">{tx.description}</p>
                        {tx.requestId && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            {tx.requestId}
                          </p>
                        )}
                      </td>
                      <td className="p-4 tabular-nums font-mono whitespace-nowrap">
                        {tx.type === "deduction" ? "−" : "+"}${money(tx.amountUsd)}
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="p-4 tabular-nums font-mono font-medium">
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
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading} className="rounded-lg">
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
