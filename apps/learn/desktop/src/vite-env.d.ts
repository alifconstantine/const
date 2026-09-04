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
    onAuthCallback: (
      callback: (data: { url: string; token?: string }) => void
    ) => () => void;
    agent?: {
      getModels: () => Promise<any[]>;
      sendMessage: (payload: {
        messages: any[];
        model?: string;
        workspacePath?: string;
      }) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
      abort: () => Promise<boolean>;
      onStreamEvent: (callback: (event: any) => void) => () => void;
    };
  };
}

