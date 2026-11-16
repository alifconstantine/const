import { randomUUID } from "node:crypto";
import path from "node:path";
import { extractCommandArg, extractPathArg, isPathWithinWorkspace, resolveSafePath } from "./tools.js";
import { getToolActionKind, normalizeToolName } from "./tool-policy.js";
import type { AgentConfig, AgentEvent, ApprovalRequestData, ApprovalResponseData, NativeToolDefinition, ToolCall } from "./types.js";

export interface ToolAuthorizationResult {
  allowOutsideWorkspace: boolean;
  waitingMs: number;
  rejection?: { decision: "deny" | "skip"; text: string };
}

/** Permission decisions stay at the host boundary for either model runtime. */
export class ToolAuthorization {
  private pendingApprovals = new Map<string, (response: ApprovalResponseData) => void>();
  private sessionAllowedTools = new Set<string>();

  constructor(private readonly config: AgentConfig) {
    for (const item of config.initialAllowedTools ?? []) {
      if (item) this.sessionAllowedTools.add(item.includes(":") || item === "file_mutations" ? item : normalizeToolName(item));
    }
  }

  public get sessionAllowedToolsSet(): Set<string> {
    return new Set(this.sessionAllowedTools);
  }

  public get mode(): "request_review" | "ask_before_changes" | "full_access" {
    return this.config.mode || "ask_before_changes";
  }

  public updateMode(newMode: "request_review" | "ask_before_changes" | "full_access"): void {
    this.config.mode = newMode;
    if (newMode === "full_access") {
      // Auto-resolve any pending approvals immediately so execution proceeds
      for (const [id, resolver] of this.pendingApprovals.entries()) {
        try {
          resolver({
            approvalId: id,
            decision: "allow_once",
          });
        } catch {}
      }
      this.pendingApprovals.clear();
    }
  }

  public resolveApproval(approvalId: string, response: ApprovalResponseData): boolean {
    if (response.approvalId !== approvalId) return false;
    const resolver = this.pendingApprovals.get(approvalId);
    if (resolver) {
      this.pendingApprovals.delete(approvalId);
      resolver(response);
      return true;
    }
    return false;
  }

  denyPending(feedback: string): void {
    for (const [approvalId, resolve] of this.pendingApprovals) {
      resolve({ approvalId, decision: "deny", feedback });
    }
  }

