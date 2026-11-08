import { parseUsdRate, type ModelSpec } from "@/lib/model-specs";
import { formatUsd } from "@/lib/router-analytics";

export function ModelRate({
  model,
  field,
}: {
  model: ModelSpec;
  field: "input" | "cache" | "output";
}) {
  const rate = model.pricing?.[field];
  if (!rate || rate === "-") return <span>—</span>;

  const official =
    model.category === "llm" ? parseUsdRate(model.officialPricing?.[field]) : 0;
  if (official <= 0) {
    return <span className="font-medium tabular-nums">{rate}</span>;
  }
  const savings = Math.round((1 - parseUsdRate(rate) / official) * 1000) / 10;

  return (
    <span className="inline-flex flex-col gap-0.5 tabular-nums">
      <span className="font-semibold text-[color:var(--rp-accent,var(--router-highlight))]">
        <span className="sr-only">Const </span>
        {rate}
      </span>
      <span className="text-[11px] leading-4 text-[color:var(--rp-muted,hsl(var(--muted-foreground)))]">
        Official {formatUsd(official)}
      </span>
      <span className="text-[11px] leading-4 text-[color:var(--rp-muted,hsl(var(--muted-foreground)))]">
        {savings === 0
          ? "Same price"
          : `${Math.abs(savings)}% ${savings > 0 ? "lower" : "higher"}`}
      </span>
    </span>
  );
}

export function OfficialPricingNote() {
  return (
    <>
      Official rates use the 8 Nov 2026{" "}
      <a className="underline" href="https://atmorouter.dev/api/dashboard/catalog">
        AtmoRouter catalog
      </a>{" "}
      and the{" "}
      <a className="underline" href="https://cloud.google.com/blog/products/ai-machine-learning/gemini-4-argon-available-on-google-cloud">
        Google Argon launch rate
      </a>. DeepSeek uses off-peak rates. Cached input compares cache hits.
    </>
  );
}
