/// <reference types="vite/client" />

export interface FileMutationRecord {
  id: string;
  stepIndex?: number;
  operation: "create" | "modify" | "delete";
  absolutePath?: string;
  filePath?: string;
  targetFile?: string;
  previousContent: string | null;
  newContent?: string | null;
  timestamp: number;
  rolledBack?: boolean;
}

export type ApprovalDecision =
  | "allow_once"
  | "allow_conversation"
  | "allow_project"
  | "allow_always"
  | "deny"
  | "skip";

export interface ApprovalRequestData {
  approvalId?: string;
  id?: string;
  toolCallId?: string;
  toolName?: string;
  command?: string;
  args?: any;
  cwd?: string;
  description?: string;
  reason?: string;
  createdAt?: number;
  timestamp?: number;
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
      openPath?: (targetPath: string) => Promise<boolean>;
      readFile?: (filePath: string) => Promise<string | null>;
      readMedia?: (filePath: string) => Promise<string | null>;
      openDirectoryDialog: () => Promise<string | null>;
      openFileDialog?: (options?: { multiple?: boolean }) => Promise<string[] | null>;
      getDefaultWorkspacePath?: (learnId?: string) => Promise<string>;
      startAuth?: (options?: {
        accountsUrl?: string;
        action?: string;
      }) => Promise<{
        success: boolean;
        port?: number;
        state?: string;
        callbackUrl?: string;
        authUrl?: string;
        error?: string;
      }>;
      cancelAuth?: () => Promise<{ success: boolean }>;
      onAuthCallback: (
        callback: (data: { url: string; token?: string; cancelled?: boolean; error?: string }) => void
      ) => () => void;
      agent?: {
        getModels: () => Promise<any[]>;
        sendMessage: (payload: {
          messages: any[];
          model?: string;
          workspacePath?: string;
          learnId?: string;
          authToken?: string;
          mode?: "ask_before_changes" | "full_access";
          thinkingLevel?: string;
          maxOutputTokens?: number;
        }) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
        abort: () => Promise<boolean>;
        answerQuestion?: (toolCallId: string, answer: any) => Promise<boolean>;
        respondApproval?: (payload: {
          approvalId: string;
          decision?: ApprovalDecision | string;
          approved?: boolean;
          feedback?: string;
        }) => Promise<{ success: boolean; resolved?: boolean; error?: string }>;
        generateTitle?: (prompt: string, authToken?: string) => Promise<string | null>;
        rollbackFile?: (record: FileMutationRecord) => Promise<{ success: boolean; message: string }>;
        onStreamEvent: (callback: (event: any) => void) => () => void;
      };
      rollbackFile?: (record: FileMutationRecord) => Promise<{ success: boolean; message: string }>;
      config?: {
        get: () => Promise<any>;
        save: (newConfig: any) => Promise<any>;
      };
    };
  }
}