  async authorize(
    tc: ToolCall,
    parsedArgs: Record<string, any>,
    workspacePath: string,
    externalDefinition: NativeToolDefinition | undefined,
    signal: AbortSignal,
    onEvent: (event: AgentEvent) => void,
  ): Promise<ToolAuthorizationResult> {
    // Check for Approval in "ask_before_changes" mode for terminal / shell execution, python execution, and file mutations
    const toolLower = normalizeToolName(tc.function.name);
    const actionKind = getToolActionKind(tc.function.name);
    const isTerminalTool = actionKind === "terminal";
    const isPythonTool = actionKind === "python";
    const isFileMutationTool = actionKind === "file_mutation";
    const isExternalTool = tc.function.name.startsWith("mcp_");


    let cmd = isTerminalTool ? extractCommandArg(parsedArgs) : undefined;
    let targetCwd = workspacePath;
    let description = isExternalTool ? `Call connected tool: ${tc.function.name}` : "";
    let isOutside = false;
    let targetFilePath = "";

    let diffStats: { added: number; removed: number } | undefined = undefined;
    let fileName = "";
    let dirPath = "";

    if (isTerminalTool) {
      const rawCwd = parsedArgs.cwd || parsedArgs.working_directory || parsedArgs.workdir || parsedArgs.path;
      targetCwd = rawCwd ? path.resolve(workspacePath, rawCwd) : workspacePath;
      description = `Execute terminal command: ${cmd || tc.function.name}`;
    } else if (isPythonTool) {
      const pyCode =
        (typeof parsedArgs.code === "string" ? parsedArgs.code : "") ||
        (typeof parsedArgs.script === "string" ? parsedArgs.script : "") ||
        (typeof parsedArgs.python_code === "string" ? parsedArgs.python_code : "");
      cmd = pyCode ? (pyCode.length > 80 ? pyCode.slice(0, 77) + "..." : pyCode) : "run_python";
      targetCwd = workspacePath;
      description = `Execute Python script: ${cmd}`;
    } else if (isFileMutationTool) {
      targetFilePath = extractPathArg(parsedArgs) || "";
      const resolvedPath = resolveSafePath(targetFilePath, workspacePath);
      isOutside = !isPathWithinWorkspace(resolvedPath, workspacePath);
      cmd = `${tc.function.name}: ${targetFilePath || "file"}`;
      targetCwd = workspacePath;
      description = `Modify file: ${targetFilePath || tc.function.name}`;

      const cleanRelPath = isOutside
        ? targetFilePath
        : path.relative(workspacePath, resolvedPath).replace(/\\/g, "/");
      fileName = cleanRelPath.split("/").filter(Boolean).pop() || targetFilePath;
      dirPath = cleanRelPath.split("/").slice(0, -1).join("/");
      if (dirPath) dirPath = `${dirPath}/`;

      // Compute added / removed lines estimate
      if (toolLower === "write" || toolLower === "writefile") {
        const codeStr = parsedArgs.CodeContent || parsedArgs.code || parsedArgs.content || "";
        const lineCount = typeof codeStr === "string" ? codeStr.split("\n").length : 1;
        diffStats = { added: lineCount, removed: 0 };
      } else if (toolLower === "replaceinfile") {
        const rep = typeof parsedArgs.ReplacementContent === "string" ? parsedArgs.ReplacementContent.split("\n").length : 1;
        const tar = typeof parsedArgs.TargetContent === "string" ? parsedArgs.TargetContent.split("\n").length : 1;
        diffStats = { added: rep, removed: tar };
      } else if (toolLower === "edit" || toolLower === "editfile") {
        const codeStr = parsedArgs.code || parsedArgs.content || "";
        const lineCount = typeof codeStr === "string" ? codeStr.split("\n").length : 1;
        diffStats = { added: lineCount, removed: 0 };
      }
    }

    const isAlreadyAllowed =
      this.sessionAllowedTools.has(toolLower) ||
      (isFileMutationTool && this.sessionAllowedTools.has("file_mutations") && !isOutside) ||
      Boolean(
        targetFilePath &&
          (this.sessionAllowedTools.has(`file:${targetFilePath}`) ||
            this.sessionAllowedTools.has(`file:${resolveSafePath(targetFilePath, workspacePath)}`))
      ) ||
      Boolean(cmd && this.sessionAllowedTools.has(`cmd:${cmd.trim()}`));

    // Mode behavior:
    // In "request_review", EVERY action (including file edits inside workspace) requires approval.
    // In "ask_before_changes", file mutations INSIDE workspace proceed without interruption,
    // while terminal executions, Python executions, and out-of-workspace writes require approval.
    const isRequestReview = this.config.mode === "request_review";
    const requiresApproval =
      (isExternalTool && externalDefinition?.requiresApproval !== false) || (isRequestReview
        ? isTerminalTool || isPythonTool || isFileMutationTool
        : this.config.mode === "ask_before_changes" && (isTerminalTool || isPythonTool || (isFileMutationTool && isOutside)));

    let approvedThisTurn = false;
    let waitingMs = 0;

    if ((isRequestReview || this.config.mode === "ask_before_changes") && requiresApproval && !isAlreadyAllowed) {
      const approvalId = `appr_${randomUUID()}`;

      const approvalReq: ApprovalRequestData = {
        approvalId,
        toolCallId: tc.id,
        toolName: tc.function.name,
        args: parsedArgs,
        command: cmd,
        cwd: targetCwd,
        description,
        createdAt: Date.now(),
        targetFile: fileName || undefined,
        filePath: targetFilePath || undefined,
        dirPath: dirPath || undefined,
        diffStats,
        isMutation: isFileMutationTool,
      };

      // Wait for user approval or abort signal
      const approvalStartedAt = Date.now();
      const userResponse = await new Promise<ApprovalResponseData>((resolve, reject) => {
        const onAbort = () => {
          this.pendingApprovals.delete(approvalId);
          reject(new Error("Operation cancelled"));
        };

        if (signal.aborted) {
          return reject(new Error("Operation cancelled"));
        }
        signal.addEventListener("abort", onAbort, { once: true });

        this.pendingApprovals.set(approvalId, (res) => {
          this.pendingApprovals.delete(approvalId);
          signal.removeEventListener("abort", onAbort);
          resolve(res);
        });

        // Register first: subscribers may respond or change mode synchronously.
        try {
          onEvent({
            type: "status",
            status: "waiting_approval",
            message: `Waiting for approval: ${description || cmd || tc.function.name}`,
          });
          if (!this.pendingApprovals.has(approvalId)) return;
          onEvent({
            type: "approval_request",
            id: approvalId,
            approval: approvalReq,
            ...approvalReq,
          });
        } catch (error) {
          this.pendingApprovals.delete(approvalId);
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      });

      const decision = String(userResponse.decision) === "approve_once" ? "allow_once" : userResponse.decision;
      onEvent({
        type: "approval_resolved",
        approvalId,
        decision,
      });

      waitingMs += Date.now() - approvalStartedAt;
      if (signal.aborted) {
        throw new Error("User cancelled agent execution.");
      }

      if (decision === "full_access") {
        this.updateMode("full_access");
        approvedThisTurn = true;
      } else if (
        decision === "allow_always" ||
        decision === "allow_conversation" ||
        decision === "allow_project"
      ) {
        approvedThisTurn = true;
        if (isFileMutationTool) {
          this.sessionAllowedTools.add(toolLower);
          if (targetFilePath) {
            this.sessionAllowedTools.add(`file:${targetFilePath}`);
            this.sessionAllowedTools.add(`file:${resolveSafePath(targetFilePath, workspacePath)}`);
          }
          if (!isOutside) {
            this.sessionAllowedTools.add("file_mutations");
          }
        } else if (isPythonTool) {
          this.sessionAllowedTools.add(toolLower);
          if (cmd && cmd.trim()) this.sessionAllowedTools.add(`cmd:${cmd.trim()}`);
        } else if (cmd && cmd.trim()) {
          this.sessionAllowedTools.add(`cmd:${cmd.trim()}`);
          this.sessionAllowedTools.add(toolLower);
        } else {
          this.sessionAllowedTools.add(toolLower);
        }
      } else if (decision === "allow_once") {
        approvedThisTurn = true;
      } else if (decision === "deny") {
        const feedbackText = userResponse.feedback?.trim();
        const actionSubject = isFileMutationTool
          ? `file mutation: '${targetFilePath || "file"}'`
          : isPythonTool
          ? `Python execution`
          : `command: '${cmd}'`;
        const rejectionMessage = feedbackText
          ? `[ACTION REJECTED BY USER]: The user denied permission to execute ${actionSubject}. User instruction / feedback: "${feedbackText}". Adapt your plan immediately based on this instruction and proceed without running that action.`
          : `[ACTION REJECTED BY USER]: The user denied permission to execute ${actionSubject}. Do NOT execute this action. Choose a different approach or explain the options clearly.`;

        return { allowOutsideWorkspace: false, waitingMs, rejection: { decision: "deny", text: rejectionMessage } };
      } else if (decision === "skip") {
        return { allowOutsideWorkspace: false, waitingMs, rejection: { decision: "skip", text: "The user skipped this action. Proceed with the remaining work." } };
      } else {
        return { allowOutsideWorkspace: false, waitingMs, rejection: { decision: "deny", text: "The tool requires a valid approval decision." } };
      }
    }
    const allowOutsideWorkspace =
      !this.config.isolateWorkspace && (this.config.mode === "full_access" || isAlreadyAllowed || approvedThisTurn);
    return { allowOutsideWorkspace, waitingMs };
  }
}
