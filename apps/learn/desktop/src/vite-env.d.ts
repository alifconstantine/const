/// <reference types="vite/client" />

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
        authToken?: string;
        mode?: "ask_before_changes" | "full_access";
        thinkingLevel?: string;
        maxOutputTokens?: number;
      }) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
      abort: () => Promise<boolean>;
      answerQuestion?: (toolCallId: string, answer: any) => Promise<boolean>;
      generateTitle?: (prompt: string, authToken?: string) => Promise<string | null>;
      onStreamEvent: (callback: (event: any) => void) => () => void;
    };
    config?: {
      get: () => Promise<any>;
      save: (newConfig: any) => Promise<any>;
    };
  };
}

