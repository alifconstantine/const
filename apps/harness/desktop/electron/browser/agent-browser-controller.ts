import type { BrowserWindow } from "electron";
import { createRequire } from "node:module";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertBrowserNavigation, normalizeBrowserUrl } from "./navigation-policy.js";
import { AgentBrowserDaemon, type AgentBrowserDaemonOptions } from "./agent-browser-daemon.js";

const requireFromHere = createRequire(import.meta.url);

export type BrowserControlStatus = "idle" | "running" | "paused";

export interface ControlState {
  conversationId?: string;
  tabId?: string;
  status: BrowserControlStatus;
  holder: "bot" | "human";
  since: string;
  requested: boolean;
  requestedAt?: string;
  reason?: string;
}

export interface BrowserTabSummary {
  tabId: string;
  label: string;
  url: string;
  title: string;
  conversationId?: string;
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  registeredAt: number;
  lastUsedAt: number;
}

export interface BrowserTabSessionInfo {
  tabId: string;
  label: string;
  url: string;
  title: string;
  streamUrl: string | null;
  streamPort: number | null;
  canGoBack: boolean;
  canGoForward: boolean;
  viewport: { width: number; height: number };
  control: ControlState;
}

export interface BrowserSelectedElementPayload {
  tag: string;
  id: string;
  className: string;
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  font: string;
  textSnippet: string;
  htmlSnippet: string;
  url: string;
}

interface TrackedTab {
  tabId: string;
  label: string;
  conversationId?: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  zoomFactor: number;
  viewport: { width: number; height: number; mobile?: boolean };
  registeredAt: number;
  lastUsedAt: number;
}

interface SessionControlContext {
  conversationId?: string;
  signal?: AbortSignal;
}

interface HelpWaiter {
  conversationId?: string;
  resolve: (result: { status: "resolved" | "cancelled" | "timeout"; message: string }) => void;
}

export interface AgentBrowserControllerCallbacks {
  onStateChange?: (state: ControlState) => void;
  onAiAction?: (action: {
    type: string;
    detail?: string;
    tabId?: string;
    conversationId?: string;
    timestamp: string;
  }) => void;
  onOpenTabRequest?: (payload: {
    url: string;
    tabId?: string;
    newTab?: boolean;
    conversationId?: string;
  }) => string | void;
  onStopAgent?: (conversationId?: string) => void;
}

const DEFAULT_HOME_URL = "https://www.google.com/";
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const HELP_TIMEOUT_MS = 10 * 60 * 1000;

