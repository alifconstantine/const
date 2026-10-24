"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toast,
  cn,
} from "@const/ui";
import {
  Wallet,
  CreditCard,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  QrCode,
  Coins,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  Zap,
} from "lucide-react";

const USD_TO_IDR_RATE = 16200;

const CRYPTO_AMOUNTS = [1, 5, 10, 25, 50, 100];

const NETWORK_DETAILS: Record<
  "solana" | "bnb" | "polygon",
  { name: string; depositAddress: string; explorer: string }
> = {
  solana: {
    name: "Solana",
    depositAddress: "Const7xG8mK2L9p4QvE5nRtJwYbSd1uFzXa7yP9vQ2",
    explorer: "https://solscan.io",
  },
  bnb: {
    name: "BNB Chain",
    depositAddress: "0x892a71f084620A05537554F7547E84B1bfa00D34",
    explorer: "https://bscscan.com",
  },
  polygon: {
    name: "Polygon",
    depositAddress: "0x892a71f084620A05537554F7547E84B1bfa00D34",
    explorer: "https://polygonscan.com",
  },
};

export default function CreditsPage() {
  const { isAuthenticated } = useRouterAuth();

  // Convex live queries & mutations
  const userCredits = useQuery(
    api.router.credits.getUserCredits,
    isAuthenticated ? {} : "skip"
  );
  const creditTransactions = useQuery(
    api.router.credits.getCreditTransactions,
    isAuthenticated ? { limit: 20 } : "skip"
  );
  const createDeposit = useMutation(api.router.credits.createDeposit);

  // Deposit Form State
  const [paymentMethod, setPaymentMethod] = useState<"crypto" | "qris">("crypto");
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<"USDT" | "USDC">("USDT");
  const [selectedNetwork, setSelectedNetwork] = useState<"solana" | "bnb" | "polygon">("solana");

  // Modal Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 mins for QRIS

  // Active Amount in USD
  const activeAmountUsd = useMemo(() => {
    if (customAmount.trim()) {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? selectedAmount : parsed;
    }
    return selectedAmount;
  }, [selectedAmount, customAmount]);

  // Active Amount in IDR for QRIS
  const activeAmountIdr = useMemo(() => {
    return Math.round(activeAmountUsd * USD_TO_IDR_RATE);
  }, [activeAmountUsd]);

  // Current balance display
  const currentBalance = userCredits?.balanceUsd ?? 0;

  // Handle Preset Click
  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount("");
  };

  // Copy address to clipboard
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    toast.success("Deposit address copied to clipboard");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Open Checkout Modal
  const handleOpenCheckout = () => {
    if (activeAmountUsd < 1) {
      toast.error("Minimum deposit is $1.00");
      return;
    }
    setCountdown(900);
    setIsCheckoutOpen(true);
  };

  // Simulate Completing Deposit
  const handleSimulatePayment = async () => {
    setIsSimulatingPayment(true);
    try {
      const randomHash =
        paymentMethod === "crypto"
          ? `${selectedNetwork === "solana" ? "sol_" : "0x"}${Math.random().toString(36).substring(2, 12)}${Date.now().toString(36)}`
          : `QRIS_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      await createDeposit({
        amountUsd: activeAmountUsd,
        paymentMethod: paymentMethod === "crypto" ? "crypto" : "qris",
        token: paymentMethod === "crypto" ? selectedToken : "IDR",
        network: paymentMethod === "crypto" ? selectedNetwork : "qris",
        txHash: randomHash,
        description:
          paymentMethod === "crypto"
            ? `Deposit ${activeAmountUsd.toFixed(2)} USD via ${selectedToken} (${NETWORK_DETAILS[selectedNetwork].name})`
            : `Deposit ${activeAmountUsd.toFixed(2)} USD (Rp ${activeAmountIdr.toLocaleString("id-ID")}) via QRIS`,
      });

      toast.success("Deposit Successful!", {
        description: `$${activeAmountUsd.toFixed(2)} USD credited to your account.`,
      });
      setIsCheckoutOpen(false);
    } catch (err: any) {
      toast.error("Deposit simulation failed", {
        description: err?.message || "Could not process credit transaction.",
      });
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-16 max-w-5xl">
        {/* 1. Header with Title & Live Balance Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
              Deposit.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-light">
              Add funds to your account balance to pay for API usage. Your balance does not expire.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto bg-card px-4 py-2.5 rounded-xl border border-border/60">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-xs font-sans">
              <span className="text-muted-foreground">Available for API requests: </span>
              <span className="font-semibold text-foreground font-mono tabular-nums">
                ${currentBalance.toFixed(4)}
              </span>
            </div>
            <a
              href="mailto:support@constrouter.com"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-2 transition-colors border-l border-border/60 pl-3"
              target="_blank"
              rel="noreferrer"
            >
              <span>Payment help</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* 2. Main 2-Column Deposit Configuration Card */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Payment Methods List (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                Payment Method
              </span>
              <p className="text-xs text-muted-foreground font-light">
                Choose your preferred funding source.
              </p>
            </div>

            <div className="space-y-2">
              {/* Crypto Option (USDT / USDC) */}
              <button
                type="button"
                onClick={() => setPaymentMethod("crypto")}
                className={cn(
                  "w-full text-left p-4 rounded-2xl transition-all cursor-pointer flex items-center justify-between border",
                  paymentMethod === "crypto"
                    ? "bg-secondary/70 border-foreground/30 shadow-xs"
                    : "bg-card border-border/60 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      paymentMethod === "crypto"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground font-sans">
                      USDT / USDC
                    </div>
                    <div className="text-xs text-muted-foreground font-sans">
                      Solana · BNB · Polygon
                    </div>
                  </div>
                </div>
                {paymentMethod === "crypto" ? (
                  <ArrowRight className="h-4 w-4 text-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                )}
              </button>

              {/* QRIS Option (Indonesian Rupiah) */}
              <button
                type="button"
                onClick={() => setPaymentMethod("qris")}
                className={cn(
                  "w-full text-left p-4 rounded-2xl transition-all cursor-pointer flex items-center justify-between border",
                  paymentMethod === "qris"
                    ? "bg-secondary/70 border-foreground/30 shadow-xs"
                    : "bg-card border-border/60 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      paymentMethod === "qris"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground font-sans">
                      QRIS
                    </div>
                    <div className="text-xs text-muted-foreground font-sans">
                      Indonesian rupiah (Instant)
                    </div>
                  </div>
                </div>
                {paymentMethod === "qris" ? (
                  <ArrowRight className="h-4 w-4 text-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                )}
              </button>
            </div>

            {/* Guarantees / Perks Box */}
            <Card className="rounded-2xl border-none bg-card p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero gateway fees:</strong> 100% of deposited funds go directly toward API requests.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Instant credit:</strong> Deposits are confirmed and credited within seconds.
                </span>
              </div>
            </Card>
          </div>

          {/* Right Column: Amount & Network Selection (7 cols) */}
          <div className="md:col-span-7">
            <Card className="rounded-2xl border-none bg-card p-6 space-y-6">
              {/* Amount Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Amount (USD)
                  </label>
                  {paymentMethod === "qris" && (
                    <span className="text-[11px] font-sans text-muted-foreground">
                      Rate: 1 USD ≈ Rp {USD_TO_IDR_RATE.toLocaleString("id-ID")}
                    </span>
                  )}
                </div>

                {/* Amount Presets */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CRYPTO_AMOUNTS.map((amt) => {
                    const isSelected = selectedAmount === amt && !customAmount;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectPreset(amt)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border",
                          isSelected
                            ? "bg-foreground text-background border-foreground shadow-xs"
                            : "bg-secondary/40 text-foreground border-border/60 hover:bg-secondary hover:border-border"
                        )}
                      >
                        ${amt}.00
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Input */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="10000"
                    placeholder="Custom amount (e.g. 50.00)"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-8 pr-4 h-10 rounded-xl bg-secondary/50 border-none text-xs text-foreground placeholder:text-muted-foreground font-mono outline-none focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
                  />
                </div>

                {paymentMethod === "qris" && (
                  <div className="text-xs text-muted-foreground font-sans bg-secondary/30 p-2.5 rounded-xl flex items-center justify-between">
                    <span>Equivalent in IDR:</span>
                    <span className="font-semibold text-foreground font-mono">
                      Rp {activeAmountIdr.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>

              {/* Crypto Specific: Token & Network Selector */}
              {paymentMethod === "crypto" && (
                <>
                  {/* Token Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-sans font-medium text-foreground">
                      Token
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["USDT", "USDC"] as const).map((tok) => {
                        const isSelected = selectedToken === tok;
                        return (
                          <button
                            key={tok}
                            type="button"
                            onClick={() => setSelectedToken(tok)}
                            className={cn(
                              "py-2.5 px-4 rounded-xl text-xs font-medium font-sans transition-all cursor-pointer border flex items-center justify-center gap-2",
                              isSelected
                                ? "bg-foreground text-background border-foreground shadow-xs"
                                : "bg-secondary/40 text-foreground border-border/60 hover:bg-secondary"
                            )}
                          >
                            <Coins className="h-3.5 w-3.5" />
                            <span>{tok}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Network Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-sans font-medium text-foreground">
                      Network
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "solana", label: "Solana" },
                        { id: "bnb", label: "BNB Chain" },
                        { id: "polygon", label: "Polygon" },
                      ].map((net) => {
                        const isSelected = selectedNetwork === net.id;
                        return (
                          <button
                            key={net.id}
                            type="button"
                            onClick={() => setSelectedNetwork(net.id as any)}
                            className={cn(
                              "py-2.5 px-3 rounded-xl text-xs font-medium font-sans transition-all cursor-pointer border text-center",
                              isSelected
                                ? "bg-foreground text-background border-foreground shadow-xs"
                                : "bg-secondary/40 text-foreground border-border/60 hover:bg-secondary"
                            )}
                          >
                            {net.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Summary & Checkout Action */}
              <div className="pt-2 border-t border-border/40 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-sans">Total to Credit:</span>
                  <span className="font-semibold text-foreground font-mono text-sm">
                    ${activeAmountUsd.toFixed(2)} USD
                  </span>
                </div>

                <Button
                  onClick={handleOpenCheckout}
                  className="w-full h-11 rounded-xl text-sm font-medium bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {paymentMethod === "crypto" ? (
                    <>
                      <span>
                        Pay ${activeAmountUsd.toFixed(2)} with {selectedToken} (
                        {NETWORK_DETAILS[selectedNetwork].name})
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <span>
                        Pay Rp {activeAmountIdr.toLocaleString("id-ID")} with QRIS
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-muted-foreground font-light text-center">
                  Payments are processed on automated nodes and credited immediately.
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* 3. Transaction / Deposit History Table */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-serif font-normal text-foreground">
                Deposit History.
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Recent transactions and deposits to your account.
              </p>
            </div>
          </div>

          <Card className="rounded-2xl border-none bg-card overflow-hidden shadow-none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="w-[20%] min-w-[150px] pl-6 text-xs font-sans font-medium text-muted-foreground">
                      Date &amp; Time
                    </TableHead>
                    <TableHead className="w-[15%] min-w-[100px] text-xs font-sans font-medium text-muted-foreground">
                      Method
                    </TableHead>
                    <TableHead className="w-[25%] min-w-[160px] text-xs font-sans font-medium text-muted-foreground">
                      Description / Tx
                    </TableHead>
                    <TableHead className="w-[15%] min-w-[100px] text-xs font-sans font-medium text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableHead className="w-[12%] min-w-[90px] text-xs font-sans font-medium text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="w-[13%] min-w-[100px] pr-6 text-right text-xs font-sans font-medium text-muted-foreground">
                      Balance After
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!creditTransactions || creditTransactions.length === 0 ? (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-xs text-muted-foreground font-light"
                      >
                        No deposit transactions yet. Make your first deposit above to start building with paid models.
                      </TableCell>
                    </TableRow>
                  ) : (
                    creditTransactions.map((tx) => (
                      <TableRow
                        key={tx._id}
                        className="border-none hover:bg-secondary/20 transition-colors"
                      >
                        <TableCell className="py-4 pl-6 text-xs font-sans text-muted-foreground tabular-nums">
                          {new Date(tx.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-sans text-foreground">
                          {tx.paymentMethod === "crypto" ? (
                            <span className="flex items-center gap-1.5 font-medium">
                              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                              {tx.token} ({tx.network})
                            </span>
                          ) : tx.paymentMethod === "qris" ? (
                            <span className="flex items-center gap-1.5 font-medium text-rose-500">
                              <QrCode className="h-3.5 w-3.5" />
                              QRIS (IDR)
                            </span>
                          ) : (
                            <span className="capitalize">{tx.paymentMethod}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-mono text-muted-foreground">
                          <div className="truncate max-w-[200px]" title={tx.description}>
                            {(tx as any).txHash ? (
                              <span className="text-foreground">{(tx as any).txHash.slice(0, 16)}...</span>
                            ) : (
                              tx.description
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-mono font-medium">
                          <span
                            className={
                              tx.type === "deposit"
                                ? "text-emerald-500"
                                : "text-foreground"
                            }
                          >
                            {tx.type === "deposit" ? "+" : "-"}${tx.amountUsd.toFixed(4)}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span
                            className={cn(
                              "text-[10px] font-sans px-2 py-0.5 rounded-full font-medium inline-block uppercase",
                              tx.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : tx.status === "pending"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            )}
                          >
                            {tx.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right text-xs font-mono font-medium text-foreground tabular-nums">
                          ${tx.balanceAfterUsd.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* 4. Checkout Dialog / Payment Confirmation Modal */}
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl bg-card border-none p-6 space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-serif font-normal text-foreground">
                {paymentMethod === "crypto" ? "Deposit with Crypto" : "Pay with QRIS"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-light">
                {paymentMethod === "crypto"
                  ? `Send exact ${selectedToken} on ${NETWORK_DETAILS[selectedNetwork].name} network.`
                  : "Scan the QR code with any Indonesian banking or e-wallet app."}
              </DialogDescription>
            </DialogHeader>

            {paymentMethod === "crypto" ? (
              /* Crypto Modal Content */
              <div className="space-y-4 py-2">
                <div className="bg-secondary/40 p-4 rounded-xl space-y-2 text-center">
                  <div className="text-xs text-muted-foreground">Amount to send:</div>
                  <div className="text-2xl font-mono font-semibold text-foreground">
                    ${activeAmountUsd.toFixed(2)} {selectedToken}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-sans">
                    Network: {NETWORK_DETAILS[selectedNetwork].name}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Deposit Address
                  </label>
                  <div className="flex items-center gap-2 bg-secondary/50 p-2.5 rounded-xl border border-border/40">
                    <span className="text-xs font-mono text-muted-foreground break-all select-all flex-1">
                      {NETWORK_DETAILS[selectedNetwork].depositAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAddress(NETWORK_DETAILS[selectedNetwork].depositAddress)
                      }
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
                    >
                      {copiedAddress ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground/80 space-y-1 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-700 dark:text-amber-400">
                  <p className="font-medium">Important:</p>
                  <p>
                    Send only {selectedToken} via {NETWORK_DETAILS[selectedNetwork].name}.
                    Sending other tokens will result in permanent loss.
                  </p>
                </div>
              </div>
            ) : (
              /* QRIS Modal Content */
              <div className="space-y-4 py-2 text-center">
                <div className="bg-white text-black p-6 rounded-2xl mx-auto w-64 shadow-md space-y-3 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
                    QRIS · STANDAR PEMBAYARAN NASIONAL
                  </div>

                  {/* Mock Visual QR Code SVG */}
                  <div className="w-44 h-44 bg-slate-900 rounded-lg p-2 flex items-center justify-center relative">
                    <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                      {/* Standard QR Code corner markers */}
                      <rect x="5" y="5" width="25" height="25" rx="2" />
                      <rect x="10" y="10" width="15" height="15" fill="#0f172a" />
                      <rect x="13" y="13" width="9" height="9" />

                      <rect x="70" y="5" width="25" height="25" rx="2" />
                      <rect x="75" y="10" width="15" height="15" fill="#0f172a" />
                      <rect x="78" y="13" width="9" height="9" />

                      <rect x="5" y="70" width="25" height="25" rx="2" />
                      <rect x="10" y="75" width="15" height="15" fill="#0f172a" />
                      <rect x="13" y="78" width="9" height="9" />

                      {/* Random Data Pattern Dots */}
                      <rect x="35" y="10" width="8" height="8" />
                      <rect x="48" y="10" width="8" height="8" />
                      <rect x="35" y="24" width="6" height="6" />
                      <rect x="45" y="24" width="8" height="8" />
                      <rect x="10" y="38" width="8" height="8" />
                      <rect x="22" y="38" width="6" height="6" />
                      <rect x="35" y="38" width="8" height="8" />
                      <rect x="48" y="38" width="8" height="8" />
                      <rect x="62" y="38" width="8" height="8" />
                      <rect x="75" y="38" width="8" height="8" />
                      <rect x="10" y="50" width="8" height="8" />
                      <rect x="25" y="50" width="8" height="8" />
                      <rect x="38" y="50" width="8" height="8" />
                      <rect x="52" y="50" width="8" height="8" />
                      <rect x="66" y="50" width="8" height="8" />
                      <rect x="80" y="50" width="8" height="8" />
                      <rect x="35" y="65" width="8" height="8" />
                      <rect x="48" y="65" width="8" height="8" />
                      <rect x="62" y="65" width="8" height="8" />
                      <rect x="75" y="65" width="8" height="8" />
                      <rect x="35" y="78" width="8" height="8" />
                      <rect x="48" y="78" width="8" height="8" />
                      <rect x="62" y="78" width="8" height="8" />
                      <rect x="75" y="78" width="8" height="8" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white p-1 rounded-sm shadow text-[8px] font-bold text-black font-sans">
                        CONST
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-800">
                      Const Router Gateway
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      NMID: ID102488392019
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-sans">Total Bayar:</div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    Rp {activeAmountIdr.toLocaleString("id-ID")}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-sans flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Expires in 14:59 minutes</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsCheckoutOpen(false)}
                disabled={isSimulatingPayment}
                className="w-full sm:w-auto rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSimulatePayment}
                disabled={isSimulatingPayment}
                className="w-full sm:w-auto rounded-xl text-xs font-medium bg-foreground text-background hover:bg-foreground/90 gap-2 cursor-pointer"
              >
                {isSimulatingPayment ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Simulate Payment &amp; Credit Account</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
