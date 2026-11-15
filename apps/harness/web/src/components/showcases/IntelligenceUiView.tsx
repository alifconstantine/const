"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpDown, Check, Copy, Search } from "lucide-react";

const TABLE_ROWS = [
  { channel: "Desktop App", sessions: "14,820", share: "48%", delta: "+18.4%" },
  { channel: "Web Remote", sessions: "7,410", share: "24%", delta: "+31.2%" },
  { channel: "Android Mobile", sessions: "5,250", share: "17%", delta: "+42.0%" },
  { channel: "Scheduled Runs", sessions: "3,390", share: "11%", delta: "+12.7%" },
] as const;

const BAR_ITEMS = [
  { label: "Desktop", value: 84 },
  { label: "Web Remote", value: 62 },
  { label: "Android", value: 49 },
  { label: "Schedules", value: 34 },
] as const;

const OPENUI_SNIPPET = `root = Stack([metrics, chart, table, followUp])
metrics = Card("Summary", [Metric("Active sessions", "30,870", "+24.8% WoW")])
chart = BarChart("Usage by surface", [...], "k sessions")
table = Table("Channel breakdown", ["Surface", "Sessions", "Share", "Growth"], [...])
followUp = Form("export_opts", "Filter next report", [...], "Apply filter")`;

export function IntelligenceUiView({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("Last 7 days");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const visibleRows = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const filtered = TABLE_ROWS.filter(
      (r) =>
        !clean ||
        r.channel.toLowerCase().includes(clean) ||
        r.sessions.toLowerCase().includes(clean),
    );
    return [...filtered].sort((a, b) =>
      sortAsc
        ? a.channel.localeCompare(b.channel)
        : b.channel.localeCompare(a.channel),
    );
  }, [query, sortAsc]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="ch-sc-iui-stack">
      {/* Metric row mirroring schema.ts Metric */}
      <div className="ch-sc-iui-metrics">
        <div className="ch-sc-iui-card">
          <div className="ch-sc-iui-metric-label">Active sessions</div>
          <div className="ch-sc-iui-metric-val">30,870</div>
          <div className="ch-sc-iui-metric-detail">+24.8% this week</div>
        </div>
        <div className="ch-sc-iui-card">
          <div className="ch-sc-iui-metric-label">Tasks completed</div>
          <div className="ch-sc-iui-metric-val">9,412</div>
          <div className="ch-sc-iui-metric-detail">98.2% verified</div>
        </div>
        <div className="ch-sc-iui-card">
          <div className="ch-sc-iui-metric-label">Median latency</div>
          <div className="ch-sc-iui-metric-val">1.4s</div>
          <div className="ch-sc-iui-metric-detail">Local execution</div>
        </div>
      </div>

      {/* Horizontal zero-baseline BarChart mirroring schema.ts BarChart */}
      <div className="ch-sc-iui-card">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-[12px]">Usage by surface</span>
          <span className="text-[10.5px] text-[var(--sc-ink-muted)]">% of total runs</span>
        </div>
        <div className="space-y-2">
          {BAR_ITEMS.map((item) => (
            <div key={item.label} className="ch-sc-iui-bar-row">
              <span className="truncate text-[var(--sc-ink-muted)]">{item.label}</span>
              <div className="ch-sc-iui-bar-track">
                <div
                  className="ch-sc-iui-bar-fill"
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <span className="text-right tabular-nums font-medium">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Searchable, sortable Table mirroring response-table.tsx */}
      <div className="ch-sc-iui-card">
        <div className="ch-sc-iui-table-head">
          <span className="font-medium text-[12px]">Channel breakdown</span>
          <div className="flex items-center gap-1.5">
            <label className="ch-sc-iui-search">
              <Search className="w-3 h-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rows..."
                aria-label="Search table rows"
              />
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="ch-sc-icon-btn"
              title="Copy TSV"
              aria-label="Copy table"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <table className="ch-sc-iui-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  onClick={() => setSortAsc((prev) => !prev)}
                  className="inline-flex items-center gap-1 bg-transparent border-0 p-0 text-inherit font-inherit cursor-pointer"
                >
                  <span>Surface</span>
                  <ArrowUpDown className="w-2.5 h-2.5" />
                </button>
              </th>
              <th>Sessions</th>
              <th>Share</th>
              <th>Growth</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.channel}>
                <td className="font-medium">{row.channel}</td>
                <td className="tabular-nums">{row.sessions}</td>
                <td className="tabular-nums">{row.share}</td>
                <td className="tabular-nums text-[var(--sc-green)]">{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive openui-lang Form & ProgramSource toggle (when not compact) */}
      {!compact && (
        <>
          <div className="ch-sc-iui-card flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-medium text-[var(--sc-ink-muted)]">
                Timeframe:
              </span>
              {(["Last 7 days", "Last 30 days"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setSelectedPeriod(period);
                    setFormSubmitted(false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                    selectedPeriod === period
                      ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                      : "bg-[var(--sc-surface-2)] text-[var(--sc-ink-muted)] border-[var(--sc-border)]"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFormSubmitted(true)}
              className="px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--sc-ink)] text-[var(--sc-canvas)] border-0 cursor-pointer hover:opacity-90"
            >
              {formSubmitted ? `Sent (${selectedPeriod})` : "Apply filter"}
            </button>
          </div>

          <details className="ch-sc-iui-source">
            <summary>Show openui-lang source</summary>
            <pre>{OPENUI_SNIPPET}</pre>
          </details>
        </>
      )}
    </div>
  );
}