function sanitizeTabLabel(tabId: string): string {
  const cleaned = String(tabId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `h_${cleaned}`.slice(0, 60);
}

function normalizeRefSelector(ref?: string, selector?: string): string | undefined {
  if (typeof ref === "string" && ref.trim()) {
    const trimmed = ref.trim();
    if (trimmed.startsWith("@")) return trimmed;
    if (/^e\d+$/i.test(trimmed)) return `@${trimmed.toLowerCase()}`;
    return trimmed;
  }
  if (typeof selector === "string" && selector.trim()) {
    return selector.trim();
  }
  return undefined;
}

function normalizeKeyChord(key: string, modifiers?: string[]): string {
  const cleanKey = String(key || "").trim();
  if (!cleanKey) return "Enter";
  if (!modifiers?.length) return cleanKey;
  const normalizedMods = modifiers
    .map((m) => {
      const lower = String(m || "").trim().toLowerCase();
      if (lower === "ctrl" || lower === "control") return "Control";
      if (lower === "cmd" || lower === "command" || lower === "meta" || lower === "win") return "Meta";
      if (lower === "alt" || lower === "option") return "Alt";
      if (lower === "shift") return "Shift";
      return "";
    })
    .filter(Boolean);
  if (!normalizedMods.length) return cleanKey;
  return `${normalizedMods.join("+")}+${cleanKey}`;
}

function formatScreenshotDir(): string {
  const dir = path.join(os.homedir(), ".const", "harness", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Native `agent-browser` controller for Const Harness.
 *
 * - Runs a single shared persistent Chromium profile (`~/.const/harness/browser-profile`)
 *   so authentication (Google, GitHub, etc.) persists across every workspace & new chat.
 * - Isolates each Harness right-pane browser tab using unique `agent-browser` tab labels (`h_<tabId>`).
 * - Exposes live WebSocket screencast (`streamUrl`) for real-time local & remote rendering.
 * - Manages minimalist `idle` -> `running` (Stop) -> `paused` (Continue) agent control state.
 */
export class AgentBrowserController {
  private readonly daemon: AgentBrowserDaemon;
  private readonly sessionStore = new AsyncLocalStorage<SessionControlContext>();

  private tabs = new Map<string, TrackedTab>();
  private activeDaemonTabId: string | null = null;
  private activeTabByConversation = new Map<string, string>();
  private controlByConversation = new Map<string, ControlState>();
  private helpWaiters: HelpWaiter[] = [];
  private allowedDomains: string[] = [];
  private callbacks: AgentBrowserControllerCallbacks = {};
  private parentWindow: BrowserWindow | null = null;
  private browserBootstrapped = false;

  constructor(daemonOptions?: AgentBrowserDaemonOptions) {
    this.daemon = new AgentBrowserDaemon(daemonOptions);
  }

  public setParentWindow(win: BrowserWindow | null): void {
    this.parentWindow = win;
  }

  public setCallbacks(callbacks: AgentBrowserControllerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getProfileDir(): string {
    return this.daemon.profileDir;
  }

  public getStreamInfo(): { streamUrl: string | null; streamPort: number | null } {
    return {
      streamUrl: this.daemon.getStreamUrl({ maxFps: 0, pacing: "push" }),
      streamPort: this.daemon.getStreamPort(),
    };
  }

  // ---------------------------------------------------------------------------
  // Domain policy
  // ---------------------------------------------------------------------------

  public getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }

  public setAllowedDomains(domains: string[]): string[] {
    this.allowedDomains = Array.isArray(domains)
      ? domains.map((d) => String(d || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return this.getAllowedDomains();
  }

  public assertNavigationAllowed(url: string): void {
    assertBrowserNavigation(url, this.allowedDomains);
  }

  // ---------------------------------------------------------------------------
  // Session scoping helpers (compatible with existing main.ts IPC wiring)
  // ---------------------------------------------------------------------------

  public inSession<T>(conversationId: string | undefined, fn: () => T, signal?: AbortSignal): T {
    return this.sessionStore.run({ conversationId, signal }, fn);
  }

  public forTab<T>(tabId: string | undefined, fn: () => T): T {
    const tracked = tabId ? this.tabs.get(tabId) : undefined;
    return this.inSession(tracked?.conversationId, fn);
  }

  private currentConversationId(): string | undefined {
    return this.sessionStore.getStore()?.conversationId;
  }

  private currentAbortSignal(): AbortSignal | undefined {
    return this.sessionStore.getStore()?.signal;
  }

  private convoKey(conversationId?: string): string {
    return conversationId || "__global__";
  }

  public assertTabOwnership(_tabId: string): void {
    // Shared browser profile across all workspaces; tab IDs remain unique per tab.
  }

  // ---------------------------------------------------------------------------
  // Control state (idle / running / paused)
  // ---------------------------------------------------------------------------

  public getControl(conversationId?: string): ControlState {
    const key = this.convoKey(conversationId ?? this.currentConversationId());
    const existing = this.controlByConversation.get(key);
    if (existing) return { ...existing };
    return {
      conversationId: conversationId ?? this.currentConversationId(),
      status: "idle",
      holder: "human",
      since: new Date().toISOString(),
      requested: false,
    };
  }

  private setControl(next: ControlState): ControlState {
    const key = this.convoKey(next.conversationId);
    const normalized: ControlState = { ...next };
    this.controlByConversation.set(key, normalized);
    try {
      this.callbacks.onStateChange?.({ ...normalized });
    } catch {
      // Never let UI listener errors break browser control.
    }
    return { ...normalized };
  }

  private markAgentRunning(tabId?: string, conversationId?: string): void {
    const convoId = conversationId ?? this.currentConversationId();
    const current = this.getControl(convoId);
    if (current.status === "running" && current.tabId === (tabId ?? current.tabId)) return;
    this.setControl({
      conversationId: convoId,
      tabId: tabId ?? current.tabId,
      status: "running",
      holder: "bot",
      since: new Date().toISOString(),
      requested: false,
    });
  }

  /**
   * Called when user clicks `Stop` in the minimalist bottom pill.
   * Immediately returns control to the user, unblocks any paused wait, and aborts the active agent run.
   */
  public takeControl(tabId?: string): ControlState {
    const convoId = (tabId ? this.tabs.get(tabId)?.conversationId : undefined) ?? this.currentConversationId();
    this.resolveHelpWaiters(convoId, {
      status: "cancelled",
      message: "User stopped browser automation and took manual control.",
    });
    const state = this.setControl({
      conversationId: convoId,
      tabId,
      status: "idle",
      holder: "human",
      since: new Date().toISOString(),
      requested: false,
    });
    try {
      this.callbacks.onStopAgent?.(convoId);
    } catch {
      // Best-effort abort notification.
    }
    return state;
  }

  /**
   * Called when user clicks `Continue` in the minimalist bottom pill after
   * completing login / password / CAPTCHA / 2FA directly on the page.
   */
  public releaseControl(tabId?: string): ControlState {
    const convoId = (tabId ? this.tabs.get(tabId)?.conversationId : undefined) ?? this.currentConversationId();
    const current = this.getControl(convoId);
    const wasPaused = current.status === "paused" || current.requested;
    const activeTab = (tabId ? this.tabs.get(tabId) : undefined) ?? this.getActiveTabForConversation(convoId);
    const urlNote = activeTab?.url ? ` Current URL: ${activeTab.url}` : "";

    const next = this.setControl({
      conversationId: convoId,
      tabId: tabId ?? current.tabId,
      status: wasPaused ? "running" : "idle",
      holder: wasPaused ? "bot" : "human",
      since: new Date().toISOString(),
      requested: false,
      reason: undefined,
    });

    this.resolveHelpWaiters(convoId, {
      status: "resolved",
      message: `User completed manual action and clicked Continue.${urlNote}`,
    });

    return next;
  }

  /**
   * Called by main.ts when an agent turn finishes or aborts so the floating
   * bottom pill automatically disappears.
   */
  public notifyAgentRunEnded(conversationId?: string): void {
    const current = this.getControl(conversationId);
    this.resolveHelpWaiters(conversationId, {
      status: "cancelled",
      message: "Agent run ended.",
    });
    if (current.status !== "idle" || current.requested) {
      this.setControl({
        conversationId,
        tabId: current.tabId,
        status: "idle",
        holder: "human",
        since: new Date().toISOString(),
        requested: false,
      });
    }
  }

  public requestHelp(reason: string, tabId?: string): ControlState {
    const convoId = this.currentConversationId();
    const safeReason =
      typeof reason === "string" && reason.trim()
        ? reason.trim().slice(0, 300)
        : "Waiting for you to complete this step, then click Continue.";
    return this.setControl({
      conversationId: convoId,
      tabId: tabId ?? this.getActiveTabForConversation(convoId)?.tabId,
      status: "paused",
      holder: "human",
      since: new Date().toISOString(),
      requested: true,
      requestedAt: new Date().toISOString(),
      reason: safeReason,
    });
  }

  private resolveHelpWaiters(
    conversationId: string | undefined,
    result: { status: "resolved" | "cancelled" | "timeout"; message: string },
  ): void {
    const remaining: HelpWaiter[] = [];
    const matched: HelpWaiter[] = [];
    for (const waiter of this.helpWaiters) {
      if (!conversationId || waiter.conversationId === conversationId) {
        matched.push(waiter);
      } else {
        remaining.push(waiter);
      }
    }
    this.helpWaiters = remaining;
    for (const waiter of matched) {
      try {
        waiter.resolve(result);
      } catch {
        // Ignore resolver errors.
      }
    }
  }

  public waitForHumanHelpResolution(
    timeoutMs = HELP_TIMEOUT_MS,
  ): Promise<{ status: "resolved" | "cancelled" | "timeout"; message: string }> {
    const convoId = this.currentConversationId();
    const signal = this.currentAbortSignal();

    return new Promise((resolve) => {
      let settled = false;
      const waiter: HelpWaiter = {
        conversationId: convoId,
        resolve: (info) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          resolve(info);
        },
      };

      const onAbort = () => {
        this.helpWaiters = this.helpWaiters.filter((w) => w !== waiter);
        this.setControl({
          conversationId: convoId,
          status: "idle",
          holder: "human",
          since: new Date().toISOString(),
          requested: false,
        });
        waiter.resolve({ status: "cancelled", message: "Browser help request cancelled." });
      };

      const timer = setTimeout(() => {
        this.helpWaiters = this.helpWaiters.filter((w) => w !== waiter);
        waiter.resolve({
          status: "timeout",
          message: "Timed out waiting for human assistance. Click Continue when ready.",
        });
      }, timeoutMs);

      this.helpWaiters.push(waiter);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }

  // ---------------------------------------------------------------------------
  // Tab lifecycle & daemon synchronization
  // ---------------------------------------------------------------------------

  private async ensureBrowserLaunched(): Promise<void> {
    if (this.browserBootstrapped) return;
    try {
      const list = await this.daemon.send<{ tabs?: any[] }>("tab_list", {});
      if (Array.isArray(list?.tabs) && list.tabs.length > 0) {
        this.browserBootstrapped = true;
        return;
      }
    } catch {
      // Browser not launched yet; launch below.
    }
    await this.daemon.send("launch", { headless: true }, 35_000);
    await this.daemon
      .send("viewport", {
        width: DEFAULT_VIEWPORT.width,
        height: DEFAULT_VIEWPORT.height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      .catch(() => {});
    this.browserBootstrapped = true;
  }

  private async syncNavState(tab: TrackedTab): Promise<void> {
    try {
      const meta = await this.daemon.send<{ result?: string }>("evaluate", {
        script: `JSON.stringify({
          url: window.location.href || "",
          title: document.title || "",
          canGoBack: (window.navigation && typeof window.navigation.canGoBack === "boolean")
            ? window.navigation.canGoBack
            : window.history.length > 1,
          canGoForward: (window.navigation && typeof window.navigation.canGoForward === "boolean")
            ? window.navigation.canGoForward
            : false
        })`,
      });
      const raw = typeof meta?.result === "string" ? meta.result : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.url === "string" && parsed.url) tab.url = parsed.url;
        if (typeof parsed.title === "string") tab.title = parsed.title;
        if (typeof parsed.canGoBack === "boolean") tab.canGoBack = parsed.canGoBack;
        if (typeof parsed.canGoForward === "boolean") tab.canGoForward = parsed.canGoForward;
      }
    } catch {
      // Keep last known metadata if page is mid-navigation or blank.
    }
  }

  private getActiveTabForConversation(conversationId?: string): TrackedTab | undefined {
    const convoId = conversationId ?? this.currentConversationId();
    if (convoId) {
      const preferredId = this.activeTabByConversation.get(convoId);
      if (preferredId && this.tabs.has(preferredId)) {
        return this.tabs.get(preferredId);
      }
      for (const tab of this.tabs.values()) {
        if (tab.conversationId === convoId) return tab;
      }
    }
    if (this.activeDaemonTabId && this.tabs.has(this.activeDaemonTabId)) {
      return this.tabs.get(this.activeDaemonTabId);
    }
    return this.tabs.values().next().value;
  }

  /**
   * Ensure a Harness tab exists in the shared `agent-browser` daemon and is the
   * currently active/streamed tab.
   */
  public async openOrActivateTab(
    tabId: string,
    options: {
      url?: string;
      conversationId?: string;
      viewport?: { width: number; height: number; mobile?: boolean };
      navigateIfDifferent?: boolean;
    } = {},
  ): Promise<BrowserTabSessionInfo> {
    await this.ensureBrowserLaunched();

    const conversationId = options.conversationId ?? this.currentConversationId();
    const existing = this.tabs.get(tabId);
    const label = existing?.label ?? sanitizeTabLabel(tabId);

    const requestedUrl = options.url ? normalizeBrowserUrl(options.url) : undefined;
    if (requestedUrl) this.assertNavigationAllowed(requestedUrl);

    if (!existing) {
      const initialUrl = requestedUrl || DEFAULT_HOME_URL;
      const hadNoTrackedTabs = this.tabs.size === 0;
      let previousBlankTabId: string | undefined;

      if (hadNoTrackedTabs) {
        const list = await this.daemon.send<{ tabs?: Array<{ tabId?: string; url?: string; label?: string }> }>(
          "tab_list",
          {},
        ).catch(() => ({ tabs: [] }));
        const firstTab = list?.tabs?.[0];
        if (firstTab?.tabId && !firstTab.label && (!firstTab.url || firstTab.url === "about:blank")) {
          previousBlankTabId = firstTab.tabId;
        }
      }

      try {
        await this.daemon.send("tab_new", { url: initialUrl, label }, 30_000);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (msg.includes("already used")) {
          await this.daemon.send("tab_switch", { tabId: label });
          if (requestedUrl) {
            await this.daemon.send("navigate", { url: requestedUrl }, 30_000);
          }
        } else {
          throw err;
        }
      }

      if (previousBlankTabId) {
        await this.daemon.send("tab_close", { tabId: previousBlankTabId }).catch(() => {});
        await this.daemon.send("tab_switch", { tabId: label }).catch(() => {});
      }

      const now = Date.now();
      const created: TrackedTab = {
        tabId,
        label,
        conversationId,
        url: initialUrl,
        title: initialUrl,
        canGoBack: false,
        canGoForward: false,
        zoomFactor: 1,
        viewport: options.viewport || { ...DEFAULT_VIEWPORT },
        registeredAt: now,
        lastUsedAt: now,
      };
      this.tabs.set(tabId, created);
      this.activeDaemonTabId = tabId;
      if (conversationId) this.activeTabByConversation.set(conversationId, tabId);

      if (options.viewport) {
        await this.applyViewport(created, options.viewport.width, options.viewport.height, options.viewport.mobile);
      }
      await this.syncNavState(created);
      return this.toSessionInfo(created);
    }

    // Existing tab: switch daemon to this tab's label if not already active.
    if (conversationId && !existing.conversationId) {
      existing.conversationId = conversationId;
    }
    await this.switchToTrackedTab(existing);

    if (requestedUrl && options.navigateIfDifferent && existing.url !== requestedUrl) {
      await this.daemon.send("navigate", { url: requestedUrl }, 30_000);
      existing.url = requestedUrl;
    }

    if (
      options.viewport &&
      (existing.viewport.width !== options.viewport.width ||
        existing.viewport.height !== options.viewport.height ||
        Boolean(existing.viewport.mobile) !== Boolean(options.viewport.mobile))
    ) {
      await this.applyViewport(existing, options.viewport.width, options.viewport.height, options.viewport.mobile);
    }

    existing.lastUsedAt = Date.now();
    if (conversationId) this.activeTabByConversation.set(conversationId, tabId);
    await this.syncNavState(existing);
    return this.toSessionInfo(existing);
  }

  private async switchToTrackedTab(tab: TrackedTab): Promise<void> {
    await this.ensureBrowserLaunched();
    if (this.activeDaemonTabId === tab.tabId) return;
    try {
      await this.daemon.send("tab_switch", { tabId: tab.label });
      this.activeDaemonTabId = tab.tabId;
    } catch (err: any) {
      const msg = String(err?.message || "");
      // Tab may have been closed externally or daemon restarted; recreate cleanly.
      if (msg.includes("not found") || msg.includes("Unknown") || msg.includes("Browser not launched")) {
        this.browserBootstrapped = false;
        await this.ensureBrowserLaunched();
        await this.daemon.send("tab_new", { url: tab.url || DEFAULT_HOME_URL, label: tab.label }, 30_000);
        this.activeDaemonTabId = tab.tabId;
      } else {
        throw err;
      }
    }
  }

  private async applyViewport(
    tab: TrackedTab,
    width: number,
    height: number,
    mobile = false,
  ): Promise<void> {
    const safeW = Math.max(320, Math.min(2560, Math.round(width)));
    const safeH = Math.max(240, Math.min(2160, Math.round(height)));
    tab.viewport = { width: safeW, height: safeH, mobile };
    await this.daemon
      .send("viewport", {
        width: safeW,
        height: safeH,
        deviceScaleFactor: 1,
        mobile: Boolean(mobile),
      })
      .catch(() => {});
  }

  private toSessionInfo(tab: TrackedTab): BrowserTabSessionInfo {
    const stream = this.getStreamInfo();
    return {
      tabId: tab.tabId,
      label: tab.label,
      url: tab.url,
      title: tab.title,
      streamUrl: stream.streamUrl,
      streamPort: stream.streamPort,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      viewport: { width: tab.viewport.width, height: tab.viewport.height },
      control: this.getControl(tab.conversationId ?? this.currentConversationId()),
    };
  }

  public async closeTab(tabId: string): Promise<boolean> {
    const tracked = this.tabs.get(tabId);
    if (!tracked) return false;
    this.tabs.delete(tabId);
    if (this.activeDaemonTabId === tabId) this.activeDaemonTabId = null;
    for (const [convoId, activeId] of this.activeTabByConversation.entries()) {
      if (activeId === tabId) this.activeTabByConversation.delete(convoId);
    }
    try {
      await this.daemon.send("tab_close", { tabId: tracked.label });
    } catch {
      // Ignore if already closed or last tab in Chromium.
    }
    return true;
  }

  // Legacy-compatible registration shims (no-op for webContentsId since we use agent-browser)
  public registerWebview(tabId: string, _guestContentsId?: number): void {
    const conversationId = this.currentConversationId();
    if (!this.tabs.has(tabId)) {
      const now = Date.now();
      this.tabs.set(tabId, {
        tabId,
        label: sanitizeTabLabel(tabId),
        conversationId,
        url: DEFAULT_HOME_URL,
        title: "Browser",
        canGoBack: false,
        canGoForward: false,
        zoomFactor: 1,
        viewport: { ...DEFAULT_VIEWPORT },
        registeredAt: now,
        lastUsedAt: now,
      });
    }
    if (conversationId) this.activeTabByConversation.set(conversationId, tabId);
  }

  public unregisterWebview(tabId: string, _guestContentsId?: number): void {
    void this.closeTab(tabId);
  }

  public setActiveTab(tabId: string): void {
    const conversationId = this.currentConversationId();
    if (conversationId) this.activeTabByConversation.set(conversationId, tabId);
    const tracked = this.tabs.get(tabId);
    if (tracked) {
      tracked.lastUsedAt = Date.now();
      void this.switchToTrackedTab(tracked).catch(() => {});
    }
  }

  public listTabs(conversationId?: string): BrowserTabSummary[] {
    const convoId = conversationId ?? this.currentConversationId();
    const activeId = convoId ? this.activeTabByConversation.get(convoId) : this.activeDaemonTabId;
    const items: BrowserTabSummary[] = [];
    for (const tab of this.tabs.values()) {
      if (convoId && tab.conversationId && tab.conversationId !== convoId) continue;
      items.push({
        tabId: tab.tabId,
        label: tab.label,
        url: tab.url,
        title: tab.title,
        conversationId: tab.conversationId,
        isActive: tab.tabId === activeId,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
        registeredAt: tab.registeredAt,
        lastUsedAt: tab.lastUsedAt,
      });
    }
    return items;
  }

  private async ensureTargetTab(options?: {
    tabId?: string;
    url?: string;
    newTab?: boolean;
  }): Promise<TrackedTab> {
    const convoId = this.currentConversationId();
    if (options?.newTab) {
      const newTabId = options.tabId || `browser_${crypto.randomUUID()}`;
      const url = options.url ? normalizeBrowserUrl(options.url) : DEFAULT_HOME_URL;
      await this.openOrActivateTab(newTabId, { url, conversationId: convoId });
      this.callbacks.onOpenTabRequest?.({ url, tabId: newTabId, newTab: true, conversationId: convoId });
      this.callbacks.onStateChange?.(this.getControl(convoId));
      return this.tabs.get(newTabId)!;
    }

    const existing =
      (options?.tabId ? this.tabs.get(options.tabId) : undefined) || this.getActiveTabForConversation(convoId);
    if (existing) {
      await this.switchToTrackedTab(existing);
      return existing;
    }

    const newTabId = options?.tabId || `browser_${crypto.randomUUID()}`;
    const url = options?.url ? normalizeBrowserUrl(options.url) : DEFAULT_HOME_URL;
    await this.openOrActivateTab(newTabId, { url, conversationId: convoId });
    this.callbacks.onOpenTabRequest?.({ url, tabId: newTabId, newTab: false, conversationId: convoId });
    this.callbacks.onStateChange?.(this.getControl(convoId));
    return this.tabs.get(newTabId)!;
  }

  private emitAiAction(type: string, detail?: string, tabId?: string): void {
    try {
      this.callbacks.onAiAction?.({
        type,
        detail,
        tabId,
        conversationId: this.currentConversationId(),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore listener errors.
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation & Viewport UI Actions
  // ---------------------------------------------------------------------------

  public async navigate(
    url: string,
    options?: { tabId?: string; newTab?: boolean; waitUntil?: string },
  ): Promise<{ tabId: string; url: string; title: string; canGoBack: boolean; canGoForward: boolean }> {
    const normalized = normalizeBrowserUrl(url);
    this.assertNavigationAllowed(normalized);

    const tab = await this.ensureTargetTab({
      tabId: options?.tabId,
      url: normalized,
      newTab: options?.newTab,
    });

    const res = await this.daemon.send<{ url?: string; title?: string }>(
      "navigate",
      { url: normalized, ...(options?.waitUntil ? { waitUntil: options.waitUntil } : {}) },
      35_000,
    );
    tab.url = res?.url || normalized;
    if (res?.title) tab.title = res.title;
    tab.lastUsedAt = Date.now();
    await this.syncNavState(tab);

    // Notify renderer so the URL bar & tab title stay in sync when the agent navigates.
    this.callbacks.onOpenTabRequest?.({
      url: tab.url,
      tabId: tab.tabId,
      newTab: false,
      conversationId: tab.conversationId ?? this.currentConversationId(),
    });

    return {
      tabId: tab.tabId,
      url: tab.url,
      title: tab.title,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
    };
  }

  public async goBack(tabId?: string): Promise<{ url: string; title: string; canGoBack: boolean; canGoForward: boolean }> {
    const tab = await this.ensureTargetTab({ tabId });
    await this.daemon.send("back", {});
    await this.syncNavState(tab);
    return { url: tab.url, title: tab.title, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward };
  }

  public async goForward(tabId?: string): Promise<{ url: string; title: string; canGoBack: boolean; canGoForward: boolean }> {
    const tab = await this.ensureTargetTab({ tabId });
    await this.daemon.send("forward", {});
    await this.syncNavState(tab);
    return { url: tab.url, title: tab.title, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward };
  }

  public async reload(
    tabId?: string,
    ignoreCache = false,
  ): Promise<{ url: string; title: string; canGoBack: boolean; canGoForward: boolean }> {
    const tab = await this.ensureTargetTab({ tabId });
    if (ignoreCache) {
      await this.daemon.send("evaluate", { script: "window.location.reload()" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 400));
    } else {
      await this.daemon.send("reload", {});
    }
    await this.syncNavState(tab);
    return { url: tab.url, title: tab.title, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward };
  }

  public async setViewport(
    tabId: string | undefined,
    width: number,
    height: number,
    mobile = false,
  ): Promise<{ width: number; height: number }> {
    const tab = await this.ensureTargetTab({ tabId });
    await this.applyViewport(tab, width, height, mobile);
    return { width: tab.viewport.width, height: tab.viewport.height };
  }

  public async setZoom(tabId: string | undefined, factor: number): Promise<{ zoomFactor: number }> {
    const tab = await this.ensureTargetTab({ tabId });
    const clamped = Math.max(0.5, Math.min(2.0, Number(factor) || 1));
    tab.zoomFactor = clamped;
    await this.daemon
      .send("evaluate", { script: `document.documentElement.style.zoom = ${JSON.stringify(String(clamped))};` })
      .catch(() => {});
    return { zoomFactor: clamped };
  }

  /**
   * Inspect the DOM element at viewport coordinates (x, y) for the "Select Page"
   * picker overlay rendered cleanly over the canvas stream.
   */
  public async inspectPoint(
    tabId: string | undefined,
    x: number,
    y: number,
  ): Promise<BrowserSelectedElementPayload | null> {
    const tab = await this.ensureTargetTab({ tabId });
    const safeX = Number.isFinite(x) ? x : 0;
    const safeY = Number.isFinite(y) ? y : 0;
    const script = `(function() {
      const el = document.elementFromPoint(${safeX}, ${safeY});
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      function rgbToHex(rgb) {
        if (!rgb) return '#000000';
        if (rgb.startsWith('#')) return rgb;
        const m = rgb.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
        if (!m) return rgb;
        return '#' + [m[1], m[2], m[3]].map(v => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
      }
      function getSelector(node) {
        if (!node || node === document.body) return 'body';
        if (node.id) return '#' + node.id;
        let part = node.tagName.toLowerCase();
        if (node.className && typeof node.className === 'string') {
          const cls = node.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2);
          if (cls.length) part += '.' + cls.join('.');
        }
        if (node.parentElement && node.parentElement !== document.body) {
          const parent = getSelector(node.parentElement);
          if (parent && !parent.includes('>')) part = parent + ' > ' + part;
        }
        return part;
      }
      return JSON.stringify({
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className : '',
        selector: getSelector(el),
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        color: rgbToHex(style.color),
        font: Math.round(parseFloat(style.fontSize) || 12) + 'px ' + (style.fontFamily.split(',')[0].replace(/['"]/g, '') || 'sans-serif'),
        textSnippet: (el.innerText || '').slice(0, 120).trim(),
        htmlSnippet: el.outerHTML ? el.outerHTML.slice(0, 300) : '',
        url: window.location.href,
      });
    })()`;

    const res = await this.daemon.send<{ result?: string | null }>("evaluate", { script });
    if (!res?.result || typeof res.result !== "string") return null;
    try {
      return JSON.parse(res.result) as BrowserSelectedElementPayload;
    } catch {
      return null;
    }
  }

  /**
   * Capture current tab screenshot as PNG, write directly to OS clipboard via Electron,
   * and return base64 + dataUrl so BrowserTab can attach it straight into the chat input.
   */
  public async captureToClipboardAndChat(tabId?: string): Promise<{
    dataUrl: string;
    base64: string;
    mimeType: "image/png";
    filename: string;
    url: string;
    title: string;
    copiedToClipboard: boolean;
  }> {
    const shot = await this.screenshot({ tabId, format: "png", ephemeral: true, annotate: false });
    let copiedToClipboard = false;
    try {
      const electronMod = requireFromHere("electron");
      if (electronMod && typeof electronMod === "object" && electronMod.nativeImage && electronMod.clipboard) {
        const buffer = Buffer.from(shot.base64, "base64");
        const img = electronMod.nativeImage.createFromBuffer(buffer);
        if (!img.isEmpty() && typeof electronMod.clipboard.writeImage === "function") {
          electronMod.clipboard.writeImage(img);
          copiedToClipboard = true;
        }
      }
    } catch {
      copiedToClipboard = false;
    }

    const hostSlug = (() => {
      try {
        return new URL(shot.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
      } catch {
        return "browser";
      }
    })();

    return {
      dataUrl: shot.dataUrl,
      base64: shot.base64,
      mimeType: "image/png",
      filename: `screenshot-${hostSlug}-${Date.now()}.png`,
      url: shot.url,
      title: shot.title,
      copiedToClipboard,
    };
  }

  public async resetSession(): Promise<{ ok: boolean }> {
    this.tabs.clear();
    this.activeDaemonTabId = null;
    this.activeTabByConversation.clear();
    this.browserBootstrapped = false;
    await this.daemon.resetProfile();
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Core Automation Primitives (backing all browser_* tools & IPC)
  // ---------------------------------------------------------------------------

  public async snapshot(options?: {
    tabId?: string;
    interactive?: boolean;
    compact?: boolean;
    maxDepth?: number;
    selector?: string;
    includeText?: boolean;
  }): Promise<{
    tabId: string;
    url: string;
    title: string;
    snapshot: string;
    refs: Record<string, unknown>;
    readableText?: string;
  }> {
    const tab = await this.ensureTargetTab({ tabId: options?.tabId });
    const data = await this.daemon.send<{
      snapshot?: string;
      refs?: Record<string, unknown>;
      origin?: string;
    }>("snapshot", {
      interactive: options?.interactive ?? true,
      compact: options?.compact ?? true,
      ...(typeof options?.maxDepth === "number" ? { maxDepth: options.maxDepth } : {}),
      ...(options?.selector ? { selector: options.selector } : {}),
    });

    await this.syncNavState(tab);

    let readableText: string | undefined;
    if (options?.includeText) {
      const textRes = await this.daemon
        .send<{ result?: string }>("evaluate", {
          script: "(document.body && document.body.innerText ? document.body.innerText : '').slice(0, 8000)",
        })
        .catch(() => ({ result: "" }));
      if (typeof textRes?.result === "string") readableText = textRes.result;
    }

    return {
      tabId: tab.tabId,
      url: data?.origin || tab.url,
      title: tab.title,
      snapshot: data?.snapshot || "",
      refs: data?.refs || {},
      ...(readableText !== undefined ? { readableText } : {}),
    };
  }

  public async click(args: {
    tabId?: string;
    ref?: string;
    selector?: string;
    x?: number;
    y?: number;
    button?: "left" | "right" | "middle";
    doubleClick?: boolean;
    clickCount?: number;
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const target = normalizeRefSelector(args?.ref, args?.selector);

    if (target) {
      const action = args.doubleClick || args.clickCount === 2 ? "dblclick" : "click";
      const res = await this.daemon.send(action, {
        selector: target,
        ...(args.button ? { button: args.button } : {}),
      });
      await this.syncNavState(tab);
      return { clicked: target, url: tab.url, title: tab.title, ...(res || {}) };
    }

    if (typeof args?.x === "number" && typeof args?.y === "number") {
      const button = args.button || "left";
      const clickCount = args.doubleClick ? 2 : args.clickCount || 1;
      await this.daemon.send("mouse", { eventType: "mouseMoved", x: args.x, y: args.y, button: "none", clickCount: 0 });
      await this.daemon.send("mouse", { eventType: "mousePressed", x: args.x, y: args.y, button, clickCount });
      await this.daemon.send("mouse", { eventType: "mouseReleased", x: args.x, y: args.y, button, clickCount });
      await this.syncNavState(tab);
      return { clicked: { x: args.x, y: args.y }, url: tab.url, title: tab.title };
    }

    throw new Error("browser_click requires 'ref', 'selector', or numeric 'x'/'y' coordinates.");
  }

  public async type(args: {
    tabId?: string;
    ref?: string;
    selector?: string;
    text: string;
    clear?: boolean;
    replace?: boolean;
    pressEnter?: boolean;
    submit?: boolean;
    delay?: number;
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const text = String(args?.text ?? "");
    const target = normalizeRefSelector(args?.ref, args?.selector);
    const shouldClear = Boolean(args?.clear ?? args?.replace);

    if (target) {
      if (shouldClear && !args.delay) {
        await this.daemon.send("fill", { selector: target, value: text });
      } else {
        await this.daemon.send("type", {
          selector: target,
          text,
          clear: shouldClear,
          ...(typeof args.delay === "number" ? { delay: args.delay } : {}),
        });
      }
    } else {
      await this.daemon.send("keyboard", { subaction: "type", text });
    }

    if (args?.pressEnter || args?.submit) {
      await this.daemon.send("press", { key: "Enter" });
    }

    await this.syncNavState(tab);
    return { typed: true, characters: text.length, url: tab.url, title: tab.title };
  }

  public async paste(args: {
    tabId?: string;
    ref?: string;
    selector?: string;
    text: string;
    clear?: boolean;
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const target = normalizeRefSelector(args?.ref, args?.selector);
    const text = String(args?.text ?? "");

    if (target) {
      if (args.clear) {
        await this.daemon.send("fill", { selector: target, value: text });
      } else {
        await this.daemon.send("focus", { selector: target });
        await this.daemon.send("keyboard", { subaction: "insertText", text });
      }
    } else {
      await this.daemon.send("keyboard", { subaction: "insertText", text });
    }

    await this.syncNavState(tab);
    return { pasted: true, characters: text.length, url: tab.url };
  }

  public async key(args: {
    tabId?: string;
    key: string;
    modifiers?: string[];
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const chord = normalizeKeyChord(args?.key, args?.modifiers);
    const res = await this.daemon.send("press", { key: chord });
    await this.syncNavState(tab);
    return { pressed: chord, url: tab.url, ...(res || {}) };
  }

  public async scroll(args: {
    tabId?: string;
    direction?: "up" | "down" | "left" | "right";
    amount?: number;
    deltaX?: number;
    deltaY?: number;
    selector?: string;
    ref?: string;
    to?: "top" | "bottom";
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    if (args?.to === "top") {
      await this.daemon.send("evaluate", { script: "window.scrollTo(0, 0)" });
      return { scrolled: "top", url: tab.url };
    }
    if (args?.to === "bottom") {
      await this.daemon.send("evaluate", { script: "window.scrollTo(0, document.body.scrollHeight)" });
      return { scrolled: "bottom", url: tab.url };
    }

    const target = normalizeRefSelector(args?.ref, args?.selector);
    const payload: Record<string, unknown> = {};
    if (target) payload.selector = target;
    if (args?.direction) {
      payload.direction = args.direction;
      payload.amount = typeof args.amount === "number" ? Math.abs(args.amount) : 420;
    } else {
      payload.x = typeof args?.deltaX === "number" ? args.deltaX : 0;
      payload.y = typeof args?.deltaY === "number" ? args.deltaY : 420;
    }
    await this.daemon.send("scroll", payload);
    return { scrolled: true, url: tab.url };
  }

  public async hover(args: {
    tabId?: string;
    ref?: string;
    selector?: string;
    x?: number;
    y?: number;
  }): Promise<Record<string, unknown>> {
    await this.ensureTargetTab({ tabId: args?.tabId });
    const target = normalizeRefSelector(args?.ref, args?.selector);
    if (target) {
      return await this.daemon.send("hover", { selector: target });
    }
    if (typeof args?.x === "number" && typeof args?.y === "number") {
      await this.daemon.send("mouse", { eventType: "mouseMoved", x: args.x, y: args.y, button: "none", clickCount: 0 });
      return { hovered: { x: args.x, y: args.y } };
    }
    throw new Error("browser_hover requires 'ref', 'selector', or 'x'/'y'.");
  }

  public async screenshot(args?: {
    tabId?: string;
    fullPage?: boolean;
    annotate?: boolean;
    format?: "png" | "jpeg";
    quality?: number;
    ephemeral?: boolean;
    selector?: string;
    ref?: string;
  }): Promise<{
    dataUrl: string;
    base64: string;
    mimeType: string;
    path?: string;
    url: string;
    title: string;
    annotations?: unknown[];
  }> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const format = args?.format === "jpeg" ? "jpeg" : "png";
    const ext = format === "jpeg" ? "jpg" : "png";
    const filePath = args?.ephemeral
      ? path.join(os.tmpdir(), `const-shot-${crypto.randomUUID()}.${ext}`)
      : path.join(formatScreenshotDir(), `shot-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${ext}`);

    const target = normalizeRefSelector(args?.ref, args?.selector);
    const res = await this.daemon.send<{ path?: string; annotations?: unknown[] }>(
      "screenshot",
      {
        path: filePath,
        fullPage: Boolean(args?.fullPage),
        annotate: Boolean(args?.annotate),
        ...(format === "jpeg" ? { format: "jpeg", quality: args?.quality ?? 75 } : {}),
        ...(target ? { selector: target } : {}),
      },
      30_000,
    );

    const savedPath = res?.path || filePath;
    const buffer = fs.readFileSync(savedPath);
    const base64 = buffer.toString("base64");
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";

    if (args?.ephemeral) {
      try {
        fs.rmSync(savedPath, { force: true });
      } catch {
        // Ignore temp cleanup failures.
      }
    }

    await this.syncNavState(tab);
    return {
      dataUrl: `data:${mimeType};base64,${base64}`,
      base64,
      mimeType,
      ...(args?.ephemeral ? {} : { path: savedPath }),
      url: tab.url,
      title: tab.title,
      ...(res?.annotations ? { annotations: res.annotations } : {}),
    };
  }

  public async readConsoleAndNetwork(args?: {
    tabId?: string;
    clear?: boolean;
  }): Promise<{ console: unknown; errors: unknown }> {
    await this.ensureTargetTab({ tabId: args?.tabId });
    const clear = Boolean(args?.clear);
    const consoleData = await this.daemon.send("console", { clear }).catch(() => ({ messages: [] }));
    const errorData = await this.daemon.send("errors", { clear }).catch(() => ({ errors: [] }));
    return { console: consoleData, errors: errorData };
  }

  public async evaluate(args: { tabId?: string; script?: string; expression?: string }): Promise<unknown> {
    await this.ensureTargetTab({ tabId: args?.tabId });
    const script = String(args?.script ?? args?.expression ?? "").trim();
    if (!script) throw new Error("browser_evaluate requires a non-empty 'script' or 'expression'.");
    return await this.daemon.send("evaluate", { script });
  }

  public async waitFor(args: {
    tabId?: string;
    text?: string;
    selector?: string;
    ref?: string;
    ms?: number;
    timeoutMs?: number;
    url?: string;
    state?: string;
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const timeout = Math.min(30_000, Math.max(250, Number(args?.timeoutMs) || 10_000));

    if (typeof args?.ms === "number" && !args.text && !args.selector && !args.ref && !args.url) {
      const waitMs = Math.min(15_000, Math.max(0, args.ms));
      await new Promise((r) => setTimeout(r, waitMs));
      await this.syncNavState(tab);
      return { waitedMs: waitMs, url: tab.url };
    }

    const target = normalizeRefSelector(args?.ref, args?.selector);
    const payload: Record<string, unknown> = { timeout };
    if (args?.text) payload.text = args.text;
    if (target) payload.selector = target;
    if (args?.state) payload.state = args.state;
    if (args?.url) payload.url = args.url;

    const res = await this.daemon.send("wait", payload, timeout + 5_000);
    await this.syncNavState(tab);
    return { ...(res || {}), url: tab.url, title: tab.title };
  }

  public async verifyText(args: {
    tabId?: string;
    text: string;
    exact?: boolean;
  }): Promise<{ found: boolean; url: string; excerpt?: string }> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const needle = String(args?.text ?? "");
    const script = `(function() {
      const body = (document.body && document.body.innerText) || '';
      const needle = ${JSON.stringify(needle)};
      const exact = ${Boolean(args?.exact)};
      const found = exact ? body.includes(needle) : body.toLowerCase().includes(needle.toLowerCase());
      const idx = exact ? body.indexOf(needle) : body.toLowerCase().indexOf(needle.toLowerCase());
      const excerpt = idx >= 0 ? body.slice(Math.max(0, idx - 80), idx + needle.length + 80) : '';
      return JSON.stringify({ found, excerpt });
    })()`;
    const res = await this.daemon.send<{ result?: string }>("evaluate", { script });
    const parsed = typeof res?.result === "string" ? JSON.parse(res.result) : { found: false };
    return { found: Boolean(parsed.found), url: tab.url, ...(parsed.excerpt ? { excerpt: parsed.excerpt } : {}) };
  }

  public async find(args: {
    tabId?: string;
    query?: string;
    text?: string;
    role?: string;
    limit?: number;
  }): Promise<{ matches: unknown[]; url: string }> {
    const tab = await this.ensureTargetTab({ tabId: args?.tabId });
    const query = String(args?.query ?? args?.text ?? "").trim();
    const role = String(args?.role ?? "").trim();
    const limit = Math.min(30, Math.max(1, Number(args?.limit) || 12));
    const script = `(function() {
      const q = ${JSON.stringify(query.toLowerCase())};
      const role = ${JSON.stringify(role.toLowerCase())};
      const all = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role],h1,h2,h3,h4,p,li,span,div'));
      const out = [];
      for (const el of all) {
        if (out.length >= ${limit}) break;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const elRole = (el.getAttribute('role') || el.tagName.toLowerCase()).toLowerCase();
        if (role && !elRole.includes(role)) continue;
        const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
        if (q && !text.toLowerCase().includes(q)) continue;
        if (!text && !role) continue;
        out.push({
          tag: el.tagName.toLowerCase(),
          role: elRole,
          text: text.slice(0, 140),
          id: el.id || undefined,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        });
      }
      return JSON.stringify(out);
    })()`;
    const res = await this.daemon.send<{ result?: string }>("evaluate", { script });
    const matches = typeof res?.result === "string" ? JSON.parse(res.result) : [];
    return { matches, url: tab.url };
  }

  public async remoteInput(input: {
    tabId?: string;
    action: string;
    url?: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    deltaY?: number;
    deltaX?: number;
    factor?: number;
    script?: string;
    width?: number;
    height?: number;
    mobile?: boolean;
  }): Promise<Record<string, unknown>> {
    const tab = await this.ensureTargetTab({ tabId: input?.tabId });
    switch (input?.action) {
      case "navigate":
        return await this.navigate(String(input.url || DEFAULT_HOME_URL), { tabId: tab.tabId });
      case "back":
        return await this.goBack(tab.tabId);
      case "forward":
        return await this.goForward(tab.tabId);
      case "reload":
        return await this.reload(tab.tabId);
      case "zoom":
        return await this.setZoom(tab.tabId, Number(input.factor) || 1);
      case "viewport":
        return await this.setViewport(tab.tabId, Number(input.width) || 1280, Number(input.height) || 800, Boolean(input.mobile));
      case "click": {
        const px = typeof input.x === "number" && input.x <= 1 ? input.x * tab.viewport.width : Number(input.x) || 0;
        const py = typeof input.y === "number" && input.y <= 1 ? input.y * tab.viewport.height : Number(input.y) || 0;
        return await this.click({ tabId: tab.tabId, x: px, y: py });
      }
      case "text":
        return await this.paste({ tabId: tab.tabId, text: String(input.text || "") });
      case "key":
        return await this.key({ tabId: tab.tabId, key: String(input.key || "Enter") });
      case "scroll":
        return await this.scroll({
          tabId: tab.tabId,
          deltaX: Number(input.deltaX) || 0,
          deltaY: -(Number(input.deltaY) || 0),
        });
      case "evaluate":
        return { result: await this.evaluate({ tabId: tab.tabId, script: input.script }) };
      default:
        return { ok: true, url: tab.url, title: tab.title, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward };
    }
  }

  // ---------------------------------------------------------------------------
  // Agent Tool Dispatcher (called by PiHarnessAgent / ConstAgent)
  // ---------------------------------------------------------------------------

  public async executeTool(
    toolName: string,
    args: Record<string, any> = {},
    context?: { sessionId?: string; signal?: AbortSignal },
  ): Promise<{ result: string; isError: boolean }> {
    return await this.inSession(
      context?.sessionId,
      async () => {
        try {
          const tabId = typeof args.tabId === "string" ? args.tabId : undefined;
          const norm = String(toolName || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

          if (norm === "browserrequesthelp") {
            const reason = String(
              args.reason ||
                args.message ||
                (args.secretWanted
                  ? `Please enter ${args.secretWanted} directly on the page, then click Continue.`
                  : "Please complete this step, then click Continue."),
            );
            this.emitAiAction("request_help", reason, tabId);
            this.requestHelp(reason, tabId);
            const outcome = await this.waitForHumanHelpResolution(
              typeof args.timeoutMs === "number" ? args.timeoutMs : HELP_TIMEOUT_MS,
            );
            return {
              result: outcome.message,
              isError: outcome.status === "timeout",
            };
          }

          // Transition floating pill to active running indicator for any agent browser tool.
          this.markAgentRunning(tabId, context?.sessionId);
          this.emitAiAction(toolName, typeof args.url === "string" ? args.url : undefined, tabId);

          if (norm === "browsernavigate") {
            const url = String(args.url || "").trim();
            if (!url) return { result: "browser_navigate requires 'url'.", isError: true };
            if (url === "back") {
              const res = await this.goBack(tabId);
              return { result: JSON.stringify(res, null, 2), isError: false };
            }
            if (url === "forward") {
              const res = await this.goForward(tabId);
              return { result: JSON.stringify(res, null, 2), isError: false };
            }
            if (url === "reload") {
              const res = await this.reload(tabId);
              return { result: JSON.stringify(res, null, 2), isError: false };
            }
            const res = await this.navigate(url, {
              tabId,
              newTab: Boolean(args.newTab),
              waitUntil: typeof args.waitUntil === "string" ? args.waitUntil : undefined,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browsersnapshot") {
            const res = await this.snapshot({
              tabId,
              interactive: args.interactive !== false,
              compact: args.compact !== false,
              maxDepth: typeof args.maxDepth === "number" ? args.maxDepth : typeof args.depth === "number" ? args.depth : undefined,
              selector: typeof args.selector === "string" ? args.selector : undefined,
              includeText: Boolean(args.includeText ?? args.readableText),
            });
            const combinedSignal = `${res.title}\n${res.snapshot}\n${res.readableText || ""}`;
            const hasAntiBotGate =
              /datadome|captcha|access is temporarily restricted|verify you are human|just a moment\.\.\.|attention required!\s*\|\s*cloudflare/i.test(
                combinedSignal,
              );
            const lines = [
              `URL: ${res.url}`,
              `Title: ${res.title}`,
              `Tab: ${res.tabId}`,
              "",
              res.snapshot || "(empty snapshot)",
            ];
            if (res.readableText) {
              lines.push("", "--- Page Text ---", res.readableText);
            }
            if (hasAntiBotGate) {
              lines.push(
                "",
                "[Anti-bot / CAPTCHA detected: Do NOT loop on reload or web_fetch. Call browser_request_help immediately to pause and let the user handle verification or decide next steps.]",
              );
            }
            return { result: lines.join("\n"), isError: false };
          }

          if (norm === "browserclick") {
            const res = await this.click({
              tabId,
              ref: args.ref,
              selector: args.selector,
              x: typeof args.x === "number" ? args.x : undefined,
              y: typeof args.y === "number" ? args.y : undefined,
              button: args.button,
              doubleClick: Boolean(args.doubleClick),
              clickCount: typeof args.clickCount === "number" ? args.clickCount : undefined,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browsertype") {
            const res = await this.type({
              tabId,
              ref: args.ref,
              selector: args.selector,
              text: String(args.text ?? ""),
              clear: Boolean(args.clearFirst ?? args.clear ?? args.replace ?? true),
              pressEnter: Boolean(args.pressEnter ?? args.submit),
              delay: typeof args.delay === "number" ? args.delay : undefined,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserpaste") {
            const res = await this.paste({
              tabId,
              ref: args.ref,
              selector: args.selector,
              text: String(args.text ?? ""),
              clear: Boolean(args.clear),
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserkey" || norm === "browserpresskey") {
            const res = await this.key({
              tabId,
              key: String(args.key || "Enter"),
              modifiers: Array.isArray(args.modifiers) ? args.modifiers : undefined,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserscroll") {
            const res = await this.scroll({
              tabId,
              direction: args.direction,
              amount: typeof args.amount === "number" ? args.amount : undefined,
              deltaX: typeof args.deltaX === "number" ? args.deltaX : undefined,
              deltaY: typeof args.deltaY === "number" ? args.deltaY : undefined,
              selector: args.selector,
              ref: args.ref,
              to: args.to,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserhover") {
            const res = await this.hover({
              tabId,
              ref: args.ref,
              selector: args.selector,
              x: typeof args.x === "number" ? args.x : undefined,
              y: typeof args.y === "number" ? args.y : undefined,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserscreenshot") {
            const res = await this.screenshot({
              tabId,
              fullPage: Boolean(args.fullPage),
              annotate: args.annotate !== false,
              format: args.format === "jpeg" ? "jpeg" : "png",
              quality: typeof args.quality === "number" ? args.quality : undefined,
              ephemeral: Boolean(args.ephemeral),
              selector: args.selector,
              ref: args.ref,
            });
            const lines = [
              `### Browser Screenshot Captured`,
              `- **URL**: ${res.url}`,
              `- **Title**: ${res.title}`,
              `- **Format**: ${res.mimeType}`,
              res.path ? `- **Saved File**: \`${res.path}\`` : "",
              res.annotations?.length ? `- **Annotations**: ${res.annotations.length} interactive refs marked` : "",
            ].filter(Boolean);
            return { result: lines.join("\n"), isError: false };
          }

          if (norm === "browserconsole" || norm === "browserdiagnostics") {
            const res = await this.readConsoleAndNetwork({ tabId, clear: Boolean(args.clear) });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserevaluate" || norm === "browserrun" || norm === "browserbatch") {
            const res = await this.evaluate({ tabId, script: args.script ?? args.code ?? args.expression });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserwaitfor" || norm === "browserwait") {
            const res = await this.waitFor({
              tabId,
              text: args.text,
              selector: args.selector,
              ref: args.ref,
              ms: typeof args.ms === "number" ? args.ms : typeof args.timeMs === "number" ? args.timeMs : undefined,
              timeoutMs: typeof args.timeoutMs === "number" ? args.timeoutMs : undefined,
              url: args.url,
              state: args.state,
            });
            return { result: JSON.stringify(res, null, 2), isError: false };
          }

          if (norm === "browserverifytext" || norm === "browserverify") {
            const res = await this.verifyText({
              tabId,
              text: String(args.text ?? ""),
              exact: Boolean(args.exact ?? args.caseSensitive),
            });
            const expectAbsent = args.state === "absent";
            const matched = expectAbsent ? !res.found : res.found;
            const lines = [
              `### Browser Text Verification — ${matched ? "PASS" : "FAIL"}`,
              `- **URL**: ${res.url}`,
              `- **Text**: ${JSON.stringify(args.text)}`,
              `- **Expected**: ${expectAbsent ? "absent from page" : "visible on page"}`,
              res.excerpt ? `- **Excerpt**: ${res.excerpt}` : "",
            ].filter(Boolean);
            return { result: lines.join("\n"), isError: !matched };
          }

          if (norm === "browserfind" || norm === "browserfindtext") {
            const res = await this.find({
              tabId,
              query: args.query ?? args.text,
              role: args.role,
              limit: typeof args.limit === "number" ? args.limit : undefined,
            });
            return {
              result: JSON.stringify(res, null, 2),
              isError: res.matches.length === 0,
            };
          }

          if (norm === "browsertabs") {
            const action = String(args.action || "list").toLowerCase();
            if (action === "new" || action === "open") {
              const newTab = await this.ensureTargetTab({
                url: typeof args.url === "string" ? args.url : DEFAULT_HOME_URL,
                newTab: true,
              });
              return {
                result: JSON.stringify({ opened: newTab.tabId, url: newTab.url, tabs: this.listTabs() }, null, 2),
                isError: false,
              };
            }
            if (action === "switch" && typeof args.tabId === "string") {
              const target = this.tabs.get(args.tabId);
              if (!target) return { result: `Unknown browser tab '${args.tabId}'.`, isError: true };
              await this.switchToTrackedTab(target);
              this.setActiveTab(target.tabId);
              return {
                result: JSON.stringify({ activeTabId: target.tabId, url: target.url, title: target.title }, null, 2),
                isError: false,
              };
            }
            if (action === "close" && typeof args.tabId === "string") {
              const closed = await this.closeTab(args.tabId);
              return { result: JSON.stringify({ closed, tabs: this.listTabs() }, null, 2), isError: false };
            }
            return { result: JSON.stringify({ tabs: this.listTabs() }, null, 2), isError: false };
          }

          return { result: `Unknown browser tool: '${toolName}'`, isError: true };
        } catch (err: any) {
          return {
            result: `Browser tool error (${toolName}): ${err?.message || String(err)}`,
            isError: true,
          };
        }
      },
      context?.signal,
    );
  }

  public async shutdown(): Promise<void> {
    this.resolveHelpWaiters(undefined, { status: "cancelled", message: "Application shutting down." });
    await this.daemon.dispose();
  }
}

export const agentBrowserController = new AgentBrowserController();
