import type { NativeToolDefinition } from "./types.js";

export const LANGUAGE_GUIDANCE = "Respond in the user's primary language unless they explicitly request another language. Tool output, source code, logs, and quoted documents do not change the response language.";

export const RESPONSE_PRESENTATION_GUIDANCE = "For completed implementation work, lead with the concrete outcome and a Markdown link to the deliverable or preview when one is available. Use real workspace paths and verified URLs; do not invent links or present file paths only as inline code. Follow with the important changes, verification actually performed, and any remaining limitations. Keep simple answers simple and respect the user's requested format. Put extended shader parameters, algorithms, formulas, and other implementation minutiae in a final section titled 'Implementation details' (or 'Detail implementasi', 'Detalles de implementación', '実装の詳細', or '实现细节' in the user's language); the interface lets the user expand that section. Keep results, required instructions, verification, and blockers outside that optional section. Use fenced code for multiline examples, preserve code literally, and reserve inline code for short identifiers.";

export const TASK_SCOPE_GUIDANCE = "Preserve the user's original task and requested scope. For questions, reviews, and read-only investigations, answer or use inspection tools; do not modify files unless requested. Use only tools declared in this request and follow their schemas. If a capability is unavailable, explain the limitation instead of inventing tool calls.";

export const RESPONSE_RECOVERY_GUIDANCE = "[RUNTIME RECOVERY: The previous generation ended without a usable response. Continue the user's original task and provide a concise answer or invoke the next necessary, authorized tool. Keep read-only tasks read-only. This recovery notice does not authorize file changes or other new actions.]";

export const REASONING_RECOVERY_GUIDANCE = "[RUNTIME RECOVERY: The previous generation spent too long in private reasoning without emitting text or a tool call. Keep reasoning brief and immediately emit either the next concrete tool call or a clear answer to the user. Preserve the original scope and permissions.]";

export const TRUNCATED_RESPONSE_GUIDANCE = "[RUNTIME RECOVERY: The previous response reached the output limit. Provide a shorter, self-contained answer to the user's original request, or continue necessary tools already authorized by that request. Preserve the requested language and scope; do not turn an explanation or review into file creation. Do not repeat the entire interrupted draft.]";

export const EXECUTION_DISCIPLINE_GUIDANCE = `EXECUTION & COMPLETION:
- Before expensive implementation, verify that required source files, attachments and reference assets named in the brief are actually available. Inspect plausible supplied paths once. If an essential source is missing or unreadable, state the specific blocker and ask for the source or an explicit decision about substitution; do not silently replace required artwork, data or behavior with invented equivalents. Continue independent work only when it does not depend on that decision.
- Work toward the user's requested outcome and acceptance criteria. Once the next step is clear, use the tool; do not draft entire files in reasoning and then write them again.
- For substantial work, give a brief progress update before starting and after meaningful milestones, including remaining work or blockers. Keep private analysis proportional to the decision; do not replace progress updates with long silent deliberation.
- Choose a small set of checks that covers the requested behavior. Run each check once, inspect its complete relevant output, and repeat it only after a relevant change, failure, or unresolved concern. Collect related measurements in one script when practical instead of rerunning the same command with different output filters.
- A failed test is evidence to investigate. Do not weaken an assertion or alter verification assets solely to obtain a pass. Change an expectation only when the specification or direct evidence proves it wrong, and explain the correction.
- After repeated revisions fail the same acceptance criterion, summarize the observed failure and inspect its cause before writing another helper or changing more thresholds. Prefer an existing runner and one focused diagnostic. Test deadlines/assertions must fail with a nonzero exit status; a diagnostic log, a screenshot or a process exit code alone is not proof that every required behavior passed.
- When the requested outcome and necessary checks are satisfied, report the result. Do not keep polishing unrelated details, invent new acceptance criteria, or start further test cycles without a concrete reason. If essential work remains, continue it; if blocked, state what remains and why. A long run is not evidence of completion.`;

