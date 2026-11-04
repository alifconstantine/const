"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import {
  BUILTIN_MODELS,
  effectiveModelPricing,
  isPromoActive,
  parseUsdRate,
  type ModelSpec,
} from "@/lib/model-specs";
import { Button, Input, toast, cn } from "@const/ui";
import { Copy, Search, ArrowUpRight, Sparkles } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { formatUsd } from "@/lib/router-analytics";

type GroupMode = "provider" | "pricing" | "none";
type SortMode = "cheapest" | "priciest" | "discount";

const VENDOR_ORDER: Record<string, number> = {
  anthropic: 1,
  openai: 2,
  google: 3,
  deepseek: 4,
  qwen: 5,
  zhipu: 6,
  minimax: 7,
  moonshot: 8,
  xai: 9,
  const: 10,
};

const categoryName = (category?: string) =>
  category === "llm"
    ? "Chat"
    : category === "stt"
      ? "Audio"
      : category === "search"
        ? "Search"
        : category === "image"
          ? "Image"
          : "Other";

const unit = (model: ModelSpec) =>
  effectiveModelPricing(model)?.unit || model.pricing?.unit || "Unit unavailable";

function pricingTierGroup(model: ModelSpec): {
  key: string;
  title: string;
  subtitle: string;
  order: number;
} {
  if (model.category !== "llm") {
    return {
      key: "utility",
      title: "Utility Engines",
      subtitle: "Speech-to-text & web search endpoints",
      order: 4,
    };
  }
  const inputRate = parseUsdRate(effectiveModelPricing(model)?.input);
  if (inputRate <= 0.1) {
    return {
      key: "flash",
      title: "Flash & High-Volume (≤ $0.10 / 1M input)",
      subtitle: "Sub-cent to ultra-low rates for daily coding agents and fast loops",
      order: 1,
    };
  }
  if (inputRate <= 0.65) {
    return {
      key: "balanced",
      title: "Balanced Pro ($0.11 – $0.65 / 1M input)",
      subtitle: "Multimodal & deep-reasoning workhorses with heavy promo savings",
      order: 2,
    };
  }
  return {
    key: "frontier",
    title: "Frontier Flagships (> $0.65 / 1M input)",
    subtitle: "Top-tier Claude, GPT-6, Kimi K3, Gemini 4, and Grok flagship models",
    order: 3,
  };
}

function discountPercentVsOfficial(model: ModelSpec): number {
  if (isPromoActive(model) && model.promo) return model.promo.totalPercentOff;
  const off = parseUsdRate(model.officialPricing?.input);
  const cur = parseUsdRate(effectiveModelPricing(model)?.input);
  if (off > 0 && cur > 0 && cur < off) {
    return Math.round(((off - cur) / off) * 100);
  }
  return 0;
}

