"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { BUILTIN_MODELS, type ModelSpec } from "@/lib/model-specs";
import { Button, Input, Badge, ScrollArea, toast } from "@const/ui";
import { Copy, Loader2, Search } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { calculateQuotaMetrics } from "@/lib/quota";
export function ModelCatalog({
  models = BUILTIN_MODELS,
  test,
  testing,
}: {
  models?: ModelSpec[];
  test?: (m: ModelSpec) => void;
  testing?: string | null;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all");
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
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-xl"
            aria-label="Search models"
            placeholder="Search by name or model ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Model category"
          className="bg-secondary px-4 py-2 rounded-xl text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All capabilities</option>
          <option value="llm">Chat models</option>
          <option value="stt">Transcription</option>
          <option value="search">Search</option>
        </select>
      </div>
      {(["free", "paid"] as const).map((tier) => {
        const items = visible.filter((m) => m.tier === tier);
        return (
          <section key={tier} className="space-y-4">
            <div className="flex flex-wrap justify-between gap-2 items-baseline">
              <h2 className="text-xl font-medium">
                {tier === "free" ? "Free models" : "Paid models"}{" "}
                <span className="text-sm text-muted-foreground font-normal ml-2">
                  {items.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {tier === "free"
                  ? "Uses your weekly free token allowance"
                  : "Charged to your credit balance at the rates below"}
              </p>
            </div>
            <div className="rounded-2xl bg-card overflow-hidden">
              <ScrollArea orientation="horizontal">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-secondary/30 text-xs text-muted-foreground">
                    <tr>
                      {[
                        "Model",
                        "Context",
                        "Input",
                        "Cached input",
                        "Output",
                        "",
                      ].map((v, i) => (
                        <th key={i} className="px-5 py-4 font-normal">
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((model) => (
                      <tr key={model.id} className="border-t border-border/40">
                        <td className="p-5">
                          <div className="font-medium flex gap-2 items-center">
                            {model.name}
                            <Badge variant="secondary">
                              {model.category === "llm"
                                ? "Chat"
                                : model.category === "stt"
                                  ? "Audio"
                                  : "Search"}
                            </Badge>
                          </div>
                          <button
                            onClick={() => copy(model.modelId)}
                            className="text-xs text-muted-foreground font-mono flex gap-2 items-center mt-2 hover:text-foreground"
                            title="Copy model ID"
                          >
                            {model.modelId}
                            <Copy size={12} />
                          </button>
                        </td>
                        <td className="p-5 text-xs text-muted-foreground">
                          {model.contextWindow}
                        </td>
                        <td className="p-5 tabular-nums text-xs">
                          {model.pricing?.input}
                          <span className="block text-muted-foreground mt-1">
                            {model.pricing?.unit}
                          </span>
                        </td>
                        <td className="p-5 tabular-nums text-xs">
                          {model.pricing?.cache ?? "—"}
                        </td>
                        <td className="p-5 tabular-nums text-xs">
                          {model.pricing?.output}
                        </td>
                        <td className="p-5">
                          {model.category === "llm" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!test || testing === model.modelId}
                              onClick={() => test?.(model)}
                            >
                              {testing === model.modelId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Test"
                              )}
                            </Button>
                          ) : (
                            <Link className="underline text-xs" href="/docs">
                              API guide
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td
                          className="p-8 text-center text-muted-foreground"
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
  const { isAuthenticated, token } = useRouterAuth(),
    [testing, setTesting] = useState<string | null>(null);
  const quota = useQuery(
      api.router.quotas.getUserQuota,
      isAuthenticated ? {} : "skip",
    ),
    metrics = calculateQuotaMetrics(quota);
  async function test(model: ModelSpec) {
    setTesting(model.modelId);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-const-sso-token": token } : {}),
        },
        body: JSON.stringify({ model: model.modelId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : (data.error?.message ?? "Test failed"),
        );
      toast.success(model.name + " responded", {
        description: data.latency + "ms · This test is included in usage.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setTesting(null);
    }
  }
  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          Models & pricing
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a free variant or pay for usage. Copy the exact model ID into
          your client.
        </p>
      </header>
      <div className="bg-secondary/40 rounded-2xl px-5 py-4 text-sm flex flex-wrap justify-between gap-2">
        <span>
          {quota ? metrics.formattedRemaining : "—"} free tokens left this week
        </span>
        <span className="text-muted-foreground text-xs self-center">
          Only the listed :free IDs qualify. Paid models use credit.
        </span>
      </div>
      <ModelCatalog testing={testing} test={test} />
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
