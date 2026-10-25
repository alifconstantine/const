"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { BUILTIN_MODELS, type ModelSpec } from "@/lib/model-specs";
import { Button, Input, Badge, ScrollArea, toast, cn } from "@const/ui";
import { Copy, Search, ShieldCheck } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { calculateQuotaMetrics } from "@/lib/quota";

const MODEL_SAVINGS: Record<
  string,
  { savePercent: string; officialInput: string; officialOutput: string }
> = {
  "deepseek-v4.1-flash": { savePercent: "91.1%", officialInput: "$0.140", officialOutput: "$0.280" },
  "qwen-3.8-omni-flash": { savePercent: "91.1%", officialInput: "$0.140", officialOutput: "$0.280" },
  "glm-5.3-flash": { savePercent: "87.5%", officialInput: "$0.100", officialOutput: "$0.200" },
  "gemini-3.8-flash": { savePercent: "73.3%", officialInput: "$0.075", officialOutput: "$0.300" },
  "glm-5.3": { savePercent: "82.5%", officialInput: "$0.200", officialOutput: "$0.600" },
  "minimax-m3.1-flash": { savePercent: "82.5%", officialInput: "$0.200", officialOutput: "$0.600" },
  "qwen-3.8-max": { savePercent: "87.5%", officialInput: "$0.400", officialOutput: "$1.200" },
  "gpt-6.1-sol": { savePercent: "84.0%", officialInput: "$1.500", officialOutput: "$6.000" },
  "gpt-6-astra": { savePercent: "82.0%", officialInput: "$2.500", officialOutput: "$10.000" },
  "claude-haiku-5.5": { savePercent: "86.3%", officialInput: "$0.800", officialOutput: "$4.000" },
  "claude-sonnet-5.5": { savePercent: "73.7%", officialInput: "$3.000", officialOutput: "$15.000" },
  "grok-4.7": { savePercent: "86.0%", officialInput: "$1.000", officialOutput: "$3.000" },
};

export function ModelCatalog({
  models = BUILTIN_MODELS,
}: {
  models?: ModelSpec[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const categories = [
    { id: "all", label: "All models" },
    { id: "llm", label: "Chat" },
    { id: "stt", label: "Audio" },
    { id: "search", label: "Search" },
  ];

  const visible = models.filter(
    (m) =>
      (category === "all" || m.category === category) &&
      (m.modelId + " " + m.name).toLowerCase().includes(search.toLowerCase()),
  );

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Model ID copied");
    } catch {
      toast.error("Could not access clipboard");
    }
  }

  return (
    <div className="space-y-8">
      {/* Search and Category Filter (Anti-slop clean segmented buttons) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 rounded-xl bg-card border-border/60"
            aria-label="Search models"
            placeholder="Search by model name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Minimal segmented filter */}
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                category === c.id
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {(["free", "paid"] as const).map((tier) => {
        const items = visible.filter((m) => m.tier === tier);
        return (
          <section key={tier} className="space-y-4">
            <div className="flex flex-wrap justify-between gap-2 items-baseline">
              <h2 className="text-xl font-medium tracking-tight">
                {tier === "free" ? "Free models" : "Paid models"}{" "}
                <span className="text-xs text-muted-foreground font-mono ml-2 font-normal">
                  {items.length} available
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {tier === "free"
                  ? "Uses weekly free token allowance (7M tokens)"
                  : "Metered per token from credit balance with wholesale savings"}
              </p>
            </div>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <ScrollArea orientation="horizontal">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-secondary/40 text-xs text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="px-5 py-3.5 font-normal">Model</th>
                      <th className="px-5 py-3.5 font-normal">Context</th>
                      <th className="px-5 py-3.5 font-normal text-right">Input / 1M</th>
                      <th className="px-5 py-3.5 font-normal text-right">Cached Input</th>
                      <th className="px-5 py-3.5 font-normal text-right">Output / 1M</th>
                      <th className="px-5 py-3.5 font-normal text-right">You Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {items.map((model) => {
                      const savings = MODEL_SAVINGS[model.modelId];
                      const isFreeTier = model.tier === "free";

                      return (
                        <tr key={model.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="p-5">
                            <div>
                              <div className="font-medium flex gap-2 items-center text-foreground">
                                {model.name}
                                <Badge
                                  variant="secondary"
                                  className="font-mono text-[10px] px-1.5 py-0 uppercase"
                                >
                                  {model.category === "llm"
                                    ? "Chat"
                                    : model.category === "stt"
                                      ? "Audio"
                                      : "Search"}
                                </Badge>
                              </div>
                              <button
                                type="button"
                                onClick={() => copy(model.modelId)}
                                className="text-xs text-muted-foreground font-mono flex gap-1.5 items-center mt-1 hover:text-foreground cursor-pointer group"
                                title="Copy model ID"
                              >
                                <span>{model.modelId}</span>
                                <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                              </button>
                            </div>
                          </td>

                          <td className="p-5 text-xs text-muted-foreground font-mono">
                            {model.contextWindow || "1M"}
                          </td>

                          <td className="p-5 tabular-nums text-xs text-right">
                            <span className="font-medium text-foreground">
                              {model.pricing?.input}
                            </span>
                            {savings?.officialInput && (
                              <span className="block text-[11px] text-muted-foreground line-through">
                                {savings.officialInput}
                              </span>
                            )}
                          </td>

                          <td className="p-5 tabular-nums text-xs text-right text-muted-foreground font-mono">
                            {model.pricing?.cache ?? "—"}
                          </td>

                          <td className="p-5 tabular-nums text-xs text-right">
                            <span className="font-medium text-foreground">
                              {model.pricing?.output}
                            </span>
                            {savings?.officialOutput && (
                              <span className="block text-[11px] text-muted-foreground line-through">
                                {savings.officialOutput}
                              </span>
                            )}
                          </td>

                          {/* "You Save" Column replacing Test button */}
                          <td className="p-5 text-right">
                            {isFreeTier ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-secondary text-foreground border border-border/60">
                                100% Free
                              </span>
                            ) : savings?.savePercent ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Save {savings.savePercent}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {!items.length && (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground text-xs"
                          colSpan={6}
                        >
                          No matching {tier} models.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ConnectedCatalog() {
  const { isAuthenticated } = useRouterAuth();
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip",
  );
  const metrics = calculateQuotaMetrics(quota);

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Models & pricing</h1>
        <p className="text-sm text-muted-foreground">
          Call frontier models with wholesale rates or weekly free allowance. Copy the exact model ID into your SDK or agent config.
        </p>
      </header>

      <div className="bg-card border border-border/60 rounded-xl px-5 py-4 text-sm flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {quota ? metrics.formattedRemaining : "—"} free tokens remaining this week
          </span>
        </div>
        <span className="text-muted-foreground text-xs">
          Resets weekly. Free tier models use this allowance; paid models debit credit balance.
        </span>
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
