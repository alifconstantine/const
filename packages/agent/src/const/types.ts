export type Role = "system" | "user" | "assistant" | "tool";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentMessage {
  id?: string;
  role: Role;
  content: string | any[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  thinking?: string;
  timestamp?: number;
}

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: "const" | "const-engine" | "openai" | "google" | "custom";
  baseUrl?: string;
  apiKey?: string;
  supportsThinking?: boolean;
  supportsTools?: boolean;
  thinkingLevels?: string[];
  defaultThinkingLevel?: string;
  maxOutputTokens?: number;
  contextWindow?: number;
  inputTypes?: string[];
}

import type { FileMutationRecord } from "./mutation-ledger.js";

export type ApprovalDecision =
  | "allow_once"
  | "full_access"
  | "allow_conversation"
  | "allow_project"
  | "allow_always"
  | "deny"
  | "skip";

export interface ApprovalRequestData {
  approvalId: string;
  id?: string;
  toolCallId: string;
  toolName: string;
  args: any;
  command?: string;
  cwd?: string;
  description?: string;
  reason?: string;
  createdAt: number;
  timestamp?: number;
  approval?: any;
  targetFile?: string;
  filePath?: string;
  dirPath?: string;
  diffStats?: {
    added: number;
    removed: number;
  };
  isMutation?: boolean;
}

export interface ApprovalResponseData {
  approvalId: string;
  decision: ApprovalDecision;
  feedback?: string;
}

export interface TodoItem {
  id?: string;
  title?: string;
  task?: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface QuestionOption {
  label: string;
  value?: string;
  description?: string;
  recommended?: boolean;
}

export interface QuestionItem {
  id?: string;
  category?: string;
  question: string;
  options?: QuestionOption[];
  is_multi_select?: boolean;
}

export interface BackgroundTaskItem {
  id: string;
  name?: string;
  command: string;
  pid?: number;
  startTime: number;
  status: "running" | "completed" | "failed";
  output?: string[];
  port?: number;
}

export interface SubAgentTraceStep {
  id: string;
  type: "thought" | "tool";
  content?: string;
  startTime?: number;
  durationMs?: number;
  toolCallId?: string;
  name?: string;
  args?: any;
  result?: any;
  isError?: boolean;
  mutation?: FileMutationRecord;
}

export interface SubAgentItem {
  id: string;
  name?: string;
  parentId?: string;
  conversationId?: string;
  description: string;
  prompt: string;
  role?: string;
  model?: string;
  thinkingLevel?: string;
  status: "running" | "completed" | "failed" | "killed";
  startTime: number;
  endTime?: number;
  logs: string[];
  traceSteps?: SubAgentTraceStep[];
  result?: string;
  error?: string;
  artifactPath?: string;
  turnCount?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AgentEventMap {
  token: { token: string };
  token_reset: {};
  thinking: { thinking: string };
  tool_call: { toolCallId: string; toolName: string; args: any };
  tool_result: { toolCallId: string; toolName: string; result: any; isError?: boolean };
  approval_request: ApprovalRequestData;
  approval_resolved: { approvalId: string; decision: ApprovalDecision };
  file_mutation: { record: FileMutationRecord };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    cacheHitRate?: number;
    durationMs?: number;
  };
  context_update: {
    usedTokens: number;
    totalTokens: number;
    systemPromptTokens: number;
    toolsTokens: number;
    messagesTokens: number;
    percent?: number;
  };
  status: { status: "idle" | "thinking" | "calling_tool" | "waiting_approval" | "streaming" | "done" | "error"; message?: string };
  done: { fullContent: string; messages: AgentMessage[] };
  error: { error: string };
  todo_update: { todos: TodoItem[] };
  ask_question: { toolCallId: string; questions: QuestionItem[] };
  task_started: { task: BackgroundTaskItem };
  task_stopped: { taskId: string; code: number | null };
  subagent_started: { agent: SubAgentItem };
  subagent_updated: { agent: SubAgentItem };
  subagent_finished: { agentId: string; result?: string; error?: string; agent?: SubAgentItem };
  subagent_killed: { agentId: string; agent?: SubAgentItem };
  source_created: { source: any };
  artifact_created: { artifact: any };
  steer_message: { conversationId?: string; message: AgentMessage };
}

export type AgentEvent = {
  [K in keyof AgentEventMap]: { type: K } & AgentEventMap[K];
}[keyof AgentEventMap];

export interface NativeToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface AgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  preset?: "harness" | "learn";
  tools?: NativeToolDefinition[];
  systemPrompt?: string;
  workspacePath?: string;
  learnId?: string;
  conversationId?: string;
  parentAgentId?: string;
  taskDepth?: number;
  maxRecursionDepth?: number;
  softTurnBudget?: number;
  maxTurns?: number;
  mode?: "request_review" | "ask_before_changes" | "full_access";
  initialAllowedTools?: Set<string> | string[];
  thinkingLevel?: ThinkingLevel | string;
  maxTokens?: number;
  maxOutputTokens?: number;
  contextWindow?: number;
  onAskQuestion?: (toolCallId: string, questions: QuestionItem[]) => Promise<any>;
  browserHandler?: (toolName: string, args: Record<string, any>) => Promise<{ result: any; isError: boolean }>;
  computerHandler?: (toolName: string, args: Record<string, any>) => Promise<{ result: any; isError: boolean }>;
  voiceConfig?: any;
  imageConfig?: any;
  speechHandler?: (args: Record<string, any>, workspacePath: string) => Promise<{ result: any; isError: boolean }>;
  imageHandler?: (args: Record<string, any>, workspacePath: string) => Promise<{ result: any; isError: boolean }>;
}

export type ConstAgentMessage = AgentMessage;
export type ConstAgentConfig = AgentConfig;
