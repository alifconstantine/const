import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { BUILTIN_MODELS } from "@/lib/model-specs";
import { artificialAnalysisUrl, benchmarkSlugs, getBenchmarks } from "./benchmark-data";
import "../landing.css";

export const metadata: Metadata = {
  title: "Model Benchmarks | Const Router",
  description: "Find Artificial Analysis intelligence and performance benchmarks for Const Router models.",
};

const benchmarkModels = BUILTIN_MODELS.flatMap((model) => {
  const slug = benchmarkSlugs[model.modelId];
  return model.category === "llm" && slug ? [{ model, slug }] : [];
});
const metrics = [
  { key: "intelligence", label: "Intelligence Index", unit: "" },
  { key: "outputSpeed", label: "Output speed", unit: " tok/s" },
  { key: "firstToken", label: "Time to first token", unit: " s" },
] as const;

function BenchmarkLink({ slug, name }: { slug: string; name: string }) {
  return (
    <a
      href={`${artificialAnalysisUrl}/models/${slug}`}
      className="router-text-link shrink-0"
      aria-label={`View ${name} on Artificial Analysis`}
    >
      View benchmark <ArrowUpRight size={14} />
    </a>
  );
}

export default async function BenchmarkPage() {
  await connection();
  const feed = await getBenchmarks(benchmarkModels.map(({ slug }) => slug));
  const rows = benchmarkModels
    .map((row) => ({ ...row, result: feed?.models.get(row.slug) }))
    .sort((a, b) =>
      (b.result?.intelligence ?? -1) - (a.result?.intelligence ?? -1) ||
      a.model.name.localeCompare(b.model.name),
    );
  const showMetrics = rows.some(({ result }) =>
    metrics.some(({ key }) => result?.[key] != null),
  );

  return (
    <div className="router-public">
      <LandingNavbar />
      <main id="main-content" className="router-container pb-16 pt-12 sm:pb-24 sm:pt-20">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">Model benchmarks</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--rp-muted)]">
              Explore independent evaluations of models available on Const Router.
              Open a model profile for its full results and tested variants.
            </p>
          </div>
          <Link href="/#models" className="router-text-link">
            See model pricing <ArrowUpRight size={16} />
          </Link>
        </header>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--rp-line)] py-4 text-xs text-[var(--rp-muted)]">
          <p>
            Source:{" "}
            <a href={artificialAnalysisUrl} className="font-medium text-[var(--rp-accent)] underline">Artificial Analysis (artificialanalysis.ai)</a>
            {showMetrics && feed?.version != null ? ` · Intelligence Index v${feed.version}` : ""}
          </p>
          <a href={`${artificialAnalysisUrl}/methodology`} className="router-text-link">
            Benchmark methodology <ArrowUpRight size={14} />
          </a>
        </div>
        {showMetrics && (
          <p className="mb-3 text-xs leading-5 text-[var(--rp-muted)]">
            Results apply to the listed test variants. Speed and time to first token are medians measured by Artificial Analysis across its tested providers.
          </p>
        )}
        <table className="router-model-table">
          <caption className="sr-only">Artificial Analysis benchmark profiles for Const Router models</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              {showMetrics && metrics.map(({ key, label }) => (
                <th scope="col" key={key} className="text-right">{label}</th>
              ))}
              <th scope="col">Full results</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ model, slug, result }) => (
              <tr key={model.id}>
                <th scope="row">
                  <span>{result?.name ?? model.name}</span>
                  <code>{model.modelId}</code>
                </th>
                {showMetrics && metrics.map(({ key, unit }) => (
                  <td key={key} className="text-right">{result?.[key] == null ? "—" : `${result[key]}${unit}`}</td>
                ))}
                <td><BenchmarkLink slug={slug} name={model.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="router-model-mobile-list" aria-label="Artificial Analysis model benchmarks">
          {rows.map(({ model, slug, result }) => (
            <li key={model.id}>
              <div className="router-model-mobile-title">
                <div><h3>{result?.name ?? model.name}</h3><code>{model.modelId}</code></div>
                <BenchmarkLink slug={slug} name={model.name} />
              </div>
              {showMetrics && (
                <dl>
                  {metrics.map(({ key, label, unit }) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{result?.[key] == null ? "—" : `${result[key]}${unit}`}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      </main>
      <LandingFooter />
    </div>
  );
}
