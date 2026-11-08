import { parseUsdRate, type ModelSpec } from "@/lib/model-specs";
import { formatUsd } from "@/lib/router-analytics";

const comparisonFields = [
  ["input", "Input"],
  ["cache", "Cached input"],
  ["output", "Output"],
] as const;

type RateField = (typeof comparisonFields)[number][0];

function compareOfficialRate(model: ModelSpec, field: RateField) {
  const rate = model.pricing?.[field];
  const official = parseUsdRate(model.officialPricing?.[field]);
  if (model.category !== "llm" || !rate || rate === "-" || official <= 0) {
    return null;
  }

  const savings = Math.round((1 - parseUsdRate(rate) / official) * 1000) / 10;
  const difference = savings === 0
    ? "Same price"
    : `${Math.abs(savings)}% ${savings > 0 ? "lower" : "higher"}`;

  return { official, difference };
}

export function ModelRate({
  model,
  field,
  showComparison = true,
  showUnit = false,
}: {
  model: ModelSpec;
  field: RateField;
  showComparison?: boolean;
  showUnit?: boolean;
}) {
  const rate = model.pricing?.[field];
  if (!rate || rate === "-") return <span>—</span>;

  const comparison = compareOfficialRate(model, field);
  if (!comparison) {
    return (
      <span className="font-medium tabular-nums">
        {rate}
        {showUnit && model.category !== "llm" && model.pricing?.unit && (
          <span className="block text-[11px] font-normal leading-4 text-muted-foreground">
            {model.pricing.unit}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5 tabular-nums">
      <span className="font-semibold text-[color:var(--rp-accent,var(--router-highlight))]">
        <span className="sr-only">Const </span>
        {rate}
      </span>
      <span className="text-[11px] leading-4 text-[color:var(--rp-muted,hsl(var(--muted-foreground)))]">
        Official {formatUsd(comparison.official)}
      </span>
      {showComparison && (
        <span className="text-[11px] leading-4 text-[color:var(--rp-muted,hsl(var(--muted-foreground)))]">
          {comparison.difference}
        </span>
      )}
    </span>
  );
}

export function OfficialRateComparison({ model }: { model: ModelSpec }) {
  const differences = comparisonFields.flatMap(([field, label]) => {
    const comparison = compareOfficialRate(model, field);
    return comparison ? [{ label, difference: comparison.difference }] : [];
  });

  if (!differences.length) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Official comparison unavailable</span>
      </span>
    );
  }

  return (
    <dl className="space-y-0.5 whitespace-nowrap text-[11px] leading-4">
      {differences.map(({ label, difference }) => (
        <div key={label} className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{difference}</dd>
        </div>
      ))}
    </dl>
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
