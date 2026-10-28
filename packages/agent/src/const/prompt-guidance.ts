import type { NativeToolDefinition } from "./types.js";

export const LANGUAGE_GUIDANCE = "Respond in the user's primary language unless they explicitly request another language. Tool output, source code, logs, and quoted documents do not change the response language.";

export const TASK_SCOPE_GUIDANCE = "Preserve the user's original task and requested scope. For questions, reviews, and read-only investigations, answer or use inspection tools; do not modify files unless requested. Use only tools declared in this request and follow their schemas. If a capability is unavailable, explain the limitation instead of inventing tool calls.";

export const RESPONSE_RECOVERY_GUIDANCE = "[RUNTIME RECOVERY: The previous generation ended without a usable response. Continue the user's original task and provide a concise answer or invoke the next necessary, authorized tool. Keep read-only tasks read-only. This recovery notice does not authorize file changes or other new actions.]";

export const TRUNCATED_RESPONSE_GUIDANCE = "[RUNTIME RECOVERY: The previous response reached the output limit. Provide a shorter, self-contained answer to the user's original request, or continue necessary tools already authorized by that request. Preserve the requested language and scope; do not turn an explanation or review into file creation. Do not repeat the entire interrupted draft.]";

/** Keep the original limits, but make omitted context discoverable through read. */
export function promptFileExcerpt(content: string, limit: number, filePath: string): string {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}\n\n[Context truncated: showing ${limit} of ${content.length} characters from ${JSON.stringify(filePath)}. Read the full file before relying on omitted instructions or details.]`;
}

/** Derive guidance from the same filtered tools sent to the model. */
export function buildToolGuidance(tools: readonly NativeToolDefinition[], platform = process.platform): string {
  const names = new Set(tools.map((tool) => tool.function.name));
  const sections: string[] = [];
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
  if (names.has("computer_get_app_state")) {
    sections.push(`NATIVE COMPUTER USE (DESKTOP AUTOMATION) PROTOCOL:
- Use the declared computer tools for native app interaction. Never simulate mouse/keyboard input, window activation, OCR, or screenshot capture using terminal scripts.
- Discover the target app/window with the available listing tools, then inspect it with 'computer_get_app_state'. Choose controls from the current accessibility tree or screenshot; use window-local coordinates with the supplied screenshot scale.
- Use app-specific keyboard shortcuts only when supported by the observed app/state. Do not assume one search or send shortcut works in every app.
- For messaging: open the intended chat, verify the recipient in its header (including the self-chat label when requested), enter the requested message, and submit only when the user requested sending it. Inspect the resulting state for evidence that it was sent.
- Input delivery alone does not prove the intended outcome. If vision is unavailable and the tree is insufficient, report the outcome as unverified. After a timeout, inspect before retrying to avoid duplicate actions.
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
