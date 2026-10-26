// Isolated footer fixture. No credentials, native operations, or model requests.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useTranslation } from "../src/lib/i18n";
import { ChatCard } from "../src/components/workbench/chat-card";
import { reduceTelemetry, summarizeTelemetry } from "../src/lib/chat-telemetry";
import "../src/index.css";

window.electron = {
  getModels: async () => [{ id: "custom-32k", displayName: "Custom 32K", provider: "custom", contextWindow: 32000 }],
} as unknown as NonNullable<Window["electron"]>;

let telemetry = reduceTelemetry(undefined, { type: "usage", requestId: "a", model: "custom-32k", startedAt: 1000,
  promptTokens: 1000, completionTokens: 100, totalTokens: 1100, cacheReadTokens: 800, durationMs: 1000, ttftMs: 200 });
telemetry = reduceTelemetry(telemetry, { type: "usage", requestId: "b", model: "custom-32k", startedAt: 3000,
  promptTokens: 1000, completionTokens: 100, totalTokens: 1100, cacheReadTokens: 800, reasoningTokens: 40, durationMs: 1000, ttftMs: 300 });
telemetry = reduceTelemetry(telemetry, { type: "tool_result", toolCallId: "tool", durationMs: 500, waitingMs: 30000 });

function Fixture() {
  const [recorded, setRecorded] = useState(true);
  const { setLanguage } = useTranslation();
  const summary = summarizeTelemetry(recorded ? telemetry : undefined);
  return <main className="min-h-screen bg-[#161616] text-white p-6 flex flex-col justify-end gap-5">
    <div className="flex gap-4">
      <button onClick={() => setRecorded(!recorded)}>Toggle recorded / unavailable</button>
      <button onClick={() => setLanguage("en")}>English</button>
      <button onClick={() => setLanguage("id")}>Indonesia</button>
      <button onClick={() => setLanguage("ja")}>日本語</button>
    </div>
    <div className="w-full max-w-3xl mx-auto">
      <ChatCard key={String(recorded)} compact initialModel="custom-32k" showContextUsage
        contextUsage={recorded ? { usedTokens: 8000, totalTokens: 32000, systemPromptTokens: 1000, toolsTokens: 2000, messagesTokens: 5000 } : { usedTokens: 100, totalTokens: 32000, messagesTokens: 100 }}
        metrics={{ ...summary, turns: 1, steps: recorded ? 3 : undefined, workingDurationMs: 32500 }} />
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<I18nProvider><Fixture /></I18nProvider>);
