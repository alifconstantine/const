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

export interface TraceStep {
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
  providerName?: string;
  supportsThinking?: boolean;
  supportsTools?: boolean;
  thinkingLevels?: string[];
  defaultThinkingLevel?: string;
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
        callback: (data: { url: string; token?: string; cancelled?: boolean; error?: string }) => void
      ) => () => void;
      startAuth?: (options?: { accountsUrl?: string; action?: string }) => Promise<{
        success: boolean;
        port?: number;
        state?: string;
        callbackUrl?: string;
        authUrl?: string;
        error?: string;
      }>;
      cancelAuth?: () => Promise<{ success: boolean }>;
      sendMessage: (payload: {
        messages: any[];
        model?: string;
        thinkingLevel?: string;
        workspacePath?: string;
        mode?: "ask_before_changes" | "full_access";
        conversationId?: string;
        authToken?: string;
        maxOutputTokens?: number;
      }) => Promise<{
        success: boolean;
        messages?: any[];
        workspacePath?: string;
        isOutsideProject?: boolean;
        error?: string;
      }>;
      abortAgent: (conversationId?: string) => Promise<boolean>;
      getRunningSessions?: () => Promise<string[]>;
      onSessionStarted?: (callback: (data: { conversationId: string }) => void) => () => void;
      onSessionEnded?: (callback: (data: { conversationId: string }) => void) => () => void;
      rollbackFile: (record: FileMutationRecord) => Promise<{
        success: boolean;
        message?: string;
        targetFile?: string;
      }>;
      getModels: () => Promise<ModelOption[]>;
      getConfig: () => Promise<UserConfig>;
      saveConfig: (config: Partial<UserConfig>) => Promise<UserConfig>;
      generateTitle: (prompt: string, authToken?: string) => Promise<string | null>;
      onAgentEvent: (callback: (event: AgentStreamEvent) => void) => () => void;
      listConversations?: (includeArchived?: boolean) => Promise<any[]>;
      listArchivedConversations?: () => Promise<any[]>;
      getConversation?: (id: string) => Promise<any | null>;
      saveConversation?: (convo: any) => Promise<boolean>;
      deleteConversation?: (id: string) => Promise<boolean>;
      renameConversation?: (id: string, title: string) => Promise<boolean>;
      archiveConversation?: (id: string) => Promise<boolean>;
      unarchiveConversation?: (id: string) => Promise<boolean>;
      pinProject?: (projectName: string, isPinned: boolean) => Promise<boolean>;
      getProjectPins?: () => Promise<string[]>;
      importLegacyConversations?: (convos: any[]) => Promise<boolean>;
      listFiles?: (
        workspacePath?: string
      ) => Promise<
        Array<{
          id: string;
          name: string;
          path: string;
          fullPath: string;
          type: "code" | "image" | "doc" | "generic";
        }>
      >;
      openPath?: (targetPath: string) => Promise<boolean>;
      onConversationsChanged?: (callback: (data: { conversationId?: string }) => void) => () => void;
      scheduledTasks?: {
        list: () => Promise<ScheduledTaskItem[]>;
        create: (data: Partial<ScheduledTaskItem>) => Promise<ScheduledTaskItem>;
        update: (data: Partial<ScheduledTaskItem> & { id: string }) => Promise<ScheduledTaskItem | null>;
        delete: (id: string) => Promise<boolean>;
        run: (id: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        history: (taskId?: string) => Promise<ScheduledTaskRunHistory[]>;
        deleteRun: (id: string) => Promise<boolean>;
        onChanged: (callback: () => void) => () => void;
      };
    };
  }
}

export interface ScheduledTaskSchedule {
  type?: "hourly" | "daily" | "weekdays" | "weekly" | "monthly" | "custom";
  kind?: "hourly" | "daily" | "weekdays" | "weekly" | "monthly" | "custom";
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customInterval?: number;
  customUnit?: "minutes" | "hours" | "days" | "weeks" | "months";
  endsType?: "never" | "date";
  endDate?: string;
}

export interface ScheduledTaskItem {
  id: string;
  name: string;
  prompt: string;
  title?: string;
  instructions?: string;
  workspacePath: string;
  schedule: ScheduledTaskSchedule;
  model?: string;
  conversationId?: string;
  permissionPreset?: "ask_before_changes" | "full_access" | "read-only" | "workspace-write" | "danger-full-access" | "prompt" | "auto" | string;
  enabled: boolean;
  createdAt: number | string;
  updatedAt: number | string;
  lastRunAt?: number | string;
  nextRunAt?: number | string;
  runCount: number;
}

export interface ScheduledTaskRunHistory {
  id: string;
  taskId: string;
  taskName: string;
  sessionId?: string;
  conversationId?: string;
  status: "completed" | "failed" | "in-progress" | "skipped";
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  error?: string;
  source?: "scheduled" | "manual";
}

