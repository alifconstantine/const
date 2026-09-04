"use client";

import { useState, useMemo } from "react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  Card,
  Button,
  Badge,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  toast,
} from "@const/ui";
import {
  Key,
  Plus,
  Search,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
  Trash2,
  Ban,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

export default function KeysPage() {
  const { isAuthenticated, signIn } = useRouterAuth();

  // 1. Live Convex Data
  const keys = useQuery(
    api.router.keys.listKeys,
    isAuthenticated ? {} : "skip"
  );
  const createKeyMutation = useMutation(api.router.keys.createKey);
  const revokeKeyMutation = useMutation(api.router.keys.revokeKey);
  const deleteKeyMutation = useMutation(api.router.keys.deleteKey);

  // 2. Local State
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKeyText, setCopiedKeyText] = useState<string | null>(null);

  // Dialog State: Create Key
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDailyLimit, setNewKeyDailyLimit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog State: One-Time Reveal Modal
  const [revealKey, setRevealKey] = useState<{
    name: string;
    rawKey: string;
    keyPrefix: string;
  } | null>(null);
  const [copiedRevealKey, setCopiedRevealKey] = useState(false);
  const [showPlainKey, setShowPlainKey] = useState(true);

  // State for revoking / deleting loading indicators
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filter keys by search query
  const filteredKeys = useMemo(() => {
    if (!keys) return [];
    if (!searchQuery.trim()) return keys;
    const query = searchQuery.toLowerCase().trim();
    return keys.filter(
      (k) =>
        k.name.toLowerCase().includes(query) ||
        k.keyPrefix.toLowerCase().includes(query)
    );
  }, [keys, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyText(text);
    toast.success("Copied to clipboard", {
      description: label,
    });
    setTimeout(() => setCopiedKeyText(null), 2000);
  };

  // Submit new key creation
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKeyName.trim();
    if (!trimmed) {
      toast.error("Please enter a name for your API key");
      return;
    }

    setIsSubmitting(true);
    try {
      const dailyCap = newKeyDailyLimit.trim()
        ? parseInt(newKeyDailyLimit.trim(), 10)
        : undefined;

      const result = await createKeyMutation({
        name: trimmed,
        dailyLimitTokens: dailyCap && !isNaN(dailyCap) ? dailyCap : undefined,
      });

      // Close create dialog & open one-time reveal modal
      setIsCreateOpen(false);
      setNewKeyName("");
      setNewKeyDailyLimit("");
      setRevealKey({
        name: result.name,
        rawKey: result.rawKey,
        keyPrefix: result.keyPrefix,
      });
      toast.success("API key created successfully");
    } catch (err: any) {
      toast.error("Failed to create key", {
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke key
  const handleRevoke = async (keyId: Id<"apiKeys">, name: string) => {
    if (!confirm(`Are you sure you want to revoke "${name}"? Any applications using this key will immediately stop working.`)) {
      return;
    }

    setActionLoadingId(keyId);
    try {
      await revokeKeyMutation({ keyId });
      toast.success("API key revoked", {
        description: `${name} has been revoked and can no longer make gateway requests.`,
      });
    } catch (err: any) {
      toast.error("Failed to revoke key", {
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete key
  const handleDelete = async (keyId: Id<"apiKeys">, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoadingId(keyId);
    try {
      await deleteKeyMutation({ keyId });
      toast.success("API key deleted", {
        description: `${name} was permanently removed.`,
      });
    } catch (err: any) {
      toast.error("Failed to delete key", {
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (epochMs: number) => {
    return new Date(epochMs).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-12">
        {/* 1. Breadcrumb: Dashboard > API Keys */}
        <Breadcrumb>
          <BreadcrumbList className="text-xs font-sans">
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/40" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-foreground">
                API Keys
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 2. Heading (Lora serif, declarative sentence with period per DESIGN.md) */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
            API Keys.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Manage your gateway access keys, inspect usage tokens, and configure rate caps.
          </p>
        </div>


        {/* 4. Controls: Search + Create Key Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search keys by name or prefix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
            />
          </div>

          {/* Create Button */}
          {isAuthenticated ? (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-full gap-2 text-xs font-medium cursor-pointer h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create new secret key</span>
            </Button>
          ) : (
            <Button
              onClick={() => signIn("/keys")}
              className="rounded-full gap-2 text-xs font-medium cursor-pointer h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Sign in to manage keys</span>
            </Button>
          )}
        </div>

        {/* 5. Keys Table Card */}
        <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-none transition-all">
          {!isAuthenticated ? (
            <div className="p-12 text-center space-y-3">
              <Key className="h-8 w-8 mx-auto text-muted-foreground/60 stroke-[1.5]" />
              <h3 className="text-sm font-medium text-foreground">
                Authentication Required
              </h3>
              <p className="text-xs text-muted-foreground font-light max-w-sm mx-auto">
                Sign in with your Const account to generate and manage gateway access keys.
              </p>
              <Button
                onClick={() => signIn("/keys")}
                size="sm"
                className="rounded-full text-xs h-8 px-4 mt-2"
              >
                Sign In
              </Button>
            </div>
          ) : keys === undefined ? (
            /* Loading Skeleton */
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-light">
                Loading secret keys...
              </span>
            </div>
          ) : filteredKeys.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center">
              <Empty className="p-0 border-none">
                <EmptyHeader>
                  <EmptyMedia
                    variant="icon"
                    className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3"
                  >
                    <Key className="h-6 w-6 stroke-[1.5]" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-medium font-sans text-foreground">
                    {searchQuery ? "No matching keys" : "No secret keys created yet"}
                  </EmptyTitle>
                  <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
                    {searchQuery
                      ? `No keys match your query "${searchQuery}".`
                      : "Create your first secret key to start connecting coding agents and custom integrations."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              {!searchQuery && (
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  size="sm"
                  className="rounded-full text-xs h-8 px-4 mt-4"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create Secret Key
                </Button>
              )}
            </div>
          ) : (
            /* Table of Keys */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="w-[28%] min-w-[180px] pl-6 pr-4 text-xs font-sans font-medium text-muted-foreground">
                      Name
                    </TableHead>
                    <TableHead className="w-[26%] min-w-[180px] px-4 text-xs font-sans font-medium text-muted-foreground">
                      Secret Key
                    </TableHead>
                    <TableHead className="w-[16%] min-w-[110px] px-4 text-xs font-sans font-medium text-muted-foreground">
                      Created
                    </TableHead>
                    <TableHead className="w-[14%] min-w-[100px] px-4 text-xs font-sans font-medium text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="w-[16%] min-w-[120px] pl-4 pr-6 text-right text-xs font-sans font-medium text-muted-foreground">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeys.map((keyItem) => {
                    const isRevoked = keyItem.status === "revoked";
                    const isActionLoading = actionLoadingId === keyItem._id;

                    return (
                      <TableRow
                        key={keyItem._id}
                        className="border-border/50 hover:bg-secondary/20 transition-colors"
                      >
                        {/* 1. Name */}
                        <TableCell className="py-4 pl-6 pr-4 font-medium text-sm text-foreground font-sans">
                          {keyItem.name}
                        </TableCell>

                        {/* 2. Key Prefix with Copy button */}
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-muted-foreground select-all">
                              {keyItem.keyPrefix}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      keyItem.keyPrefix,
                                      `Key Prefix (${keyItem.keyPrefix})`
                                    )
                                  }
                                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                  aria-label="Copy key prefix"
                                >
                                  {copiedKeyText === keyItem.keyPrefix ? (
                                    <Check className="h-3.5 w-3.5 text-foreground" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Copy prefix identifier
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>

                        {/* 3. Created Date */}
                        <TableCell className="py-4 px-4 text-xs text-muted-foreground font-sans tabular-nums">
                          {formatDate(keyItem.createdAt)}
                        </TableCell>

                        {/* 4. Status Badge */}
                        <TableCell className="py-4 px-4">
                          {isRevoked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-[10px] font-sans font-medium text-muted-foreground border border-border">
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-sans font-medium border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </TableCell>

                        {/* 5. Actions: Revoke or Delete */}
                        <TableCell className="py-4 pl-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isRevoked && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleRevoke(keyItem._id, keyItem.name)
                                    }
                                    disabled={isActionLoading}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                                    aria-label="Revoke key"
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Ban className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Revoke key
                                </TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleDelete(keyItem._id, keyItem.name)
                                  }
                                  disabled={isActionLoading}
                                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                                  aria-label="Delete key"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Delete key permanently
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* ========================================================= */}
        {/* DIALOG 1: CREATE NEW SECRET KEY MODAL                     */}
        {/* ========================================================= */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="rounded-2xl border border-border/80 bg-card max-w-md p-6 sm:p-7 space-y-4 shadow-xl overflow-hidden">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-lg font-sans font-medium text-foreground tracking-tight">
                Create new secret key
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-light leading-relaxed">
                Give your secret key a recognizable name to keep track of its usage across applications.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateKey} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground font-sans">
                  Key Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cursor IDE Workstation"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  autoFocus
                  required
                  className="w-full h-10 px-3.5 rounded-xl bg-secondary/60 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground font-sans">
                    Daily Token Cap
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Optional
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="e.g. 500000 (Unlimited if blank)"
                  value={newKeyDailyLimit}
                  onChange={(e) => setNewKeyDailyLimit(e.target.value)}
                  min={1}
                  className="w-full h-10 px-3.5 rounded-xl bg-secondary/60 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
                />
                <p className="text-[11px] text-muted-foreground font-light">
                  Optionally limit total tokens consumed per day through this key.
                </p>
              </div>

              <DialogFooter className="pt-4 border-t border-border/60 flex flex-row items-center justify-end gap-3 sm:space-x-0 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-full text-xs h-9 px-4 border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors shadow-none"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !newKeyName.trim()}
                  className="rounded-full text-xs h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-none gap-1.5 cursor-pointer transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Secret Key</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* DIALOG 2: ONE-TIME REVEAL MODAL                           */}
        {/* ========================================================= */}
        <Dialog
          open={!!revealKey}
          onOpenChange={(open) => {
            if (!open) {
              setRevealKey(null);
              setCopiedRevealKey(false);
              setShowPlainKey(true);
            }
          }}
        >
          <DialogContent className="rounded-2xl border border-border/80 bg-card max-w-lg p-6 sm:p-7 space-y-4 shadow-xl overflow-hidden">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-lg font-sans font-medium text-foreground tracking-tight">
                Save your secret key
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-light leading-relaxed">
                Please copy this secret key now. For your security, you will not be able to view it again.
              </DialogDescription>
            </DialogHeader>

            {revealKey && (
              <div className="space-y-4 pt-1 w-full min-w-0">
                <div className="space-y-1.5 w-full min-w-0">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground font-sans">
                      {revealKey.name}
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Secret Key
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-secondary/80 border border-border text-xs font-mono w-full min-w-0">
                    <span
                      className="text-foreground select-all break-all min-w-0 flex-1 font-mono text-xs font-normal leading-relaxed pr-1"
                    >
                      {showPlainKey ? revealKey.rawKey : "•".repeat(Math.min(revealKey.rawKey.length, 36))}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPlainKey(!showPlainKey)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                        title={showPlainKey ? "Hide key" : "Show key"}
                        aria-label={showPlainKey ? "Hide key" : "Show key"}
                      >
                        {showPlainKey ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(revealKey.rawKey);
                          setCopiedRevealKey(true);
                          toast.success("Secret key copied to clipboard");
                          setTimeout(() => setCopiedRevealKey(false), 2000);
                        }}
                        className="rounded-full h-8 px-3.5 text-xs gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none cursor-pointer"
                      >
                        {copiedRevealKey ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Warning callout */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-2.5 text-xs w-full min-w-0">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="font-light leading-relaxed">
                    Store this key securely in your password manager or <code className="font-mono bg-amber-500/15 px-1 py-0.5 rounded">.env</code> file. Do not commit it to public git repositories.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border/60 mt-4 w-full">
              <Button
                type="button"
                onClick={() => {
                  setRevealKey(null);
                  setCopiedRevealKey(false);
                  setShowPlainKey(true);
                }}
                className="w-full rounded-full text-xs h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-none cursor-pointer"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
