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
      }) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
      abort: () => Promise<boolean>;
      onStreamEvent: (callback: (event: any) => void) => () => void;
    };
  };
}