export function ModelCatalog({
  models = BUILTIN_MODELS,
}: {
  models?: ModelSpec[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupMode>("provider");
  const [sortBy, setSortBy] = useState<SortMode>("cheapest");

  const vendors = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) {
      if (m.vendor && m.vendorName) {
        map.set(m.vendor, m.vendorName);
      }
    }
    return [...map.entries()].sort(
      (a, b) => (VENDOR_ORDER[a[0]] ?? 99) - (VENDOR_ORDER[b[0]] ?? 99),
    );
  }, [models]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = models.filter(
      (model) =>
        (category === "all" || model.category === category) &&
        (vendorFilter === "all" || model.vendor === vendorFilter) &&
        `${model.modelId} ${model.name} ${model.providerName} ${model.vendorName ?? ""} ${model.vendor ?? ""}`
          .toLowerCase()
          .includes(q),
    );

    return [...filtered].sort((a, b) => {
      if (a.category !== "llm" && b.category === "llm") return 1;
      if (a.category === "llm" && b.category !== "llm") return -1;
      const inA = parseUsdRate(effectiveModelPricing(a)?.input);
      const inB = parseUsdRate(effectiveModelPricing(b)?.input);
      if (sortBy === "priciest") return inB - inA;
      if (sortBy === "discount") {
        const diff = discountPercentVsOfficial(b) - discountPercentVsOfficial(a);
        if (diff !== 0) return diff;
      }
      return inA - inB;
    });
  }, [models, category, vendorFilter, search, sortBy]);

  const sections = useMemo(() => {
    if (groupBy === "none") {
      return [
        {
          key: "all",
          title: "All matching models",
          subtitle: `${visible.length} models`,
          order: 0,
          items: visible,
        },
      ];
    }

    const buckets = new Map<
      string,
      {
        key: string;
        title: string;
        subtitle: string;
        order: number;
        items: ModelSpec[];
      }
    >();

    for (const model of visible) {
      if (groupBy === "provider") {
        const key = model.vendor ?? "const";
        const title = model.vendorName ?? model.providerName ?? "Const";
        const existing = buckets.get(key);
        if (existing) {
          existing.items.push(model);
        } else {
          buckets.set(key, {
            key,
            title,
            subtitle: "",
            order: VENDOR_ORDER[key] ?? 99,
            items: [model],
          });
        }
      } else {
        const tier = pricingTierGroup(model);
        const existing = buckets.get(tier.key);
        if (existing) {
          existing.items.push(model);
        } else {
          buckets.set(tier.key, {
            ...tier,
            items: [model],
          });
        }
      }
    }

    return [...buckets.values()]
      .map((section) => {
        if (groupBy === "provider") {
          const llmItems = section.items.filter((m) => m.category === "llm");
          const minInput = llmItems.length
            ? llmItems.reduce((best, cur) => {
                const r = parseUsdRate(effectiveModelPricing(cur)?.input);
                return r < parseUsdRate(effectiveModelPricing(best)?.input)
                  ? cur
                  : best;
              }, llmItems[0]!)
            : undefined;
          const minRate = minInput
            ? effectiveModelPricing(minInput)?.input
            : undefined;
          return {
            ...section,
            subtitle: minRate
              ? `${section.items.length} ${section.items.length === 1 ? "model" : "models"} · from ${minRate} / 1M input`
              : `${section.items.length} ${section.items.length === 1 ? "utility endpoint" : "utility endpoints"}`,
          };
        }
        return section;
      })
      .sort((a, b) => a.order - b.order);
  }, [visible, groupBy]);

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Model ID copied");
    } catch {
      toast.error("Could not copy. Select the model ID to copy it manually.");
    }
  }

  const renderBadges = (model: ModelSpec) => {
    const promoActive = isPromoActive(model) && model.promo;
    const totalOff = discountPercentVsOfficial(model);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {model.vendorName && model.vendor !== "const" && groupBy !== "provider" && (
          <span className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {model.vendorName}
          </span>
        )}
        {promoActive ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-3" />
            {model.promo!.label} · {model.promo!.totalPercentOff}% off official
          </span>
        ) : totalOff > 0 ? (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {totalOff}% off official
          </span>
        ) : null}
      </div>
    );
  };

  const identity = (model: ModelSpec) => (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{model.name}</span>
        {renderBadges(model)}
      </div>
      <button
        type="button"
        onClick={() => copy(model.modelId)}
        className="inline-flex max-w-full items-center gap-2 rounded-sm text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`Copy model ID ${model.modelId}`}
      >
        <code className="break-all">{model.modelId}</code>
        <Copy className="size-3 shrink-0" />
      </button>
    </div>
  );

  const renderRateCell = (
    model: ModelSpec,
    field: "input" | "output" | "cache",
  ) => {
    const active = effectiveModelPricing(model) ?? model.pricing;
    const currentVal = active?.[field];
    if (!currentVal || currentVal === "-") {
      return <span className="text-muted-foreground">—</span>;
    }
    const promoActive = isPromoActive(model) && Boolean(model.promo);
    const standardVal = model.standardPricing?.[field];
    const officialVal = model.officialPricing?.[field];

    return (
      <div className="space-y-0.5">
        <div className="font-medium text-foreground tabular-nums">
          {currentVal}
        </div>
        {field !== "cache" && (promoActive || officialVal) && (
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {promoActive && standardVal && standardVal !== currentVal && (
              <span className="mr-1.5 line-through opacity-75">
                {standardVal}
              </span>
            )}
            {officialVal && (
              <span className="opacity-80">Off. {officialVal}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top toolbar: Search + Group By + Sort + Category */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="h-10 bg-card pl-9"
            aria-label="Search models"
            placeholder="Search model, ID, or provider (Claude, OpenAI…)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-lg border border-border bg-card p-1"
            role="group"
            aria-label="Group models by"
          >
            {(
              [
                ["provider", "By Provider"],
                ["pricing", "By Pricing"],
                ["none", "Flat List"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={groupBy === value}
                onClick={() => setGroupBy(value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  groupBy === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="inline-flex items-center rounded-lg border border-border bg-card p-1"
            role="group"
            aria-label="Sort models by"
          >
            {(
              [
                ["cheapest", "Cheapest"],
                ["priciest", "Priciest"],
                ["discount", "Top Promo"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sortBy === value}
                onClick={() => setSortBy(value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  sortBy === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="inline-flex flex-wrap items-center rounded-lg border border-border bg-card p-1"
            role="group"
            aria-label="Model category"
          >
            {[
              ["all", "All"],
              ["llm", "Chat"],
              ["stt", "Audio"],
              ["search", "Search"],
              ...(models.some((model) => model.category === "image")
                ? [["image", "Image"]]
                : []),
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value!)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  category === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Provider filter pills */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter by provider"
      >
        <button
          type="button"
          aria-pressed={vendorFilter === "all"}
          onClick={() => setVendorFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            vendorFilter === "all"
              ? "border-foreground/20 bg-secondary text-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          All providers
        </button>
        {vendors.map(([vendorKey, vendorLabel]) => (
          <button
            key={vendorKey}
            type="button"
            aria-pressed={vendorFilter === vendorKey}
            onClick={() =>
              setVendorFilter(vendorFilter === vendorKey ? "all" : vendorKey)
            }
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              vendorFilter === vendorKey
                ? "border-foreground/20 bg-secondary text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {vendorLabel}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <p aria-live="polite">
          Showing {visible.length} of {models.length} models · Standard Const
          rates are 40% below official, plus limited-time extra promos
        </p>
        <p>Prices in USD · per 1M tokens unless noted</p>
      </div>

      {visible.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card px-5 py-14 text-center">
          <p className="text-sm font-medium">No models match these filters.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Try clearing the provider or search filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => {
              setSearch("");
              setCategory("all");
              setVendorFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.key}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {groupBy !== "none" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-secondary/25 px-5 py-3.5">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    {section.title}
                  </h2>
                  {section.subtitle && (
                    <p className="text-xs text-muted-foreground">
                      {section.subtitle}
                    </p>
                  )}
                </div>
              )}

              {/* Mobile cards */}
              <div className="divide-y divide-border md:hidden">
                {section.items.map((model) => (
                  <article key={model.modelId} className="space-y-4 p-5">
                    {identity(model)}
                    <p className="text-xs text-muted-foreground">
                      {categoryName(model.category)} ·{" "}
                      {model.contextWindow && model.contextWindow !== "-"
                        ? `${model.contextWindow} context`
                        : "Context not applicable"}
                      {model.maxOutputTokens && model.maxOutputTokens !== "-"
                        ? ` · ${model.maxOutputTokens} max output`
                        : ""}{" "}
                      · {unit(model)}
                    </p>
                    <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Input</dt>
                        <dd className="mt-1.5">
                          {renderRateCell(model, "input")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Cached input</dt>
                        <dd className="mt-1.5">
                          {renderRateCell(model, "cache")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Output</dt>
                        <dd className="mt-1.5">
                          {renderRateCell(model, "output")}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <caption className="sr-only">
                    {section.title} pricing in USD.
                  </caption>
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      {[
                        "Model",
                        "Context / Max output",
                        "Input",
                        "Cached input",
                        "Output",
                        "Billing unit",
                      ].map((label, index) => (
                        <th
                          key={label}
                          className={cn(
                            "px-5 py-3.5 font-medium",
                            index >= 2 && index <= 4 && "text-right",
                          )}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {section.items.map((model) => (
                      <tr
                        key={model.modelId}
                        className="hover:bg-secondary/30"
                      >
                        <td className="px-5 py-4">{identity(model)}</td>
                        <td className="px-5 py-4 text-muted-foreground">
                          <p>{categoryName(model.category)}</p>
                          <p className="mt-1 tabular-nums">
                            {model.contextWindow && model.contextWindow !== "-"
                              ? `${model.contextWindow} ctx`
                              : "—"}
                            {model.maxOutputTokens &&
                            model.maxOutputTokens !== "-"
                              ? ` · ${model.maxOutputTokens} out`
                              : ""}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {renderRateCell(model, "input")}
                        </td>
                        <td className="px-5 py-4 text-right text-muted-foreground">
                          {renderRateCell(model, "cache")}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {renderRateCell(model, "output")}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                          {unit(model)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="max-w-3xl text-xs leading-6 text-muted-foreground">
        All models are billed from your unified credit balance using exact
        upstream token usage. Limited-time promotional rates automatically
        apply at settlement while active, then revert to Const&apos;s standard
        40%-off-official pricing.
      </p>
    </div>
  );
}

function ConnectedCatalog() {
  const { isAuthenticated } = useRouterAuth();
  const wallet = useQuery(
    api.router.credits.getUserCredits,
    isAuthenticated ? {} : "skip",
  );
  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Models &amp; pricing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Compare frontier models grouped by provider or pricing tier. Standard
            rates start 40% below official vendor pricing, with extra
            limited-time discounts up to 76% off.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/docs">
            API documentation <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-sm">
          {wallet
            ? formatUsd(wallet.availableUsd) + " available credit"
            : "Loading your balance…"}
        </p>
        <Link href="/credits" className="text-xs font-medium hover:underline">
          Add credit with QRIS
        </Link>
      </div>
      <ModelCatalog />
    </div>
  );
}

export default function ModelsPage() {
  return (
    <QueryBoundary name="Models">
      <ConnectedCatalog />
    </QueryBoundary>
  );
}
