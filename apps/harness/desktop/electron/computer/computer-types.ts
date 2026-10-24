export interface ComputerApp {
  name: string;
  bundleId?: string | null;
  pid: number;
}

export interface ComputerWindow {
  title: string;
  id?: number | null;
  index?: number | null;
  x?: number | null;
  y?: number | null;
  width?: number;
  height?: number;
}

export interface ComputerElement {
  index: number;
  runtimeId?: number[];
  role?: string;
  name?: string;
  value?: string;
  actions?: string[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ComputerSnapshot {
  id?: string;
  app: ComputerApp;
  window?: ComputerWindow;
  windowTitle?: string;
  windowId?: number | null;
  windowIndex?: number | null;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  treeLines?: string[];
  treeText?: string;
  elementCount?: number;
  elements?: ComputerElement[];
  focusedElementId?: number | null;
  focusedSummary?: string | null;
  selectedText?: string | null;
  screenshotPngBase64?: string | null;
  screenshotWidth?: number | null;
  screenshotHeight?: number | null;
  screenshotScale?: number | null;
}

export interface ComputerActionResult {
  ok: boolean;
  action?: {
    path?: string;
    actionName?: string | null;
    fallbackReason?: string | null;
    verification?: {
      state: string;
      reason?: string;
    };
  };
  snapshot?: ComputerSnapshot;
  error?: string;
  observationError?: string;
}

export interface BridgeRequest {
  session?: string;
  requestId?: number;
  tool: string;
  app?: string;
  element?: any;
  fromElement?: any;
  toElement?: any;
  x?: number;
  y?: number;
  from_x?: number;
  from_y?: number;
  to_x?: number;
  to_y?: number;
  click_count?: number;
  mouse_button?: string;
  modifiers?: string;
  action?: string;
  direction?: string;
  pages?: number;
  text?: string;
  key?: string;
  value?: string;
  windowId?: number | null;
  windowIndex?: number | null;
  noScreenshot?: boolean;
  restoreWindow?: boolean;
}

export interface BridgeResponse {
  ok: boolean;
  requestId?: number;
  capabilities?: any;
  apps?: ComputerApp[];
  app?: ComputerApp;
  windows?: ComputerWindow[];
  snapshot?: ComputerSnapshot;
  action?: any;
  error?: string;
  observationError?: string;
}