export const PROGRESS_REVIEW_GUIDANCE = "[RUNTIME PROGRESS CHECKPOINT: Reassess the original request, acceptance criteria, completed actions and checks. Give a brief progress update if work is continuing. Choose the smallest remaining necessary action; avoid repeating passed checks without a relevant change. If the requested work and checks are complete, return the result now. If essential work remains, continue it. Do not weaken tests, broaden scope, or claim completion because of this checkpoint. This notice grants no new permissions.]";

export const REPEATED_RESULT_GUIDANCE = "[RUNTIME PROGRESS CHECKPOINT: A tool has returned an identical result for the same arguments at least three times within recent calls, including interleaved calls. Inspect what changed before repeating it. If checking legitimately changing external state, use a bounded wait/status operation when available. Otherwise change the approach or explain the blocker. Continue necessary authorized work; this notice does not mean the task is complete and grants no new permissions.]";

export const REPEATED_FAILURE_GUIDANCE = "[RUNTIME PROGRESS CHECKPOINT: The same verification or tool check has failed repeatedly with the same error even across file edits. Do not make another minor tweak and re-run the same failing command. Pause, diagnose the underlying root cause, and switch to a materially different strategy—or report the exact blocker and remaining evidence clearly to the user.]";

/** Keep the original limits, but make omitted context discoverable through read. */
export function promptFileExcerpt(content: string, limit: number, filePath: string): string {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}\n\n[Context truncated: showing ${limit} of ${content.length} characters from ${JSON.stringify(filePath)}. Read the full file before relying on omitted instructions or details.]`;
}

/** Derive guidance from the same filtered tools sent to the model. */
export function buildToolGuidance(tools: readonly NativeToolDefinition[], platform = process.platform): string {
  const names = new Set(tools.map((tool) => tool.function.name));
  const sections: string[] = [];
  if (names.has("todo_write")) {
    sections.push("TASK PROGRESS: For a substantial task with several steps, use 'todo_write' to keep a short checklist and update it as work completes. Planning must lead to the next authorized action; do not spend successive turns only thinking or rewriting the plan. Simple requests do not need a checklist.");
  }
  if (names.has("write") || names.has("edit")) {
    sections.push(`WORKSPACE FILE CHANGES:
- Read existing files before changing them. Use 'edit' for partial changes to preserve unrelated content. Reserve 'write' for new files or an intentional full rewrite after inspecting the existing content; supply the complete file without omitted sections.
- When asked to implement a workspace change, use the available file tools to save it and run appropriate verification. Do not substitute a large code dump for a requested file change.
- Code examples requested by the user, inline OpenUI programs, and Mermaid diagrams may appear in chat; they do not require creating workspace files.`);
  }
  if (names.has("bash") || names.has("powershell")) {
    sections.push(`SHELL EXECUTION:
- Inspect output and exit codes. Use background execution and readiness checks for long-running services when supported by the tool schema.
${platform === "win32" ? "- On Windows, prefer 'powershell' when available for native system commands. npm and git work in either shell; use the selected shell's quoting and path syntax, and do not mix PowerShell syntax with Bash syntax." : "- Use the available shell's quoting and path syntax."}`);
  }
  if (tools.some(tool => tool.function.name === "bash" && tool.function.parameters?.properties?.verify)) {
    sections.push("SHELL VERIFICATION: Set verify: true for foreground builds, tests and acceptance checks. It enables pipefail so tail/tee cannot hide an earlier failed pipeline stage. Run one check or join dependent checks with &&; arbitrary earlier commands separated with semicolons are not covered. Helpers must exit nonzero on failed assertions/deadlines. Ordinary shell commands retain normal Bash semantics, including intentional head/SIGPIPE pipelines; explain intentional nonzero outcomes instead of masking real failures.");
  }
  const loaderCapabilities = tools.find(tool => tool.function.name === "load_plugin_tools")?.function.parameters?.properties?.plugin?.enum;
  const deferredBrowser = Array.isArray(loaderCapabilities) && loaderCapabilities.includes("browser-use");
  if (deferredBrowser) sections.push("AVAILABLE BROWSER: The enabled browser-use plugin can be activated with load_plugin_tools (plugin: browser-use), or by reading its available skill. For routine navigation, interaction and screenshots, inspect this capability before installing a separate browser runner or writing ad hoc helpers. Reuse existing project tests when they fit; a separate runner is appropriate when required viewport/input instrumentation is unavailable in the native tools.");
  if (names.has("browser_evaluate") || deferredBrowser) {
    sections.push("BROWSER VERIFICATION: Collect related, independent DOM measurements in one browser_evaluate call. After an interaction or animation, wait for an observable completion condition with a deadline before asserting the result. Match responsive, touch and reduced-motion assertions to the actual viewport and input environment. A fixed sleep or a screenshot by itself does not prove an interaction passed. Report which environments and checks were actually exercised.");
  }
  if (names.has("computer_snapshot") || names.has("computer_get_app_state")) {
    sections.push(`NATIVE COMPUTER USE (DESKTOP AUTOMATION) PROTOCOL:
