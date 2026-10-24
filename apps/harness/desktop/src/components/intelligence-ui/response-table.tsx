import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Download,
  Maximize2,
  Search,
  X,
} from "lucide-react";
import {
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  ScrollArea,
  toast,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import {
  compareTableValues,
  serializeTableCsv,
  serializeTableTsv,
} from "./format";

interface ResponseTableProps {
  title?: string;
  columns: string[];
  rows: string[][];
  align?: Array<"left" | "center" | "right" | null>;
  renderCell?: (value: string) => React.ReactNode;
}

export function ResponseTable({
  title,
  columns,
  rows,
  align,
  renderCell = (value) => value,
}: ResponseTableProps) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{
    column: number;
    descending: boolean;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const visibleRows = useMemo(() => {
    const query = search.toLocaleLowerCase(language).trim();
    const filtered = rows.filter(
      (row) =>
        !query ||
        row.some((cell) => cell.toLocaleLowerCase(language).includes(query)),
    );
    if (!sort) return filtered;
    const collator = new Intl.Collator(language, {
      numeric: true,
      sensitivity: "base",
    });
    return [...filtered].sort(
      (a, b) =>
        compareTableValues(
          a[sort.column] || "",
          b[sort.column] || "",
          collator,
        ) * (sort.descending ? -1 : 1),
    );
  }, [rows, search, sort, language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        serializeTableTsv(columns, visibleRows),
      );
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.failedToCopy"));
    }
  };

  const download = () => {
    const csv = serializeTableCsv(columns, visibleRows);
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "table.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const actions = (inDialog: boolean) => (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={copy}
        title={t(copied ? "workbench.copiedTable" : "workbench.copyTable")}
        className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={download}
        title={t("workbench.downloadCsv")}
        className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      {inDialog ? (
        <DialogClose asChild>
          <button
            type="button"
            title={t("common.close")}
            className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title={t("workbench.expandTable")}
          className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  const table = (inDialog: boolean) => (
    <ScrollArea
      orientation="both"
      className={cn(
        "w-full min-w-0",
        inDialog ? "min-h-0 flex-1" : "max-h-[420px]",
      )}
      thumbClassName="bg-white/20 hover:bg-white/30"
    >
      <table className="w-full border-separate border-spacing-0 text-[13px] leading-relaxed">
        <thead>
          <tr className="bg-black/[0.025] dark:bg-[#222222]">
            {columns.map((column, index) => (
              <th
                key={index}
                aria-sort={
                  sort?.column === index
                    ? sort.descending
                      ? "descending"
                      : "ascending"
                    : "none"
                }
                className={cn(
                  "px-4 py-2.5 text-left font-medium text-[#737373] dark:text-[#969696]",
                  align?.[index] === "right" && "text-right",
                  align?.[index] === "center" && "text-center",
                )}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 whitespace-nowrap hover:text-black dark:hover:text-white"
                  title={t("intelligenceUi.sortColumn").replace(
                    "{column}",
                    column,
                  )}
                  onClick={() =>
                    setSort((previous) =>
                      previous?.column === index
                        ? previous.descending
                          ? null
                          : { column: index, descending: true }
                        : { column: index, descending: false },
                    )
                  }
                >
                  {renderCell(column)}
                  {sort?.column === index ? (
                    sort.descending ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr
              key={index}
              className="even:bg-black/[0.02] dark:even:bg-white/[0.025] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            >
              {columns.map((_, column) => (
                <td
                  key={column}
                  className={cn(
                    "min-w-[100px] max-w-[440px] break-words px-4 py-3 align-top text-[#262626] dark:text-white",
                    align?.[column] === "right" && "text-right tabular-nums",
                    align?.[column] === "center" && "text-center",
                  )}
                >
                  {renderCell(row[column] || "")}
                </td>
              ))}
            </tr>
          ))}
          {!visibleRows.length && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-[#969696]"
              >
                {t("intelligenceUi.noRows")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollArea>
  );

  const filter = (inDialog: boolean) =>
    rows.length > 5 && (
      <label className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-2 dark:bg-[#2b2b2b]">
        <Search className="h-3.5 w-3.5 shrink-0 text-[#969696]" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("intelligenceUi.searchTable")}
          placeholder={t("intelligenceUi.searchTable")}
          tabIndex={!inDialog && expanded ? -1 : undefined}
          className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-[#969696]"
        />
      </label>
    );

  return (
    <>
      <section className="my-3 min-w-0 overflow-hidden rounded-2xl bg-black/[0.025] font-sans text-[#262626] dark:bg-[#1b1b1b] dark:text-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h4 className="break-words text-[13px] font-medium">
              {title || t("intelligenceUi.tableTitle")}
            </h4>
            <p className="mt-0.5 text-[11px] text-[#969696]">
              {t("intelligenceUi.rowCount").replace(
                "{count}",
                String(visibleRows.length),
              )}
            </p>
          </div>
          {actions(false)}
        </div>
        {filter(false)}
        {table(false)}
      </section>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          hideClose
          aria-describedby={undefined}
          className="flex h-[80vh] max-w-[min(1100px,94vw)] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-none outline-none focus:outline-none focus-visible:outline-none ring-0 dark:bg-[#161616] dark:text-white"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <DialogTitle className="text-sm font-medium">
              {title || t("intelligenceUi.tableTitle")}
            </DialogTitle>
            {actions(true)}
          </div>
          {filter(true)}
          {table(true)}
        </DialogContent>
      </Dialog>
    </>
  );
}
