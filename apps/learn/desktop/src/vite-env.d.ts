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
      deleteWorkspacePath?: (learnId: string) => Promise<{ success: boolean; error?: string }>;
      listFiles?: (folderPath?: string) => Promise<any[]>;
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
      onOpenBrowserUrl?: (callback: (url: string) => void) => () => void;
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
        updateMode?: (payload: {
          mode: "ask_before_changes" | "full_access";
          learnId?: string;
        }) => Promise<{ success: boolean }>;
        generateTitle?: (prompt: string, authToken?: string) => Promise<string | null>;
        generateCompletion?: (payload: {
          messages: { role: string; content: string }[];
          model?: string;
          authToken?: string;
          temperature?: number;
          timeoutMs?: number;
          requestId?: string;
        }) => Promise<{ success: boolean; content?: string; error?: string }>;
        onStudioToken?: (callback: (data: { requestId: string; token: string }) => void) => () => void;
        rollbackFile?: (record: FileMutationRecord) => Promise<{ success: boolean; message: string }>;
        onStreamEvent: (callback: (event: any) => void) => () => void;
      };
      rollbackFile?: (record: FileMutationRecord) => Promise<{ success: boolean; message: string }>;
      config?: {
        get: () => Promise<any>;
        save: (newConfig: any) => Promise<any>;
      };
      inworld?: {
        listVoices: (options: { apiKey: string }) => Promise<{
          success: boolean;
          voices?: Array<{
            voiceId: string;
            displayName: string;
            langCode: string;
            gender: string;
            description?: string;
            tags?: string[];
          }>;
          error?: string;
        }>;
        testVoice: (payload: {
          apiKey: string;
          voiceId: string;
          model?: string;
          text?: string;
          deliveryMode?: string;
          speakingRate?: number;
        }) => Promise<{
          success: boolean;
          audioUrl?: string;
          error?: string;
        }>;
      };
      mcp?: {
        testConnection: (serverConfig: any) => Promise<{
          success: boolean;
          tools?: Array<{ name: string; description?: string; inputSchema?: any }>;
          count?: number;
          sessionId?: string;
          error?: string;
        }>;
        disconnect: (serverConfig: any) => Promise<{
          success: boolean;
          error?: string;
        }>;
        startOAuth: (payload: { provider: string; authUrl?: string }) => Promise<{
          success: boolean;
          token?: string;
          error?: string;
        }>;
        abortOAuth: () => Promise<boolean>;
      };
      video?: {
        getProjectPath: (payload: { learnId: string; artifactId: string }) => Promise<{ success: boolean; projectPath?: string; error?: string }>;
        synthesizeScenes: (payload: {
          learnId: string;
          artifactId: string;
          apiKey: string;
          model?: string;
          voiceId?: string;
          language?: string;
          scenes: Array<{ sceneNumber: number; id: string; narrationText: string }>;
        }) => Promise<{ success: boolean; projectPath?: string; sceneAudios?: any[]; error?: string }>;
        stitchAudio: (payload: {
          learnId: string;
          artifactId: string;
          sceneAudios: Array<{ sceneNumber: number; filename: string; startMs: number }>;
          totalDurationSeconds: number;
        }) => Promise<{ success: boolean; masterAudioPath?: string; masterAudioRelative?: string; masterAudioBase64?: string; error?: string }>;
        saveComposition: (payload: {
          learnId: string;
          artifactId: string;
          htmlContent: string;
          hyperframesJson?: string;
        }) => Promise<{ success: boolean; indexPath?: string; error?: string }>;
        renderMp4: (payload: {
          learnId: string;
          artifactId: string;
        }) => Promise<{ success: boolean; mp4Path?: string; mp4Url?: string; error?: string }>;
        checkStatus?: (payload: {
          learnId: string;
          artifactId: string;
          projectPath?: string;
        }) => Promise<{ success: boolean; exists?: boolean; mp4Path?: string; mp4Url?: string; error?: string }>;
        onRenderProgress?: (callback: (data: { artifactId: string; chunk: string }) => void) => () => void;
      };
      setThemeMode?: (mode: "system" | "light" | "dark") => Promise<any>;
      onSystemThemeChange?: (callback: (mode: "dark" | "light") => void) => () => void;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
      window?: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        toggleFullScreen?: () => void;
        toggleDevTools?: () => void;
        reload?: () => void;
        setZoomLevel?: (level: number) => Promise<void>;
        getZoomLevel?: () => Promise<number>;
        setThemeMode?: (mode: "system" | "light" | "dark") => Promise<any>;
        setTitleBarOverlay?: (options: { color?: string; symbolColor?: string; height?: number; themeMode?: "system" | "light" | "dark" }) => Promise<void>;
        onMaximizedChange?: (callback: (max: boolean) => void) => () => void;
      };
      updater?: {
        checkForUpdates?: () => Promise<{ hasUpdate: boolean; version?: string }>;
        quitAndInstall?: () => void;
      };
      browser?: {
        registerTab: (tabId: string, guestContentsId: number) => Promise<boolean>;
        unregisterTab: (tabId: string) => Promise<boolean>;
        setActiveTab: (tabId: string) => Promise<boolean>;
        listTabs: () => Promise<
          Array<{
            tabId: string;
            guestContentsId: number;
            url: string;
            title: string;
            isActive: boolean;
            isLast: boolean;
            registeredAt: number;
            lastUsedAt: number;
          }>
        >;
        getControl: () => Promise<{
          holder: "bot" | "human";
          since: string;
          requested: boolean;
          requestedAt?: string;
          reason?: string;
          secretWanted?: string;
          secretRef?: string;
          secretSnapshotId?: number;
        }>;
        takeControl: () => Promise<any>;
        releaseControl: () => Promise<any>;
        supplySecret: (text: string) => Promise<{ success: boolean; characters: number }>;
        navigate: (url: string) => Promise<any>;
        snapshot: (args?: any) => Promise<any>;
        click: (args: any) => Promise<any>;
        type: (args: any) => Promise<any>;
        key: (args: any) => Promise<any>;
        scroll: (args: any) => Promise<any>;
        screenshot: (args?: any) => Promise<any>;
        console: (args?: any) => Promise<any>;
        evaluate: (args: any) => Promise<any>;
        onControlChanged: (callback: (state: any) => void) => () => void;
        onAiAction: (callback: (action: any) => void) => () => void;
        onOpenTabRequest: (
          callback: (payload: { url: string; tabId?: string; newTab?: boolean } | string) => void
        ) => () => void;
      };
      canva?: {
        openAuthWindow: (payload: { authUrl: string; redirectUri?: string }) => Promise<{
          success: boolean;
          code?: string;
          state?: string;
          error?: string;
        }>;
        request: (payload: {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        }) => Promise<{
          ok: boolean;
          status: number;
          text: string;
          json?: any;
          error?: string;
        }>;
      };
    };
  }
}

declare module "pdfjs-dist";
declare module "mammoth";
