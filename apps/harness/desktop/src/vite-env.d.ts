/// <reference types="vite/client" />

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

export interface FileMutationRecord {
  id: string;
  stepIndex?: number;
  filePath: string;
  targetFile: string;
  operation: "create" | "modify" | "delete";
  previousContent: string | null;
  newContent: string | null;
  timestamp: number;
  rolledBack?: boolean;
}

export interface AgentStreamEvent {
  type:
    | "token"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "file_mutation"
    | "status"
    | "done"
    | "error";
  token?: string;
  thinking?: string;
  toolCallId?: string;
  toolName?: string;
  args?: any;
  result?: any;
  isError?: boolean;
  record?: FileMutationRecord;
  status?: string;
  fullContent?: string;
  messages?: any[];
  error?: string;
}

export interface ModelOption {
  id: string;
  displayName: string;
  provider?: string;
  supportsThinking?: boolean;
  supportsTools?: boolean;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface UserConfig {
  activeModel: string;
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  customModels?: Array<{
    id: string;
    displayName: string;
    provider: string;
    baseUrl?: string;
    supportsThinking?: boolean;
    supportsTools?: boolean;
  }>;
}

declare global {
  interface Window {
    electron?: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      openExternal: (url: string) => Promise<boolean>;
      openDirectoryDialog: () => Promise<string | null>;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
      isMaximized?: () => Promise<boolean>;
      onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
      onAuthCallback: (
        callback: (data: { url: string; token?: string }) => void
      ) => () => void;
      sendMessage: (payload: {
        messages: any[];
        model?: string;
        workspacePath?: string;
        mode?: "ask_before_changes" | "full_access";
        conversationId?: string;
      }) => Promise<{
        success: boolean;
        messages?: any[];
        workspacePath?: string;
        isOutsideProject?: boolean;
        error?: string;
      }>;
      abortAgent: () => Promise<boolean>;
      rollbackFile: (record: FileMutationRecord) => Promise<{
        success: boolean;
        message?: string;
        targetFile?: string;
      }>;
      getModels: () => Promise<ModelOption[]>;
      getConfig: () => Promise<UserConfig>;
      saveConfig: (config: Partial<UserConfig>) => Promise<UserConfig>;
      generateTitle: (prompt: string) => Promise<string | null>;
      onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void;
    };
  }
}

