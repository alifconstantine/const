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

export type ApprovalDecision =
  | "allow_once"
  | "allow_conversation"
  | "allow_project"
  | "allow_always"
  | "deny"
  | "skip";

export interface ApprovalRequestData {
  id: string;
  approvalId?: string;
  conversationId?: string;
  toolCallId: string;
  toolName: string;
  args: any;
  command?: string;
  cwd?: string;
  description?: string;
  reason?: string;
  createdAt?: number;
  timestamp?: number;
  approval?: any;
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
  command: string;
  pid?: number;
  startTime: number;
  status: "running" | "completed" | "failed";
  output?: string[];
}

export interface AgentStreamEvent {
  conversationId?: string;
  type:
    | "token"
    | "token_reset"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "approval_request"
    | "approval_resolved"
    | "file_mutation"
    | "usage"
    | "status"
    | "done"
    | "error"
    | "todo_update"
    | "ask_question"
    | "task_started"
    | "task_stopped";
  token?: string;
  thinking?: string;
  toolCallId?: string;
  toolName?: string;
  args?: any;
  result?: any;
  isError?: boolean;
  approvalId?: string;
  approval?: any;
  id?: string;
  decision?: "allow_once" | "allow_always" | "deny" | "skip";
  command?: string;
  cwd?: string;
  description?: string;
  reason?: string;
  createdAt?: number;
  timestamp?: number;
  record?: FileMutationRecord;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  status?: string;
  fullContent?: string;
  messages?: any[];
  error?: string;
  todos?: TodoItem[];
  questions?: QuestionItem[];
  task?: BackgroundTaskItem;
  taskId?: string;
  code?: number | null;
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
      setZoomFactor?: (factor: number) => void;
      getZoomFactor?: () => number;
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
        aborted?: boolean;
        messages?: any[];
        workspacePath?: string;
        isOutsideProject?: boolean;
        error?: string;
      }>;
      abortAgent: (conversationId?: string) => Promise<boolean>;
      updateMode?: (payload: {
        mode: "ask_before_changes" | "full_access";
        conversationId?: string;
      }) => Promise<{ success: boolean; updated?: boolean; pending?: boolean }>;
      respondApproval?: (payload: {
        conversationId: string;
        approvalId: string;
        decision: ApprovalDecision;
        feedback?: string;
      }) => Promise<{ success: boolean; error?: string }>;
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
      pinConversation?: (id: string, isPinned: boolean) => Promise<boolean>;
      pinProject?: (projectName: string, isPinned: boolean) => Promise<boolean>;
      getProjectPins?: () => Promise<string[]>;
      getConversationPaths?: (
        conversationId?: string,
        workspacePath?: string
      ) => Promise<{
        workspacePath: string;
        taskPath: string;
        logPath: string;
        configPath: string;
      }>;
      getTranscript?: (conversationId: string) => Promise<string>;
      importLegacyConversations?: (convos: any[]) => Promise<boolean>;
      listFiles?: (
        workspacePath?: string
      ) => Promise<
        Array<{
          id: string;
          name: string;
          path: string;
          parentDir?: string;
          fullPath: string;
          type: "code" | "image" | "doc" | "generic";
          kind?: "file" | "directory";
        }>
      >;
      readFile?: (filePath: string) => Promise<{ content?: string; truncated?: boolean; error?: string }>;
      openPath?: (targetPath: string) => Promise<boolean>;
      resolveWorkspacePath?: (options?: { project?: string; conversationId?: string }) => Promise<string>;
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
      terminal?: {
        create: (options: {
          id: string;
          cwd?: string;
          project?: string;
          conversationId?: string;
          shell?: string;
          cols?: number;
          rows?: number;
        }) => Promise<{ success: boolean; id?: string; cwd?: string; error?: string }>;
        write: (options: { id: string; data: string }) => Promise<boolean>;
        destroy: (id: string) => Promise<boolean>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number | null }) => void) => () => void;
      };
      answerQuestion?: (toolCallId: string, answer: any) => Promise<boolean>;
      listBackgroundTasks?: () => Promise<BackgroundTaskItem[]>;
      killBackgroundTask?: (taskId: string) => Promise<boolean>;
      getBackgroundTaskLogs?: (taskId: string) => Promise<string[]>;
      onBackgroundTaskEvent?: (
        callback: (event: {
          type: "output" | "status";
          taskId: string;
          data?: string;
          status?: string;
          code?: number | null;
        }) => void
      ) => () => void;
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

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        partition?: string;
        allowpopups?: string | boolean;
        webpreferences?: string;
        useragent?: string;
        autosize?: string | boolean;
        nodeintegration?: string | boolean;
        disablewebsecurity?: string | boolean;
        [key: string]: any;
      };
    }
  }
}

