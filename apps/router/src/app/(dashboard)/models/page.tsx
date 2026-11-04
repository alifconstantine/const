"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { BUILTIN_MODELS, type ModelSpec } from "@/lib/model-specs";
import { Button, Input, toast, cn } from "@const/ui";
import { Copy, Search, ArrowUpRight } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { formatUsd } from "@/lib/router-analytics";

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
const unit = (model: ModelSpec) => model.pricing?.unit || "Unit unavailable";

export function ModelCatalog({
  models = BUILTIN_MODELS,
}: {
  models?: ModelSpec[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const visible = models.filter(
    (model) =>
      (category === "all" || model.category === category) &&
      `${model.modelId} ${model.name} ${model.providerName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Model ID copied");
    } catch {
      toast.error("Could not copy. Select the model ID to copy it manually.");
    }
  }
  const identity = (model: ModelSpec) => (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{model.name}</span>
      </div>
      <button
        type="button"
        onClick={() => copy(model.modelId)}
        className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-sm text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`Copy model ID ${model.modelId}`}
      >
        <code className="break-all">{model.modelId}</code>
        <Copy className="size-3 shrink-0" />
      </button>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="h-10 bg-card pl-9"
            aria-label="Search models"
            placeholder="Search model name or ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-3">
          <div
            className="flex flex-wrap gap-1"
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
                  "rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
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
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <p aria-live="polite">
          {visible.length} of {models.length} models
        </p>
        <p>Prices in USD · billing unit shown per model</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="divide-y divide-border md:hidden">
          {visible.map((model) => (
            <article key={model.modelId} className="space-y-4 p-5">
              {identity(model)}
              <p className="text-xs text-muted-foreground">
                {categoryName(model.category)} ·{" "}
                {model.contextWindow && model.contextWindow !== "-"
                  ? `${model.contextWindow} context`
                  : "Context not applicable"}{" "}
                · {unit(model)}
              </p>
              <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
                {[
                  ["Input", model.pricing?.input],
                  ["Cached input", model.pricing?.cache],
                  ["Output", model.pricing?.output],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1.5 font-medium tabular-nums">
                      {value ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px] text-left text-xs">
            <caption className="sr-only">
              Model pricing in USD. Rates apply to the unit shown in each row.
            </caption>
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {[
                  "Model",
                  "Type / context",
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
              {visible.map((model) => (
                <tr key={model.modelId} className="hover:bg-secondary/30">
                  <td className="px-5 py-5">{identity(model)}</td>
                  <td className="px-5 py-5 text-muted-foreground">
                    <p>{categoryName(model.category)}</p>
                    <p className="mt-1.5 tabular-nums">
                      {model.contextWindow && model.contextWindow !== "-"
                        ? `${model.contextWindow} tokens`
                        : "—"}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-right tabular-nums">
                    {model.pricing?.input ?? "—"}
                  </td>
                  <td className="px-5 py-5 text-right tabular-nums text-muted-foreground">
                    {model.pricing?.cache ?? "—"}
                  </td>
                  <td className="px-5 py-5 text-right tabular-nums">
                    {model.pricing?.output ?? "—"}
                  </td>
                  <td className="px-5 py-5 whitespace-nowrap text-muted-foreground">
                    {unit(model)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium">
              No models match these filters.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Try a different name or model type.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
      <p className="max-w-3xl text-xs leading-6 text-muted-foreground">
        All models are billed from your credit balance. A dash means no rate is listed for that field.
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
            Models & pricing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Find the right model, compare its rates, and copy the exact ID into
            your client.
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
          {wallet ? formatUsd(wallet.availableUsd) + " available credit" : "Loading your balance…"}
        </p>
        <Link href="/credits" className="text-xs font-medium hover:underline">Add credit with QRIS</Link>
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
