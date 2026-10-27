import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/lib/i18n";
import { AssistantResponse } from "../src/components/intelligence-ui/assistant-response";
import type { IntelligenceUiState } from "../src/components/intelligence-ui/schema";
import "../src/index.css";

const program = [
  "root = Stack([overview, tabs, callout, accordion])",
  "overview = Card([header, desc])",
  'header = CardHeader("OpenUI Native Runtime", "Harness Desktop Implementation Review")',
  'desc = TextContent("Native OpenUI components rendered with official tokens and styles across Main Chat and Side Chat.")',
  "tabs = Tabs([tab1, tab2])",
  'tab1 = TabItem("chart", "Activity Chart", [chart])',
  'tab2 = TabItem("table", "Modified Files", [files])',
  'chart = BarChart(["Added", "Removed", "Unchanged"], [s1], "grouped", "Category", "Lines", 200)',
  's1 = Series("Lines", [120, 30, 45])',
  "files = Table([c1, c2, c3])",
  'c1 = Col("File", ["App.tsx", "side-chat-tab.tsx", "protocol.ts", "library.tsx", "prompt.ts"])',
  'c2 = Col("Lines", [20, 12, 80, 120, 30], "number")',
  'c3 = Col("Status", ["Updated", "Updated", "Updated", "Migrated", "Generated"])',
  'callout = Callout("success", "Audit Complete", "All 82+ native components available with responsive layouts and dark/light mode.")',
  "accordion = Accordion([acc1])",
  'acc1 = AccordionItem("tech", "Technical Architecture", [techDesc])',
  'techDesc = TextContent("Powered by @openuidev/react-ui and @openuidev/react-lang with Radix UI primitives and D3 charts.")',
].join("\n");
const content = `## Review\n\nThese are test values for the shared response renderer.\n\n\`\`\`openui-lang\n${program}\n\`\`\`\n\n| Legacy Markdown | Status |\n|---|---|\n| Shared table | Ready |`;

function Fixture() {
  const isLive =
    new URLSearchParams(window.location.search).get("live") === "1";
  const storageKey = isLive
    ? "intelligence-live-fixture-state"
    : "intelligence-fixture-state";
  const [liveResult, setLiveResult] = useState<{
    content: string;
    model: string;
  } | null>(null);
  const [liveError, setLiveError] = useState(false);
  useEffect(() => {
    if (!isLive) return;
    const controller = new AbortController();
    fetch("/__intelligence-ui-live", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Live result unavailable");
        const result = await response.json();
        if (typeof result.content !== "string")
          throw new Error("Invalid live result");
        if (!controller.signal.aborted) setLiveResult(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveError(true);
      });
    return () => controller.abort();
  }, [isLive]);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [submissions, setSubmissions] = useState<
    Array<{ scope: string; prompt: string }>
  >([]);
  const [revision, setRevision] = useState(0);
  const [states, setStates] = useState<Record<string, IntelligenceUiState>>(
    () => JSON.parse(localStorage.getItem(storageKey) || "{}"),
  );
  if (isLive && !liveResult)
    return (
      <main className="p-6">
        <p role="status">
          {liveError
            ? "Set INTELLIGENCE_UI_LIVE_RESULT to a live test artifact and restart the fixture server."
            : "Loading live model output..."}
        </p>
      </main>
    );
  const responseContent = liveResult?.content || content;
  return (
    <main className="min-h-screen bg-white p-6 font-sans text-[#262626] dark:bg-[#161616] dark:text-white">
      <h1 className="mb-4 text-lg">Intelligence UI browser fixture</h1>
      {liveResult && (
        <p className="mb-4 text-sm" data-live-model>
          {liveResult.model}
        </p>
      )}
      <nav className="mb-6 flex flex-wrap gap-4 text-sm">
        <label>
          <input
            type="checkbox"
            checked={busy}
            onChange={(event) => setBusy(event.target.checked)}
          />{" "}
          Busy
        </label>
        <label>
          <input
            type="checkbox"
            checked={streaming}
            onChange={(event) => setStreaming(event.target.checked)}
          />{" "}
          Streaming
        </label>
        <label>
          <input
            type="checkbox"
            checked={invalid}
            onChange={(event) => setInvalid(event.target.checked)}
          />{" "}
          Invalid output
        </label>
        <button onClick={() => setRevision((value) => value + 1)}>
          Remount saved views
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !isDark;
            setIsDark(next);
            if (next) {
              document.documentElement.classList.add("dark");
              document.documentElement.setAttribute("data-openui-theme", "dark");
            } else {
              document.documentElement.classList.remove("dark");
              document.documentElement.setAttribute("data-openui-theme", "light");
            }
          }}
          className="border border-black/20 dark:border-white/20 rounded px-2 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
        >
          Theme: {isDark ? "Dark" : "Light"}
        </button>
      </nav>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {["main", "side"].map((scope) => (
          <section
            key={`${scope}-${revision}`}
            data-fixture={scope}
            className="min-w-0"
            style={{
              width: scope === "main" ? "min(760px, 100%)" : "min(340px, 100%)",
            }}
          >
            <h2 className="mb-4 text-sm font-medium">
              {scope === "main" ? "Main chat" : "Side chat"}
            </h2>
            <AssistantResponse
              content={
                invalid
                  ? 'Before\n\n```openui-lang\nroot = Stack([form])\nform = Form("constructor", "Invalid form", [{name: "scope", label: "Scope", type: "text"}], "Continue")\n```\n\nAfter'
                  : streaming
                    ? responseContent.slice(
                        0,
                        Math.floor(responseContent.length * 0.65),
                      )
                    : responseContent
              }
              isStreaming={streaming}
              disabled={busy || streaming}
              state={states[scope]}
              onStateChange={(blockId, state) =>
                setStates((previous) => {
                  const next = {
                    ...previous,
                    [scope]: { ...previous[scope], [blockId]: state },
                  };
                  localStorage.setItem(storageKey, JSON.stringify(next));
                  return next;
                })
              }
              onSubmit={async (prompt) => {
                setSubmissions((previous) => [...previous, { scope, prompt }]);
              }}
            />
          </section>
        ))}
      </div>
      <output
        data-submissions
        className="mt-8 block whitespace-pre-wrap break-words text-xs"
      >
        {JSON.stringify(submissions, null, 2)}
      </output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
