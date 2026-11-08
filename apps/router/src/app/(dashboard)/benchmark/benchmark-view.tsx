"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@const/ui";
import { artificialAnalysisUrl, benchmarkSnapshot } from "./benchmark-data";

type BenchmarkRow = {
  id: string;
  name: string;
  creator: string;
  score: number | null;
  variant?: string;
  url: string;
};

type SortOrder = "highest" | "lowest" | "name";
const selectClass = "h-11 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:w-44 sm:px-3 lg:h-9 lg:w-40 lg:text-xs";

export function BenchmarkView({ rows }: { rows: BenchmarkRow[] }) {
  const [creator, setCreator] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("highest");
  const creators = [...new Set(rows.map((row) => row.creator))].sort((a, b) => a.localeCompare(b));
  const visibleRows = rows
    .filter((row) => !creator || row.creator === creator)
    .sort((a, b) => {
      if (sortOrder === "name" || a.score === b.score) return a.name.localeCompare(b.name);
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return sortOrder === "lowest" ? a.score - b.score : b.score - a.score;
    });

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-12 sm:space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Benchmark</h1>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Creator</span>
          <select
            value={creator}
            onChange={(event) => setCreator(event.target.value)}
            className={selectClass}
          >
            <option value="">All creators</option>
            {creators.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Sort by</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className={selectClass}
          >
            <option value="highest">Highest index</option>
            <option value="lowest">Lowest index</option>
            <option value="name">Model A–Z</option>
          </select>
        </label>
        <p className="sr-only" aria-live="polite">{visibleRows.length} models</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Artificial Analysis Intelligence Index by model</caption>
          <thead className="border-b border-border bg-secondary/25 text-muted-foreground">
            <tr className="text-xs lg:text-sm [&>th]:px-2 [&>th]:py-3 [&>th]:font-medium [&>th:first-child]:pl-3 lg:[&>th]:px-5 lg:[&>th:first-child]:pl-5">
              <th scope="col" aria-sort={sortOrder === "name" ? "ascending" : undefined}>Model</th>
              <th scope="col" className="hidden w-[25%] lg:table-cell">Creator</th>
              <th
                scope="col"
                aria-sort={sortOrder === "name" ? undefined : sortOrder === "highest" ? "descending" : "ascending"}
                className="w-14 text-right lg:w-44"
              >
                <span className="sr-only lg:not-sr-only">Intelligence Index</span>
                <span aria-hidden="true" className="lg:hidden">Index</span>
              </th>
              <th scope="col" className="w-[4.75rem] lg:w-24">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map(({ id, name, creator, score, variant, url }) => (
              <tr key={id} className="[&>*]:px-2 [&>*]:py-2 [&>th]:pl-3 lg:[&>*]:px-5 lg:[&>th]:pl-5">
                <th scope="row" className="break-words font-medium">
                  {name}
                  <span className="block text-xs font-normal leading-snug text-muted-foreground lg:text-[11px]">
                    <span className="lg:hidden">{creator}{variant && <span aria-hidden="true"> · </span>}</span>
                    {variant}
                  </span>
                </th>
                <td className="hidden break-words text-muted-foreground lg:table-cell">{creator}</td>
                <td className="text-right text-base font-semibold tabular-nums lg:text-sm lg:font-medium">{score ?? "N/A"}</td>
                <td className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-11 min-w-11 gap-1 px-2 text-xs lg:h-9">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${name} on Artificial Analysis (opens in a new tab)`}
                    >
                      View <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Source:{" "}
        <a href={`${artificialAnalysisUrl}/methodology/intelligence-benchmarking`} className="underline">Artificial Analysis</a>
        {" · "}Intelligence Index v{benchmarkSnapshot.version}{" · "}Snapshot {benchmarkSnapshot.date}
      </p>
    </div>
  );
}
