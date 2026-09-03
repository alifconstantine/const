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
    onAuthCallback: (
      callback: (data: { url: string; token?: string }) => void
    ) => () => void;
  };
}
