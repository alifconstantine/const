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
        setTitleBarOverlay?: (options: { color?: string; symbolColor?: string; height?: number }) => Promise<void>;
        onMaximizedChange?: (callback: (max: boolean) => void) => () => void;
      };
    };
  }
}

declare module "pdfjs-dist";
declare module "mammoth";
