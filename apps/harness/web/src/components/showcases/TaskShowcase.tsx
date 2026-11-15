"use client";

import React, { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  MonitorSmartphone,
  MoreHorizontal,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import { ShowcaseShell } from "./ShowcaseShell";
import { IntelligenceUiView } from "./IntelligenceUiView";

export type TaskShowcaseMode = "presentation" | "analysis" | "website" | "coding";

export function TaskShowcase({ mode }: { mode: TaskShowcaseMode }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = [
    {
      kicker: "01 · OVERVIEW",
      heading: "Q4 Platform Roadmap",
      bullets: [
        "Unified Desktop & Remote Pairing",
        "Intelligence UI interactive tables & charts",
        "Subagent parallel execution tracing",
      ],
    },
    {
      kicker: "02 · ARCHITECTURE",
      heading: "Local-First Workbench",
      bullets: [
        "Permission modes per workspace turn",
        "Diff review & instant turn rollback",
        "Built-in Chromium element inspector",
      ],
    },
    {
      kicker: "03 · ROLLOUT",
      heading: "Windows & Android Builds",
      bullets: [
        "Signed x64 & ARM64 desktop installers",
        "End-to-end encrypted phone pairing",
        "Offline-safe session history storage",
      ],
    },
  ] as const;

  if (mode === "analysis") {
    return (
      <ShowcaseShell title="Analyze sales dataset" project="research" rightOpen>
        <div className="ch-sc-split">
          <div className="ch-sc-split-chat">
            <div className="ch-sc-user-msg">
              Analyze @metrics-q4.csv and chart active sessions across desktop and mobile.
            </div>
            <div className="ch-sc-thought-row">
              <span>Thought for 4s</span>
              <ChevronDown className="w-3 h-3" />
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Read</span>
              <span className="truncate font-mono text-[11px]">metrics-q4.csv (248 rows)</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Python</span>
              <span className="truncate font-mono text-[11px]">summarize_cohorts.py</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
            <p className="ch-sc-assistant-prose m-0">
              Processed <strong>248 rows</strong> locally. Desktop still anchors core usage at 48%,
              while Android mobile grew fastest (+42.0% WoW).
            </p>
            <div className="ch-sc-file-pill mt-auto">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>cohort-report.csv</span>
            </div>
          </div>

          <div className="ch-sc-split-pane">
            <div className="ch-sc-tabbar">
              <div className="ch-sc-tabs">
                <span className="ch-sc-tab active">
                  <Sparkles className="w-3 h-3 text-[#3b82f6]" />
                  <span>Intelligence UI</span>
                </span>
                <span className="ch-sc-tab">
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>cohort-report.csv</span>
                </span>
              </div>
              <Plus className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
            </div>
            <div className="p-3 overflow-auto">
              <IntelligenceUiView compact />
            </div>
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  if (mode === "website") {
    return (
      <ShowcaseShell title="Build site from brief" project="const-web" rightOpen>
        <div className="ch-sc-split">
          <div className="ch-sc-split-chat">
            <div className="ch-sc-user-msg">
              Build the landing hero and verify responsive layout at http://localhost:3000.
            </div>
            <div className="ch-sc-thought-row">
              <span>Thought for 5s</span>
              <ChevronDown className="w-3 h-3" />
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Edit</span>
              <span className="truncate font-mono text-[11px]">src/components/HeroSection.tsx</span>
              <span className="ml-auto font-mono text-[10.5px] text-[var(--sc-green)]">+28 -9</span>
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Terminal</span>
              <span className="truncate font-mono text-[11px]">pnpm dev --port 3000</span>
              <span className="ml-auto text-[10px] text-emerald-500">Live</span>
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Browser</span>
              <span className="truncate font-mono text-[11px]">browser_snapshot http://localhost:3000</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
            <p className="ch-sc-assistant-prose m-0">
              Updated hero contrast tokens and verified desktop &amp; mobile breakpoints inside the
              built-in browser pane.
            </p>
          </div>

          <div className="ch-sc-split-pane">
            <div className="ch-sc-tabbar">
              <div className="ch-sc-tabs">
                <span className="ch-sc-tab active">
                  <Globe className="w-3 h-3 text-[#3b82f6]" />
                  <span>const.web.id preview</span>
                </span>
                <span className="ch-sc-tab">
                  <SquareTerminal className="w-3 h-3" />
                  <span>Terminal</span>
                </span>
              </div>
              <Plus className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
            </div>

            <div className="ch-sc-browser-bar">
              <ChevronLeft className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
              <ChevronRight className="w-3.5 h-3.5 text-[var(--sc-ink-faint)]" />
              <RotateCw className="w-3 h-3 text-[var(--sc-ink-muted)]" />
              <div className="ch-sc-url-pill">
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate">http://localhost:3000</span>
              </div>
              <span className="ch-sc-picker-active" title="Element picker">
                <Sparkles className="w-3 h-3" />
              </span>
              <MonitorSmartphone className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
              <MoreHorizontal className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
            </div>

            <div className="p-3.5 flex-1 flex flex-col gap-2.5">
              <div className="rounded-xl p-4 text-center text-white bg-gradient-to-b from-[#32b4f2] via-[#1a82e8] to-[#135fc7]">
                <div className="text-[16px] font-bold tracking-tight">Const Harness</div>
                <div className="text-[11px] opacity-90 mt-1">
                  Local-first workbench for code, research &amp; browser verification.
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 px-3 py-1 text-[10.5px] font-semibold">
                  Download Const Harness
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Projects", "Browser", "Review"].map((chip) => (
                  <div
                    key={chip}
                    className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-surface)] p-2 text-center text-[11px] font-medium"
                  >
                    {chip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  if (mode === "coding") {
    return (
      <ShowcaseShell title="Review authentication fix" project="api-router" rightOpen>
        <div className="ch-sc-split">
          <div className="ch-sc-split-chat">
            <div className="ch-sc-user-msg">
              Fix token expiry edge case in @verify.ts and run the unit tests.
            </div>
            <div className="ch-sc-thought-row">
              <span>Thought for 6s</span>
              <ChevronDown className="w-3 h-3" />
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Grep</span>
              <span className="truncate font-mono text-[11px]">verifySessionToken</span>
              <span className="ml-auto text-[10.5px]">3 matches</span>
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Edit</span>
              <span className="truncate font-mono text-[11px]">src/auth/verify.ts</span>
              <span className="ml-auto font-mono text-[10.5px] text-[var(--sc-green)]">+12 -4</span>
            </div>
            <div className="ch-sc-trace-step">
              <span className="ch-sc-trace-badge">Test</span>
              <span className="truncate font-mono text-[11px]">pnpm test auth.verify.test.ts</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
            <p className="ch-sc-assistant-prose m-0">
              Updated clock-skew tolerance to 30 seconds and ensured expired tokens return `401`.
              All 14 assertions passed.
            </p>
          </div>

          {/* Right Pane mirroring components/right-pane/review-tab.tsx */}
          <div className="ch-sc-split-pane">
            <div className="ch-sc-tabbar">
              <div className="ch-sc-tabs">
                <span className="ch-sc-tab active">
                  <Layers className="w-3 h-3 text-[#3b82f6]" />
                  <span>Review</span>
                </span>
                <span className="ch-sc-tab">
                  <SquareTerminal className="w-3 h-3" />
                  <span>pnpm test</span>
                </span>
              </div>
              <Plus className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
            </div>

            <div className="ch-sc-review-subbar">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span className="font-medium">Review</span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--sc-surface)] border border-[var(--sc-border)] text-[10px] font-mono">
                  For this turn (2 files)
                </span>
                <span className="font-mono text-[11px]">
                  <span className="text-[var(--sc-green)]">+18</span>{" "}
                  <span className="text-[var(--sc-red)]">-5</span>
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--sc-border)] bg-[var(--sc-surface)] text-[10.5px]">
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Undo all</span>
              </span>
            </div>

            <div className="ch-sc-diff-card">
              <div className="ch-sc-diff-file-head">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode2 className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
                  <span className="truncate font-mono">src/auth/verify.ts</span>
                </div>
                <span className="font-mono text-[10.5px] shrink-0">
                  <span className="text-[var(--sc-green)]">+12</span>{" "}
                  <span className="text-[var(--sc-red)]">-4</span>
                </span>
              </div>
              <div className="ch-sc-diff-lines">
                <div className="ch-sc-diff-line ctx"><span>41</span><span>const CLOCK_SKEW_MS = 30_000;</span></div>
                <div className="ch-sc-diff-line del"><span>-</span><span>if (payload.exp &lt; Date.now()) return null;</span></div>
                <div className="ch-sc-diff-line add"><span>+</span><span>if (payload.exp + CLOCK_SKEW_MS &lt; Date.now()) {"{"}</span></div>
                <div className="ch-sc-diff-line add"><span>+</span><span>  return &#123; ok: false, reason: &quot;expired&quot; &#125;;</span></div>
                <div className="ch-sc-diff-line add"><span>+</span><span>{"}"}</span></div>
                <div className="ch-sc-diff-line ctx"><span>46</span><span>return &#123; ok: true, sub: payload.sub &#125;;</span></div>
              </div>
            </div>
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  // Default: mode === "presentation"
  const activeSlide = slides[slideIndex] ?? slides[0];
  return (
    <ShowcaseShell title="Turn ideas into presentations" project="const-web" rightOpen>
      <div className="ch-sc-split">
        <div className="ch-sc-split-chat">
          <div className="ch-sc-user-msg">
            Draft a 3-slide Q4 product deck from @roadmap-brief.md and open a preview.
          </div>
          <div className="ch-sc-thought-row">
            <span>Thought for 3s</span>
            <ChevronDown className="w-3 h-3" />
          </div>
          <div className="ch-sc-trace-step">
            <span className="ch-sc-trace-badge">Skill</span>
            <span className="truncate font-mono text-[11px]">presentation-builder</span>
            <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
          </div>
          <div className="ch-sc-trace-step">
            <span className="ch-sc-trace-badge">Write</span>
            <span className="truncate font-mono text-[11px]">q4-roadmap-deck.html</span>
            <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
          </div>
          <p className="ch-sc-assistant-prose m-0">
            Structured 3 slides covering roadmap milestones, local workbench architecture, and
            Windows + Android rollout. Use the slide switcher beside this thread to inspect each frame.
          </p>
          <div className="ch-sc-file-pill mt-auto">
            <FileText className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span>q4-roadmap-deck.html</span>
          </div>
        </div>

        <div className="ch-sc-split-pane">
          <div className="ch-sc-tabbar">
            <div className="ch-sc-tabs">
              <span className="ch-sc-tab active">
                <FileText className="w-3 h-3 text-[#3b82f6]" />
                <span>q4-roadmap-deck.html</span>
              </span>
            </div>
            <span className="text-[10.5px] font-mono text-[var(--sc-ink-muted)]">
              Slide {slideIndex + 1} / {slides.length}
            </span>
          </div>

          <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 shadow-sm flex-1 flex flex-col justify-center">
              <div className="text-[10px] font-mono tracking-wider text-[#3b82f6] font-semibold">
                {activeSlide.kicker}
              </div>
              <h4 className="mt-1.5 mb-2.5 text-[16px] font-semibold tracking-tight text-[var(--sc-ink)]">
                {activeSlide.heading}
              </h4>
              <ul className="m-0 pl-4 space-y-1.5 text-[11.5px] text-[var(--sc-ink-muted)]">
                {activeSlide.bullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {slides.map((s, idx) => (
                  <button
                    key={s.kicker}
                    type="button"
                    onClick={() => setSlideIndex(idx)}
                    className={`px-2.5 py-1 rounded-md text-[11px] border cursor-pointer transition-colors ${
                      slideIndex === idx
                        ? "bg-[var(--sc-ink)] text-[var(--sc-canvas)] border-transparent font-medium"
                        : "bg-[var(--sc-surface)] text-[var(--sc-ink-muted)] border-[var(--sc-border)]"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <span className="text-[10.5px] text-[var(--sc-ink-muted)]">
                Click 1–3 to inspect slides
              </span>
            </div>
          </div>
        </div>
      </div>
    </ShowcaseShell>
  );
}
