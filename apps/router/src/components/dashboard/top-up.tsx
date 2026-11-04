"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@const/backend/_generated/api";
import { Button, Input, cn } from "@const/ui";
import { ArrowUpRight, Check, Loader2, QrCode } from "lucide-react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { formatUsd } from "@/lib/router-analytics";

type Config = {
  available: boolean;
  idrPerUsd: number | null;
  referenceDate?: string | null;
  minCreditCents: number;
  maxCreditCents: number;
};
type Payment = {
  orderId: string;
  creditCents: number;
  amountIdr: number;
  idrPerUsd: number;
  status: string;
  paymentLinkUrl?: string;
  expiresAt?: number;
  createdAt: number;
};
const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function TopUpView({
  config,
  payments = [],
  create,
}: {
  config?: Config;
  payments?: Payment[];
  create?: (
    creditCents: number,
    requestId: string,
    expectedIdrPerUsd: number,
  ) => Promise<{ orderId: string }>;
}) {
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");
  const [now, setNow] = useState(Date.now());
  const attempt = useRef<{ amount: number; requestId: string } | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const validAmount = /^\d+(?:\.\d{1,2})?$/.test(amount);
  const cents = validAmount ? Math.round(Number(amount) * 100) : 0;
  const valid = Boolean(
    config &&
    Number.isSafeInteger(cents) &&
    cents >= config.minCreditCents &&
    cents <= config.maxCreditCents,
  );
  const total =
    valid && config?.idrPerUsd
      ? Math.ceil((cents * config.idrPerUsd) / 100)
      : null;
  const selected = payments.find(
    (payment) => payment.orderId === selectedOrder,
  );
  const effectiveStatus = (payment: Payment) =>
    payment.status === "pending" &&
    payment.expiresAt !== undefined &&
    payment.expiresAt <= now
      ? "expired"
      : payment.status;
  const selectedStatus = selected ? effectiveStatus(selected) : undefined;
  const payableSelected =
    selected?.creditCents === cents &&
    selectedStatus === "pending" &&
    Boolean(selected.paymentLinkUrl);
  const confirmingSelected = Boolean(
    selectedOrder &&
    (!selected ||
      (selected.creditCents === cents && selectedStatus === "creating")),
  );
  const summaryRate = payableSelected ? selected!.idrPerUsd : config?.idrPerUsd;
  const summaryTotal = payableSelected ? selected!.amountIdr : total;
  async function checkout(event: React.FormEvent) {
    event.preventDefault();
    if (
      !valid ||
      !config?.available ||
      !create ||
      pending.current ||
      payableSelected ||
      confirmingSelected
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    if (attempt.current?.amount !== cents)
      attempt.current = { amount: cents, requestId: crypto.randomUUID() };
    try {
      const result = await create(
        cents,
        attempt.current.requestId,
        config.idrPerUsd!,
      );
      setSelectedOrder(result.orderId);
      attempt.current = null;
    } catch (failure) {
      setError(
        failure instanceof ConvexError && typeof failure.data === "string"
          ? failure.data
          : "Checkout could not be created. Check payment history before trying again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="add-credit-heading" className="space-y-6">
      <div>
        <h2 id="add-credit-heading" className="text-base font-medium">
          Add credit with QRIS
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Choose your credit in USD and pay in rupiah. Your balance updates
          automatically after payment is verified.
        </p>
      </div>
      <div className="grid gap-8 rounded-xl border border-border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_1fr]">
        <form
          id="credit-top-up-form"
          onSubmit={checkout}
          className="min-w-0 space-y-5"
        >
          <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-3 text-sm font-medium">Credit amount</legend>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 25].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={amount === String(value)}
                  onClick={() => {
                    setAmount(String(value));
                    setError("");
                  }}
                  className={cn(
                    "min-h-11 rounded-lg border px-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-ring",
                    amount === String(value)
                      ? "border-foreground bg-secondary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  ${value}
                </button>
              ))}
            </div>
            <label
              htmlFor="credit-usd"
              className="block text-xs text-muted-foreground"
            >
              Custom amount in USD
            </label>
            <Input
              id="credit-usd"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError("");
              }}
              aria-describedby="credit-amount-help"
              aria-invalid={Boolean(amount && !valid && config)}
              className="h-11 tabular-nums"
            />
            <p
              id="credit-amount-help"
              className="text-xs text-muted-foreground"
            >
              $1–$500 per payment. Up to two decimal places.
            </p>
          </fieldset>
        </form>
        <div className="min-w-0 space-y-5 lg:border-l lg:border-border lg:pl-8">
          <h3 className="text-sm font-medium">Payment summary</h3>
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Credit added</dt>
              <dd className="tabular-nums">
                {valid ? formatUsd(cents / 100) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Exchange rate</dt>
              <dd className="text-right tabular-nums">
                {summaryRate ? `${rupiah(summaryRate)} / USD` : "Unavailable"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Gateway fee</dt>
              <dd>Covered by Const</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-4 font-medium">
              <dt>You pay</dt>
              <dd className="text-right tabular-nums">
                {summaryTotal === null ? "—" : rupiah(summaryTotal)}
              </dd>
            </div>
          </dl>
          {config?.referenceDate && !payableSelected && (
            <p className="text-xs leading-6 text-muted-foreground">
              Daily reference rate · {config.referenceDate}. Checked hourly.
              Source:{" "}
              <a
                href="https://frankfurter.dev/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                Frankfurter
              </a>
              .
            </p>
          )}
          <p className="max-w-prose text-xs leading-6 text-muted-foreground">
            Scan the QR code on SumoPod’s checkout with your banking or e-wallet
            app. The exchange rate is fixed when your payment is created.
            Checkout expires after 24 hours.
          </p>
        </div>
        <div className="space-y-4 lg:col-span-2 lg:max-w-sm">
          {payableSelected ? (
            <Button asChild className="min-h-11 w-full gap-2">
              <a
                href={selected!.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pay with QRIS <ArrowUpRight className="size-4" />
              </a>
            </Button>
          ) : (
            <Button
              type="submit"
              form="credit-top-up-form"
              disabled={
                busy ||
                confirmingSelected ||
                !valid ||
                !config?.available ||
                !create
              }
              className="min-h-11 w-full gap-2"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <QrCode className="size-4" />
              )}
              {busy
                ? "Creating checkout…"
                : confirmingSelected
                  ? "Confirming checkout…"
                  : "Create QRIS checkout"}
            </Button>
          )}
          {!config ? (
            <p role="status" className="text-xs text-muted-foreground">
              Loading checkout…
            </p>
          ) : (
            !config.available && (
              <p
                role="status"
                className="text-xs leading-6 text-muted-foreground"
              >
                QRIS checkout is temporarily unavailable. Please try again
                later.
              </p>
            )
          )}
          {error && (
            <p role="alert" className="text-sm leading-6 text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
      {selectedOrder && (
        <div
          role="status"
          className="rounded-xl bg-secondary p-4 text-sm leading-6"
        >
          {selectedStatus === "completed" ? (
            <>
              <Check className="mr-2 inline size-4" />
              Payment verified. Your credit has been added.
            </>
          ) : selectedStatus === "expired" ? (
            "This checkout has expired. Create a new checkout to continue."
          ) : selectedStatus === "failed" ? (
            "This payment failed. Create a new checkout to try again."
          ) : selectedStatus === "pending" && selected?.paymentLinkUrl ? (
            <>Your checkout is ready. Select Pay with QRIS to continue.</>
          ) : (
            "Your checkout is being confirmed. Watch payment history for its status."
          )}
        </div>
      )}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recent payments</h3>
          <div className="divide-y divide-border rounded-xl border border-border bg-card px-5">
            {payments.map((payment) => {
              const status = effectiveStatus(payment);
              return (
                <article
                  key={payment.orderId}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular-nums">
                      {formatUsd(payment.creditCents / 100)} credit{" "}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {rupiah(payment.amountIdr)}
                      </span>
                    </p>
                    <p className="mt-1 break-all text-[11px] text-muted-foreground">
                      {payment.orderId}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleString()}
                      {payment.expiresAt && status === "pending"
                        ? ` · Expires ${new Date(payment.expiresAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs capitalize text-muted-foreground">
                      {status === "creating"
                        ? "Confirming checkout"
                        : status === "completed"
                          ? "Paid · credited"
                          : status}
                    </span>
                    {status === "pending" && payment.paymentLinkUrl && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-11 gap-2"
                      >
                        <a
                          href={payment.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Pay with QRIS <ArrowUpRight className="size-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function TopUp() {
  const { isAuthenticated } = useRouterAuth();
  const config = useQuery(
    api.router.payments.getCheckoutConfig,
    isAuthenticated ? {} : "skip",
  );
  const payments = useQuery(
    api.router.payments.listPayments,
    isAuthenticated ? {} : "skip",
  );
  const create = useAction(api.router.payments.createPayment);
  return (
    <TopUpView
      config={config}
      payments={payments}
      create={(creditCents, requestId, expectedIdrPerUsd) =>
        create({ creditCents, requestId, expectedIdrPerUsd })
      }
    />
  );
}
