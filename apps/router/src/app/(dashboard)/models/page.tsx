"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import {
  ModelRate,
  OfficialPricingNote,
  OfficialRateComparison,
} from "@/components/models/model-rate";
import {
  BUILTIN_MODELS,
  parseUsdRate,
  type ModelSpec,
} from "@/lib/model-specs";
import { Button, Input, toast, cn } from "@const/ui";
import { Copy, Search, ArrowUpRight } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { formatUsd } from "@/lib/router-analytics";

type GroupMode = "provider" | "pricing" | "none";
type SortMode = "cheapest" | "priciest";

const GROUP_OPTIONS = [
  ["provider", "By Provider"],
  ["pricing", "By Pricing"],
  ["none", "Flat List"],
] as const;

const SORT_OPTIONS = [
  ["cheapest", "Cheapest"],
  ["priciest", "Priciest"],
] as const;

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
  const inputRate = parseUsdRate(model.pricing?.input);
  if (inputRate <= 0.1) {
    return {
      key: "flash",
      title: "Flash & High-Volume (≤ $0.10 / 1M input)",
      subtitle: "Low input rates for daily coding agents and high-volume workloads",
      order: 1,
    };
  }
  if (inputRate <= 0.65) {
    return {
      key: "balanced",
      title: "Balanced Pro (over $0.10 to $0.65 / 1M input)",
      subtitle: "Multimodal and reasoning models for everyday work",
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
  const categories = [
    ["all", "All categories"],
    ["llm", "Chat"],
    ["stt", "Audio"],
    ["search", "Search"],
    ...(models.some((model) => model.category === "image")
      ? [["image", "Image"]]
      : []),
  ] as const;

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
      const inA = parseUsdRate(a.pricing?.input);
      const inB = parseUsdRate(b.pricing?.input);
      if (sortBy === "priciest") return inB - inA;
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
                const r = parseUsdRate(cur.pricing?.input);
                return r < parseUsdRate(best.pricing?.input)
                  ? cur
                  : best;
              }, llmItems[0]!)
            : undefined;
          const minRate = minInput
            ? minInput.pricing?.input
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

  const identity = (model: ModelSpec) => (
    <div className="min-w-0 sm:space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{model.name}</span>
        {model.vendorName && model.vendor !== "const" && groupBy !== "provider" && (
          <span className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {model.vendorName}
          </span>
        )}
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

  return (
    <div className="space-y-4 [container-type:inline-size] sm:space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 bg-card pl-9 lg:h-10"
            aria-label="Search models"
            placeholder="Search model, ID, or provider"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:hidden">
          {[
            {
              label: "Provider",
              value: vendorFilter,
              onChange: setVendorFilter,
              options: [["all", "All providers"], ...vendors],
            },
            { label: "Category", value: category, onChange: setCategory, options: categories },
            {
              label: "Group by",
              value: groupBy,
              onChange: (value: string) => setGroupBy(value as GroupMode),
              options: GROUP_OPTIONS,
            },
            {
              label: "Sort by",
              value: sortBy,
              onChange: (value: string) => setSortBy(value as SortMode),
              options: SORT_OPTIONS,
            },
          ].map(({ label, value, onChange, options }) => (
            <label key={label} className="min-w-0 space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">{label}</span>
              <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-card px-2.5 text-sm text-foreground"
              >
                {options.map(([option, name]) => (
                  <option key={option} value={option}>{name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <div
            className="inline-flex items-center rounded-lg border border-border bg-card p-1"
            role="group"
            aria-label="Group models by"
          >
            {GROUP_OPTIONS.map(([value, label]) => (
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
            {SORT_OPTIONS.map(([value, label]) => (
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
            {categories.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  category === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "all" ? "All" : label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Provider filter pills */}
      <div
        className="hidden flex-wrap items-center gap-1.5 lg:flex"
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
          Showing {visible.length} of {models.length} models
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
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border bg-secondary/25 px-3 py-3 sm:px-5 sm:py-3.5">
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
              <div className="divide-y divide-border [@container_(min-width:820px)]:hidden">
                {section.items.map((model) => (
                  <article key={model.modelId} className="space-y-2 px-3 py-4 sm:space-y-3 sm:px-5">
                    {identity(model)}
                    <p className="text-xs text-muted-foreground">
                      {categoryName(model.category)} ·{" "}
                      {model.contextWindow && model.contextWindow !== "-"
                        ? `${model.contextWindow} context`
                        : "Context not applicable"}
                      {model.maxOutputTokens && model.maxOutputTokens !== "-"
                        ? ` · ${model.maxOutputTokens} max output`
                        : ""}
                    </p>
                    <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Input</dt>
                        <dd className="mt-1 text-base">
                          <ModelRate model={model} field="input" showUnit />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Cached input</dt>
                        <dd className="mt-1 text-base">
                          <ModelRate model={model} field="cache" />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Output</dt>
                        <dd className="mt-1 text-base">
                          <ModelRate model={model} field="output" />
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden [@container_(min-width:820px)]:block">
                <table className="w-full text-left text-xs">
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
                        "Vs. official",
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
                          <ModelRate model={model} field="input" showComparison={false} showUnit />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ModelRate model={model} field="cache" showComparison={false} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ModelRate model={model} field="output" showComparison={false} />
                        </td>
                        <td className="px-5 py-4">
                          <OfficialRateComparison model={model} />
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
        <OfficialPricingNote />
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
    <div className="mx-auto max-w-7xl space-y-5 pb-12 sm:space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3 sm:gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Models &amp; pricing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Compare fixed Const rates with official API pricing. See model
            evaluations in the{" "}
            <Link href="/benchmark" className="text-[var(--router-highlight)] underline">
              Benchmark
            </Link>.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/docs">
            API documentation <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-xl border border-border bg-card px-3 py-1.5 sm:px-5 sm:py-4">
        <p className="text-sm">
          {wallet
            ? formatUsd(wallet.availableUsd) + " available credit"
            : "Loading your balance…"}
        </p>
        <Link href="/credits" className="inline-flex items-center text-xs font-medium hover:underline max-sm:min-h-11">
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
