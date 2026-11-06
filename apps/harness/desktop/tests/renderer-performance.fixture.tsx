import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ExecutionTrace } from "../src/components/workbench/execution-trace";
import { I18nProvider } from "../src/lib/i18n";
import { installReactMeasureCleanup } from "../src/lib/renderer-health";
import type { TraceStep } from "../src/vite-env";

installReactMeasureCleanup();
const reasoning = "FULL_REASONING_START\n\n" + Array.from({ length: 900 }, (_, i) => `Paragraph ${i}: inspect **the actual result** and keep the next action bounded.\n\n`).join("") + "LATEST_REASONING";
const steps: TraceStep[] = Array.from({ length: 180 }, (_, i) => i % 2
  ? { id: `tool-${i}`, type: "tool", name: "bash", args: { command: `echo TOOL_${i}` }, result: `HIDDEN_OUTPUT_${i}\n${"completed\n".repeat(300)}` }
  : { id: `thought-${i}`, type: "thought", content: reasoning, durationMs: 1000 });
steps.push({ id: "live", type: "thought", content: reasoning, startTime: Date.now() });
const initial = { traceSteps: steps, thinking: reasoning, isExecuting: true };
let update: React.Dispatch<React.SetStateAction<typeof initial>>;
function Fixture() {
  const [state, setState] = useState(initial); update = setState;
  return <I18nProvider><main style={{ width: 700 }}><ExecutionTrace {...state} /></main></I18nProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
Object.assign(window, {
  rendererFixture: {
    tick() { update(state => ({ ...state, thinking: state.thinking + " delta", traceSteps: state.traceSteps.map((step, i) => i === state.traceSteps.length - 1 ? { ...step, content: step.content + " delta" } : step) })); },
    finish() { update(state => ({ ...state, isExecuting: false })); },
  },
});
