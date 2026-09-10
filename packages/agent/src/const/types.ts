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
}

import type { FileMutationRecord } from "./mutation-ledger.js";

export interface AgentEventMap {
  token: { token: string };
  token_reset: {};
  thinking: { thinking: string };
  tool_call: { toolCallId: string; toolName: string; args: any };
  tool_result: { toolCallId: string; toolName: string; result: any; isError?: boolean };
  file_mutation: { record: FileMutationRecord };
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  status: { status: "idle" | "thinking" | "calling_tool" | "streaming" | "done" | "error"; message?: string };
  done: { fullContent: string; messages: AgentMessage[] };
  error: { error: string };
}

export type AgentEvent = {
  [K in keyof AgentEventMap]: { type: K } & AgentEventMap[K];
}[keyof AgentEventMap];

export interface AgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  workspacePath?: string;
  maxTurns?: number;
  mode?: "ask_before_changes" | "full_access";
  thinkingLevel?: ThinkingLevel | string;
  maxTokens?: number;
  maxOutputTokens?: number;
}

export type ConstAgentMessage = AgentMessage;
export type ConstAgentConfig = AgentConfig;

