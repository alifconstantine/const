import { ArrowUpRight } from "lucide-react";
import { Button } from "@const/ui";

type BenchmarkRow = {
  id: string;
  name: string;
  creator: string;
  score: number | null;
  url: string;
};

export function BenchmarkView({
  rows,
  version,
  notice,
}: {
  rows: BenchmarkRow[];
  version: number | null;
  notice?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <h1 className="text-3xl font-semibold tracking-tight">Benchmark</h1>
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full table-fixed text-left text-xs sm:text-sm">
          <caption className="sr-only">Artificial Analysis Intelligence Index by model</caption>
          <thead className="border-b border-border bg-secondary/25 text-muted-foreground">
            <tr className="[&>th]:px-2 [&>th]:py-3 [&>th]:font-medium sm:[&>th]:px-5">
              <th scope="col">Model</th>
              <th scope="col" className="w-[26%]">Creator</th>
              <th scope="col" className="w-14 text-right sm:w-24 lg:w-60">
                <span className="sr-only lg:not-sr-only">Artificial Analysis Intelligence Index</span>
                <span aria-hidden="true" className="lg:hidden">AA Index</span>
              </th>
              <th scope="col" className="w-16 sm:w-28">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ id, name, creator, score, url }) => (
              <tr key={id} className="[&>*]:px-2 [&>*]:py-2 sm:[&>*]:px-5">
                <th scope="row" className="break-words font-medium">{name}</th>
                <td className="break-words text-muted-foreground">{creator}</td>
                <td className="text-right tabular-nums">{score ?? "—"}</td>
                <td className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-11 min-w-11 gap-1 px-2 text-xs sm:h-9">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${name} on Artificial Analysis (opens in a new tab)`}
                    >
                      View <ArrowUpRight aria-hidden="true" className="hidden size-3.5 sm:block" />
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
        <a href="https://artificialanalysis.ai" className="underline">Artificial Analysis (artificialanalysis.ai)</a>
        {version !== null ? ` · Intelligence Index v${version}.` : ". Open a model profile for its score."}
      </p>
    </div>
  );
}