- Use the declared computer tools for native app interaction. Never simulate mouse/keyboard input, window activation, OCR, or screenshot capture using terminal scripts.
- Discover running apps/windows with 'computer_list_apps' / 'computer_list_windows' (or launch via 'computer_launch_app'), then inspect controls using 'computer_snapshot' (or 'computer_find'). Always act using qualified snapshot refs (e.g. '@sXXXX:e5'); re-snapshot if a ref goes stale or after UI transitions.
- Semantic ref actions ('computer_click', 'computer_set_value', 'computer_scroll') are headless by default and do not steal focus. Use 'computer_window' with action 'restore' if a target window is minimized, and use 'computer_screenshot' only when visual verification or a saved screenshot is needed.
- Prefer 'computer_wait' over blind delays. Use app-specific keyboard shortcuts only when supported by the observed app/state.
- For messaging: open the intended chat, verify the recipient in its header (including the self-chat label when requested), enter the requested message, and submit only when the user requested sending it. Inspect the resulting state for evidence that it was sent.
- Input delivery alone does not prove the intended outcome. Verify the resulting accessibility state before claiming success, and inspect before retrying after a timeout or ambiguous error.
- Browser tools operate on browser pages, not native app windows or screenshot files.`);
  }
  if (names.has("browser_snapshot")) {
    sections.push(`NATIVE BROWSER AUTOMATION PROTOCOL:
- Use the declared browser tools for web pages. Inspect the current accessibility snapshot and use its refs or semantic selectors; take screenshots when visual layout matters.
- Browser actions change live state: execute dependent actions sequentially, wait for observed conditions when supported, and inspect updated state after navigation or re-rendering. Avoid redundant snapshots and duplicate submissions.
- Use console/network evidence for debugging. Verify the intended result before claiming success.
${names.has("browser_navigate") ? "- Use 'browser_navigate' to open the requested URL; specify tabId or newTab when needed to target the intended tab." : "- This tool set permits inspecting existing browser state; do not assume navigation or mutation tools are available."}
${names.has("browser_request_help") ? "- For CAPTCHA, 2FA/OTP, or password/secret entry, use 'browser_request_help'. After the user returns control, inspect the updated page and continue." : ""}`);
  }
  if (names.has("task")) {
    sections.push(`SUB-AGENT DELEGATION PROTOCOL:
- Delegate scoped tasks with self-contained context, target files, constraints, and acceptance criteria. Child agents start without this conversation's history.
- Use read-only specialist roles for investigation/review. Assign concurrent implementation workers disjoint files and integrate their results.
- Batch independent tasks; run dependent tasks in order. For background tasks use the declared wait/status tools instead of repeated polling or shell sleeps.
- Review the returned task-result findings and verification before reporting completion.`);
  }
  if (names.has("wait") || names.has("manage_task")) {
    sections.push("BACKGROUND WORK: Use the declared wait/status tools for background jobs. Do not execute terminal sleep commands to poll for completion.");
  }
  return sections.join("\n\n");
}
