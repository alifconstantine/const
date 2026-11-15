"use client";

import React, { useState } from "react";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Globe,
  Loader2,
  Monitor,
  MousePointerClick,
  Plug,
  Puzzle,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import { ShowcaseShell } from "./ShowcaseShell";
import { IntelligenceUiView } from "./IntelligenceUiView";

export type CapabilityKind =
  | "plugins"
  | "computer"
  | "browser"
  | "subagents"
  | "intelligence"
  | "remote";

const SAMPLE_PLUGINS = [
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    desc: "Performance traces, network & a11y auditing.",
    enabled: true,
  },
  {
    id: "figma",
    name: "Figma",
    desc: "Read design tokens, specs & components.",
    enabled: true,
  },
  {
    id: "firebase",
    name: "Firebase",
    desc: "Firestore rules, Hosting & Auth helpers.",
    enabled: true,
  },
  {
    id: "canva",
    name: "Canva",
    desc: "Create, edit & export brand layouts.",
    enabled: false,
  },
] as const;

export function CapabilityShowcase({ kind }: { kind: CapabilityKind }) {
  const [pluginState, setPluginState] = useState<Record<string, boolean>>({
    "chrome-devtools": true,
    figma: true,
    firebase: true,
    canva: false,
  });
  const [computerEnabled, setComputerEnabled] = useState(true);
  const [browserEnabled, setBrowserEnabled] = useState(true);

  if (kind === "plugins") {
    return (
      <ShowcaseShell title="Marketplace · Plugins & Skills" project="const-web">
        <div className="p-3.5 space-y-3 bg-[var(--sc-canvas)]">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--sc-surface)] border border-[var(--sc-border)] text-[var(--sc-ink-muted)] text-[11.5px]">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Search plugins, MCP servers &amp; skills...</span>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-[var(--sc-surface-2)] border border-[var(--sc-border)] p-0.5 text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-[var(--sc-surface)] text-[var(--sc-ink)] font-medium">
                Plugins
              </span>
              <span className="px-2.5 py-1 text-[var(--sc-ink-muted)]">Skills</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SAMPLE_PLUGINS.map((plugin) => {
              const active = pluginState[plugin.id] ?? plugin.enabled;
              return (
                <div
                  key={plugin.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-2.5"
                >
                  <span className="w-9 h-9 rounded-lg bg-[var(--sc-surface-2)] border border-[var(--sc-border)] flex items-center justify-center shrink-0">
                    {plugin.id === "chrome-devtools" || plugin.id === "firebase" ? (
                      <Plug className="w-4 h-4 text-[#3b82f6]" />
                    ) : (
                      <Puzzle className="w-4 h-4 text-[var(--sc-ink)]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[12px] truncate">{plugin.name}</div>
                    <div className="text-[11px] text-[var(--sc-ink-muted)] truncate">
                      {plugin.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={`Toggle ${plugin.name}`}
                    onClick={() =>
                      setPluginState((prev) => ({
                        ...prev,
                        [plugin.id]: !active,
                      }))
                    }
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors border-0 cursor-pointer shrink-0 flex items-center ${
                      active ? "bg-[#3b82f6] justify-end" : "bg-[var(--sc-border-strong)] justify-start"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs block" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  if (kind === "computer") {
    return (
      <ShowcaseShell title="Native computer use" project="desktop-automation">
        <div className="p-3.5 space-y-3 bg-[var(--sc-canvas)]">
          {/* Computer Use settings panel mirroring computer-use-settings.tsx */}
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] divide-y divide-[var(--sc-border)]">
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="font-medium text-[12px]">Enable native computer use</div>
                <div className="text-[11px] text-[var(--sc-ink-muted)]">
                  Allow inspecting windows, typing, clicking, and hotkeys on your desktop.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={computerEnabled}
                aria-label="Toggle computer use"
                onClick={() => setComputerEnabled((v) => !v)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors border-0 cursor-pointer shrink-0 flex items-center ${
                  computerEnabled ? "bg-[#3b82f6] justify-end" : "bg-[var(--sc-border-strong)] justify-start"
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white block" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="font-medium text-[12px]">Enable built-in browser control</div>
                <div className="text-[11px] text-[var(--sc-ink-muted)]">
                  Allow DOM navigation, element selection, and visual verification.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={browserEnabled}
                aria-label="Toggle browser use"
                onClick={() => setBrowserEnabled((v) => !v)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors border-0 cursor-pointer shrink-0 flex items-center ${
                  browserEnabled ? "bg-[#3b82f6] justify-end" : "bg-[var(--sc-border-strong)] justify-start"
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white block" />
              </button>
            </div>
          </div>

          {/* Native computer_* tool trace mirroring execution-trace.tsx */}
          <div className="space-y-1.5">
            <div className="ch-sc-trace-step">
              <Monitor className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="font-mono text-[11px] text-[var(--sc-ink)]">computer_list_windows</span>
              <span className="truncate text-[var(--sc-ink-muted)]">3 active windows</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
            <div className="ch-sc-trace-step">
              <MousePointerClick className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="font-mono text-[11px] text-[var(--sc-ink)]">computer_click</span>
              <span className="truncate text-[var(--sc-ink-muted)]">&quot;Export Report&quot; (842, 418)</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
            <div className="ch-sc-trace-step">
              <SquareTerminal className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="font-mono text-[11px] text-[var(--sc-ink)]">computer_hotkey</span>
              <span className="truncate text-[var(--sc-ink-muted)]">Ctrl+Shift+S · Verified dialog</span>
              <Check className="w-3 h-3 ml-auto text-[var(--sc-green)] shrink-0" />
            </div>
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  if (kind === "browser") {
    return (
      <ShowcaseShell title="Inspect page & select elements" project="const-web" rightOpen>
        <div className="ch-sc-split-pane">
          <div className="ch-sc-tabbar">
            <div className="ch-sc-tabs">
              <span className="ch-sc-tab active">
                <Globe className="w-3 h-3 text-[#3b82f6]" />
                <span>const.web.id/download</span>
              </span>
            </div>
          </div>
          <div className="ch-sc-browser-bar">
            <ChevronLeft className="w-3.5 h-3.5 text-[var(--sc-ink-muted)]" />
            <ChevronRight className="w-3.5 h-3.5 text-[var(--sc-ink-faint)]" />
            <RotateCw className="w-3 h-3 text-[var(--sc-ink-muted)]" />
            <div className="ch-sc-url-pill">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate">https://harness.const.web.id/download</span>
            </div>
            <span className="ch-sc-picker-active" title="Select element for chat">
              <Sparkles className="w-3 h-3" />
            </span>
          </div>
          <div className="p-3.5 bg-[var(--sc-canvas)] space-y-2.5">
            <div className="rounded-xl border border-dashed border-[#3b82f6] bg-[var(--sc-surface)] p-3 relative">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2563eb] text-white text-[10px] font-mono mb-2">
                &lt;a.ch-installer-row&gt; selected for chat
              </span>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-[12.5px]">Windows x64</div>
                  <div className="text-[11px] text-[var(--sc-ink-muted)]">
                    v0.0.2 · .exe installer
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[var(--sc-ink)] text-[var(--sc-canvas)] text-[10.5px] font-medium">
                  Download
                </span>
              </div>
            </div>
            <div className="ch-sc-trace-step">
              <Sparkles className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="truncate">
                Attached DOM selector + computed styles to active prompt
              </span>
            </div>
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  if (kind === "subagents") {
    return (
      <ShowcaseShell title="Refactor API & verify tests" project="api-router">
        <div className="p-3.5 space-y-2.5 bg-[var(--sc-canvas)]">
          <div className="ch-sc-user-msg">
            Audit authentication routes, update tests, and check mobile layout in parallel.
          </div>

          <div className="text-[11px] font-medium text-[var(--sc-ink-muted)]">
            Parallel execution trace · 3 subagents
          </div>

          {/* Exact SubAgent row structure from execution-trace.tsx lines 1455-1486 */}
          <div className="space-y-1.5">
            <div className="ch-sc-trace-step">
              <Bot className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="font-medium text-[var(--sc-ink)] shrink-0">SubAgent</span>
              <span className="ch-sc-trace-badge">reviewer</span>
              <span className="font-mono text-[10.5px] shrink-0">auth-audit</span>
              <span className="text-[var(--sc-ink-faint)]">·</span>
              <span className="truncate">Inspect session token signature paths</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-[var(--sc-green)] shrink-0">
                <Check className="w-3 h-3" />
                4.2s
              </span>
            </div>

            <div className="ch-sc-trace-step">
              <Bot className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="font-medium text-[var(--sc-ink)] shrink-0">SubAgent</span>
              <span className="ch-sc-trace-badge">worker</span>
              <span className="font-mono text-[10.5px] shrink-0">test-suite</span>
              <span className="text-[var(--sc-ink-faint)]">·</span>
              <span className="truncate">Run integration suite on auth endpoints</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-amber-500 shrink-0 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            </div>

            <div className="ch-sc-trace-step">
              <Bot className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
              <span className="font-medium text-[var(--sc-ink)] shrink-0">SubAgent</span>
              <span className="ch-sc-trace-badge">explore</span>
              <span className="font-mono text-[10.5px] shrink-0">ui-check</span>
              <span className="text-[var(--sc-ink-faint)]">·</span>
              <span className="truncate">Verify 375px &amp; 1280px responsive grid</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-[var(--sc-green)] shrink-0">
                <Check className="w-3 h-3" />
                2.8s
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-2.5 flex items-center justify-between text-[11px] text-[var(--sc-ink-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Isolated contexts merged back cleanly into parent turn</span>
            </span>
            <span className="font-mono text-[10.5px] text-[var(--sc-ink)]">3 turns</span>
          </div>
        </div>
      </ShowcaseShell>
    );
  }

  if (kind === "intelligence") {
    return (
      <ShowcaseShell title="Q4 Adoption Metrics" project="research" activeActivity>
        <div className="p-3.5 bg-[var(--sc-canvas)]">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#3b82f6]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>openui-lang · IntelligenceBlock</span>
            </span>
            <span className="text-[10.5px] text-[var(--sc-ink-muted)]">
              Interactive chart, table &amp; form inside chat
            </span>
          </div>
          <IntelligenceUiView />
        </div>
      </ShowcaseShell>
    );
  }

  // kind === "remote"
  return (
    <ShowcaseShell title="Remote Pairing · E2EE" project="const-web">
      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--sc-canvas)]">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold">Desktop Session</span>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--sc-green)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sc-green)]" />
              Online
            </span>
          </div>
          <div>
            <div className="text-[10.5px] text-[var(--sc-ink-muted)]">Pairing code</div>
            <div className="mt-1 font-mono text-[20px] font-semibold tracking-[0.18em]">
              K7P-9M2
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--sc-ink-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--sc-green)] shrink-0" />
            <span>End-to-end encrypted relay</span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3 flex flex-col justify-between gap-2.5">
          <div className="text-[11px] font-semibold">Paired Devices</div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between rounded-lg bg-[var(--sc-surface-2)] px-2.5 py-1.5">
              <span className="font-medium truncate">Android · Pixel / APK</span>
              <span className="text-[10px] text-[var(--sc-green)]">Connected</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--sc-surface-2)] px-2.5 py-1.5">
              <span className="font-medium truncate">Browser · harness.const.web.id</span>
              <span className="text-[10px] text-[var(--sc-ink-muted)]">Ready</span>
            </div>
          </div>
          <div className="text-[10.5px] text-[var(--sc-ink-muted)]">
            Approve commands, review diffs &amp; steer active runs remotely.
          </div>
        </div>
      </div>
    </ShowcaseShell>
  );
}
