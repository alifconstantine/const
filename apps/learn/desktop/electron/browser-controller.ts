import { webContents, nativeImage, type WebContents, type BrowserWindow } from "electron";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  type AriaSnapshotBaseline,
  type AriaSnapshotOptions,
  ariaSnapshotBaselineKey,
  buildEnhancedSnapshotScript,
  diffAriaSnapshot,
  postProcessAriaSnapshot,
} from "./browser/snapshot-plus.js";
import {
  type ScreenshotAnnotationTarget,
  type SelectorSpec,
  buildInstallAnnotationOverlayScript,
  buildRemoveAnnotationOverlayScript,
  formatScreenshotLegend,
  PAGE_SELECTOR_HELPERS,
  parseSelectorSpec,
} from "./browser/selectors.js";
import {
  type BrowserConsoleLevel,
  TabTelemetryBuffer,
} from "./browser/telemetry.js";

function getCdpModifiers(modifiers?: string[]): number {
  if (!modifiers || !Array.isArray(modifiers)) return 0;
  let mask = 0;
  for (const m of modifiers) {
    const lower = String(m || "").toLowerCase();
    if (lower.includes("alt")) mask |= 1;
    if (lower.includes("ctrl") || lower.includes("control")) mask |= 2;
    if (lower.includes("meta") || lower.includes("command") || lower.includes("cmd") || lower.includes("win")) mask |= 4;
    if (lower.includes("shift")) mask |= 8;
  }
  return mask;
}

function getCdpCodeForKey(key: string): string {
  const map: Record<string, string> = {
    Enter: "Enter",
    Return: "Enter",
    Tab: "Tab",
    Escape: "Escape",
    Esc: "Escape",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Home: "Home",
    End: "End",
    Space: "Space",
    " ": "Space",
  };
  if (map[key]) return map[key]!;
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    return `Key${key.toUpperCase()}`;
  }
  if (key.length === 1 && /[0-9]/.test(key)) {
    return `Digit${key}`;
  }
  return key;
}

export interface ControlState {
  holder: "bot" | "human";
  since: string;
  requested: boolean;
  requestedAt?: string;
  reason?: string;
  secretWanted?: string;
  secretRef?: string;
  secretSnapshotId?: number;
  secretExpectedOrigin?: string;
}

export interface SnapshotElement {
  ref: string;
  tag: string;
  role?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  rect: { x: number; y: number; width: number; height: number };
  selector: string;
}

export interface SnapshotResult {
  snapshotId: number;
  tabId: string;
  url: string;
  title: string;
  viewport?: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    scrollWidth: number;
    scrollHeight: number;
  };
  ariaSnapshot?: string;
  elements: SnapshotElement[];
  readableText?: string;
  textSummary: string;
}

export interface BrowserTabSummary {
  tabId: string;
  guestContentsId: number;
  url: string;
  title: string;
  isActive: boolean;
  isLast: boolean;
  registeredAt: number;
  lastUsedAt: number;
}

interface RegisteredTab {
  tabId: string;
  guestContentsId: number;
  contents: WebContents;
  registeredAt: number;
  lastUsedAt: number;
  ariaBaselines: Map<string, AriaSnapshotBaseline>;
  telemetry: TabTelemetryBuffer;
}

export const HELP_REQUEST_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Default timeout used when an element must be resolved before an action runs. */
export const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
/** Maximum timeout accepted by browser_wait_for. */
export const MAX_WAIT_TIMEOUT_MS = 60_000;
/** Poll interval used while waiting for a condition to become true. */
const WAIT_POLL_INTERVAL_MS = 100;
/** How long captured browser screenshots are kept on disk. */
const SCREENSHOT_RETENTION_MS = 30 * 60 * 1000;
const SCREENSHOT_FILE_PREFIX = "const-browser-shot-";
/**
 * Navigation is restricted to web schemes. Local files are intentionally not
 * reachable from the browser: they are served through the sandboxed file tools
 * so the workspace boundary cannot be bypassed through a page render.
 */
const ALLOWED_NAVIGATION_SCHEMES = new Set(["http:", "https:"]);

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export class BrowserController {
  private controlState: ControlState = {
    holder: "bot",
    since: new Date().toISOString(),
    requested: false,
  };

  private parentWindow: BrowserWindow | null = null;
  private registeredTabs = new Map<string, RegisteredTab>();
  private activeTabId: string | null = null;
  private snapshotCounter = 0;
  private lastScreenshotPruneAt = 0;
  /** Optional host allowlist. When empty every http(s) host stays reachable. */
  private allowedDomains: string[] = [];

  private registerWaiters: Array<(tab: RegisteredTab) => void> = [];
  private helpResolutionWaiters: Array<(info: { status: "resolved"; message: string }) => void> = [];

  private onStateChangeCallback?: (state: ControlState) => void;
  private onAiActionCallback?: (action: { type: string; details?: any }) => void;
  private onTabOpenRequestCallback?: (payload: {
    url: string;
    tabId?: string;
    newTab?: boolean;
  }) => Promise<string | null>;

  constructor(options?: {
    onStateChange?: (state: ControlState) => void;
    onAiAction?: (action: { type: string; details?: any }) => void;
    onTabOpenRequest?: (payload: {
      url: string;
      tabId?: string;
      newTab?: boolean;
    }) => Promise<string | null>;
  }) {
    if (options?.onStateChange) this.onStateChangeCallback = options.onStateChange;
    if (options?.onAiAction) this.onAiActionCallback = options.onAiAction;
    if (options?.onTabOpenRequest) this.onTabOpenRequestCallback = options.onTabOpenRequest;
    this.setAllowedDomains(parseAllowedDomains(process.env.CONST_BROWSER_ALLOWED_DOMAINS));
  }

  public setCallbacks(callbacks: {
    onStateChange?: (state: ControlState) => void;
    onAiAction?: (action: { type: string; details?: any }) => void;
    onTabOpenRequest?: (payload: {
      url: string;
      tabId?: string;
      newTab?: boolean;
    }) => Promise<string | null>;
  }) {
    if (callbacks.onStateChange) this.onStateChangeCallback = callbacks.onStateChange;
    if (callbacks.onAiAction) this.onAiActionCallback = callbacks.onAiAction;
    if (callbacks.onTabOpenRequest) this.onTabOpenRequestCallback = callbacks.onTabOpenRequest;
  }

  public setParentWindow(win: BrowserWindow | null) {
    this.parentWindow = win;
  }

  public async ensureCdp(contents: WebContents): Promise<boolean> {
    if (!contents || contents.isDestroyed()) return false;
    try {
      if (!contents.debugger.isAttached()) {
        contents.debugger.attach("1.3");
        await Promise.allSettled([
          contents.debugger.sendCommand("Page.enable"),
          contents.debugger.sendCommand("DOM.enable"),
          contents.debugger.sendCommand("Runtime.enable"),
          contents.debugger.sendCommand("Input.setIgnoreInputEvents", { ignore: false }),
        ]);
      }
      return true;
    } catch (err) {
      console.warn("[BrowserController] CDP debugger attach warning:", err);
      return false;
    }
  }

  public async goBack(tabId?: string): Promise<boolean> {
    const tab = this.getTargetTab(tabId);
    if (tab && !tab.contents.isDestroyed() && tab.contents.canGoBack()) {
      tab.contents.goBack();
      return true;
    }
    return false;
  }

  public async goForward(tabId?: string): Promise<boolean> {
    const tab = this.getTargetTab(tabId);
    if (tab && !tab.contents.isDestroyed() && tab.contents.canGoForward()) {
      tab.contents.goForward();
      return true;
    }
    return false;
  }

  public async reload(tabId?: string, ignoreCache = false): Promise<boolean> {
    const tab = this.getTargetTab(tabId);
    if (tab && !tab.contents.isDestroyed()) {
      if (ignoreCache) {
        tab.contents.reloadIgnoringCache();
      } else {
        tab.contents.reload();
      }
      return true;
    }
    return false;
  }

  public async stop(tabId?: string): Promise<boolean> {
    const tab = this.getTargetTab(tabId);
    if (tab && !tab.contents.isDestroyed()) {
      tab.contents.stop();
      return true;
    }
    return false;
  }

  public async setAudioMuted(tabId: string, muted: boolean): Promise<boolean> {
    const tab = this.getTargetTab(tabId);
    if (tab && !tab.contents.isDestroyed()) {
      tab.contents.setAudioMuted(muted);
      return true;
    }
    return false;
  }

  public async setZoomFactor(tabId: string, factor: number): Promise<boolean> {
    const tab = this.getTargetTab(tabId);
    if (tab && !tab.contents.isDestroyed()) {
      tab.contents.setZoomFactor(factor);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Multi-Tab Lifecycle & Smart Tab Resolution
  // ---------------------------------------------------------------------------

  private pruneDestroyedTabs() {
    for (const [id, reg] of this.registeredTabs.entries()) {
      if (!reg.contents || reg.contents.isDestroyed()) {
        this.registeredTabs.delete(id);
        if (this.activeTabId === id) {
          this.activeTabId = null;
        }
      }
    }
  }

  public registerWebview(tabId: string, guestContentsId: number) {
    const contents = webContents.fromId(guestContentsId);
    if (!contents || contents.isDestroyed()) {
      console.warn(`[BrowserController] Could not find WebContents with ID ${guestContentsId}`);
      return;
    }

    const now = Date.now();
    const existing = this.registeredTabs.get(tabId);
    const tabRecord: RegisteredTab = existing
      ? {
          ...existing,
          guestContentsId,
          contents,
          lastUsedAt: now,
        }
      : {
          tabId,
          guestContentsId,
          contents,
          registeredAt: now,
          lastUsedAt: now,
          ariaBaselines: new Map(),
          telemetry: new TabTelemetryBuffer(),
        };

    // Re-insert on new registration so Map order keeps the newest tab last
    if (!existing) {
      this.registeredTabs.set(tabId, tabRecord);
      // Newly opened tab becomes the active target by default
      this.activeTabId = tabId;
    } else {
      this.registeredTabs.set(tabId, tabRecord);
      if (!this.activeTabId) {
        this.activeTabId = tabId;
      }
    }

    console.log(
      `[BrowserController] Registered browser view for tab ${tabId} (webContentsId: ${guestContentsId}, totalTabs: ${this.registeredTabs.size})`
    );

    this.setupGuestWebContentsHooks(tabRecord);

    // Notify any pending auto-open waiters
    if (this.registerWaiters.length > 0) {
      const waiters = this.registerWaiters.splice(0, this.registerWaiters.length);
      for (const resolve of waiters) {
        try {
          resolve(tabRecord);
        } catch {}
      }
    }
  }

  private setupGuestWebContentsHooks(tabRecord: RegisteredTab) {
    const { contents, telemetry } = tabRecord;
    if (contents.isDestroyed()) return;

    telemetry.attachToWebContents(contents);

    // Prevent unload dialogs from hanging navigation while AI is driving
    contents.removeAllListeners("will-prevent-unload");
    contents.on("will-prevent-unload", (event) => {
      if (this.controlState.holder === "bot") {
        event.preventDefault();
      }
    });

    this.injectRuntimeHelpers(tabRecord);
  }

  private injectRuntimeHelpers(tabRecord: RegisteredTab) {
    if (tabRecord.contents.isDestroyed()) return;
    this.injectAiCursorOverlay(tabRecord.contents);
    void tabRecord.telemetry.injectObservers(tabRecord.contents);

    // Ensure blocking window.alert / confirm / prompt do not freeze executeJavaScript
    tabRecord.contents
      .executeJavaScript(
        `(() => {
          if (window.__constDialogGuardInstalled) return;
          window.__constDialogGuardInstalled = true;
          window.__constLastDialogs = [];
          window.alert = (msg) => {
            window.__constLastDialogs.push({ type: 'alert', message: String(msg ?? ''), ts: Date.now() });
          };
          window.confirm = (msg) => {
            window.__constLastDialogs.push({ type: 'confirm', message: String(msg ?? ''), ts: Date.now() });
            return true;
          };
          window.prompt = (msg, def) => {
            window.__constLastDialogs.push({ type: 'prompt', message: String(msg ?? ''), defaultValue: def, ts: Date.now() });
            return def ?? '';
          };
        })()`
      )
      .catch(() => {});
  }

  public unregisterWebview(tabId: string) {
    this.registeredTabs.delete(tabId);
    if (this.activeTabId === tabId) {
      // Fall back to the last registered tab (most recent)
      const keys = Array.from(this.registeredTabs.keys());
      this.activeTabId = keys.length > 0 ? keys[keys.length - 1]! : null;
    }
  }

  public setActiveTab(tabId: string) {
    this.pruneDestroyedTabs();
    const reg = this.registeredTabs.get(tabId);
    if (reg) {
      reg.lastUsedAt = Date.now();
      this.activeTabId = tabId;
    } else {
      this.activeTabId = tabId;
    }
  }

  /**
   * Resolves the target browser tab:
   * 1. Explicit `tabId` if provided and alive.
   * 2. Currently active browser tab (`this.activeTabId`) if alive.
   * 3. The LAST (most recently opened/used) browser tab when multiple tabs exist.
   */
  public getTargetTab(requestedTabId?: string): RegisteredTab | null {
    this.pruneDestroyedTabs();

    if (requestedTabId) {
      const explicit = this.registeredTabs.get(requestedTabId);
      if (explicit && !explicit.contents.isDestroyed()) {
        explicit.lastUsedAt = Date.now();
        this.activeTabId = explicit.tabId;
        return explicit;
      }
    }

    if (this.activeTabId) {
      const active = this.registeredTabs.get(this.activeTabId);
      if (active && !active.contents.isDestroyed()) {
        return active;
      }
    }

    // Fallback when multiple tabs exist: pick the last registered tab
    const allTabs = Array.from(this.registeredTabs.values());
    if (allTabs.length > 0) {
      const lastTab = allTabs[allTabs.length - 1]!;
      this.activeTabId = lastTab.tabId;
      return lastTab;
    }

    return null;
  }

  public getActiveWebContents(requestedTabId?: string): WebContents | null {
    return this.getTargetTab(requestedTabId)?.contents ?? null;
  }

  public listTabs(): BrowserTabSummary[] {
    this.pruneDestroyedTabs();
    const entries = Array.from(this.registeredTabs.values());
    const lastId = entries.length > 0 ? entries[entries.length - 1]!.tabId : null;
    return entries.map((reg) => ({
      tabId: reg.tabId,
      guestContentsId: reg.guestContentsId,
      url: reg.contents.isDestroyed() ? "" : reg.contents.getURL(),
      title: reg.contents.isDestroyed() ? "" : reg.contents.getTitle(),
      isActive: reg.tabId === this.activeTabId,
      isLast: reg.tabId === lastId,
      registeredAt: reg.registeredAt,
      lastUsedAt: reg.lastUsedAt,
    }));
  }

  private waitForNextTabRegistration(timeoutMs = 6000): Promise<RegisteredTab | null> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = this.registerWaiters.indexOf(onRegister);
        if (idx !== -1) this.registerWaiters.splice(idx, 1);
        resolve(this.getTargetTab());
      }, timeoutMs);

      const onRegister = (tab: RegisteredTab) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(tab);
      };

      this.registerWaiters.push(onRegister);
    });
  }

  /**
   * Ensures a browser tab is open and visible in the sidepanel.
   * If none is open (or `newTab: true` is requested), triggers `onTabOpenRequestCallback`
   * so the renderer automatically opens the Right Sidebar + Browser Tab and waits for `<webview>` registration.
   * If a tab is already registered, also notifies the renderer to ensure the Right Sidebar is open and the tab is focused.
   */
  public async ensureTargetTab(options?: {
    url?: string;
    tabId?: string;
    newTab?: boolean;
  }): Promise<RegisteredTab> {
    if (!options?.newTab) {
      const existing = this.getTargetTab(options?.tabId);
      if (existing) {
        // Ensure the right sidepanel is open and this browser tab is active in the UI
        if (this.onTabOpenRequestCallback) {
          void this.onTabOpenRequestCallback({
            url: options?.url ? this.normalizeUrl(options.url) : "",
            tabId: existing.tabId,
            newTab: false,
          }).catch(() => {});
        }
        return existing;
      }
    }

    if (this.onTabOpenRequestCallback) {
      const targetUrl = options?.url ? this.normalizeUrl(options.url) : "";
      const waiter = this.waitForNextTabRegistration(6500);
      await this.onTabOpenRequestCallback({
        url: targetUrl,
        tabId: options?.tabId,
        newTab: Boolean(options?.newTab),
      });
      const registered = await waiter;
      if (registered && !registered.contents.isDestroyed()) {
        // Give the newly mounted webview a brief moment to finish initial DOM attach
        await new Promise((r) => setTimeout(r, 250));
        return registered;
      }
    }

    const fallback = this.getTargetTab(options?.tabId);
    if (fallback) return fallback;

    throw new Error(
      "Could not open or attach to a browser tab in the desktop sidepanel."
    );
  }

  // ---------------------------------------------------------------------------
  // Control State Machine ("Who has the wheel")
  // ---------------------------------------------------------------------------

  public getControl(): ControlState {
    if (
      this.controlState.requested &&
      this.controlState.requestedAt &&
      Date.now() - Date.parse(this.controlState.requestedAt) > HELP_REQUEST_TTL_MS
    ) {
      this.controlState = {
        holder: "bot",
        since: new Date().toISOString(),
        requested: false,
      };
      this.onStateChangeCallback?.(this.controlState);
    }
    return { ...this.controlState };
  }

  private updateControl(patch: Partial<ControlState>) {
    this.controlState = { ...this.controlState, ...patch };
    this.onStateChangeCallback?.(this.getControl());
  }

  public assertBotMayAct() {
    const current = this.getControl();
    if (current.holder === "human") {
      throw new Error(
        "A person currently has control of the browser ('You Drive' mode). Wait for them to click 'Hand back to AI' before performing browser actions."
      );
    }
  }

  public takeControl(): ControlState {
    this.updateControl({
      holder: "human",
      since: new Date().toISOString(),
      requested: false,
    });
    return this.getControl();
  }

  public releaseControl(): ControlState {
    this.updateControl({
      holder: "bot",
      since: new Date().toISOString(),
      requested: false,
      reason: undefined,
      secretWanted: undefined,
      secretRef: undefined,
      secretSnapshotId: undefined,
      secretExpectedOrigin: undefined,
    });

    if (this.helpResolutionWaiters.length > 0) {
      const waiters = this.helpResolutionWaiters.splice(0, this.helpResolutionWaiters.length);
      const tab = this.getTargetTab();
      const currentUrl = tab && !tab.contents.isDestroyed() ? tab.contents.getURL() : "";
      for (const resolve of waiters) {
        try {
          resolve({
            status: "resolved",
            message: `User completed the manual action and handed control back to AI.${currentUrl ? ` Current URL: ${currentUrl}` : ""}`,
          });
        } catch {}
      }
    }

    return this.getControl();
  }

  public requestHelp(reason: string): ControlState {
    const safeReason =
      typeof reason === "string" && reason.trim()
        ? reason.trim().slice(0, 500)
        : "The assistant needs a person to continue (e.g. solve CAPTCHA or confirm action).";
    this.updateControl({
      holder: "human",
      since: new Date().toISOString(),
      requested: true,
      requestedAt: new Date().toISOString(),
      reason: safeReason,
      secretWanted: undefined,
      secretRef: undefined,
      secretExpectedOrigin: undefined,
    });
    return this.getControl();
  }

  public requestSecret(label: string, ref?: string): ControlState {
    const safeLabel =
      typeof label === "string" && label.trim()
        ? label.trim().slice(0, 200)
        : "password or authentication secret";
    let expectedOrigin: string | undefined;
    try {
      const activeUrl = this.getTargetTab()?.contents.getURL();
      if (activeUrl) {
        expectedOrigin = new URL(activeUrl).origin;
      }
    } catch {}
    this.updateControl({
      holder: "human",
      since: new Date().toISOString(),
      requested: true,
      requestedAt: new Date().toISOString(),
      secretWanted: safeLabel,
      secretRef: ref,
      secretSnapshotId: this.snapshotCounter,
      secretExpectedOrigin: expectedOrigin,
      reason: `The assistant needs you to enter ${safeLabel}.`,
    });
    return this.getControl();
  }

  public waitForHumanHelpResolution(
    timeoutMs = 5 * 60 * 1000
  ): Promise<{ status: "resolved" | "timeout"; message: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = this.helpResolutionWaiters.indexOf(onResolved);
        if (idx !== -1) this.helpResolutionWaiters.splice(idx, 1);
        resolve({
          status: "timeout",
          message:
            "Waiting for human assistance timed out. Control remains with the user until they click 'Hand back to AI'.",
        });
      }, timeoutMs);

      const onResolved = (info: { status: "resolved"; message: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(info);
      };

      this.helpResolutionWaiters.push(onResolved);
    });
  }

  public async supplySecret(text: string): Promise<{ success: boolean; characters: number }> {
    const tab = this.getTargetTab();
    if (!tab) {
      throw new Error("No active browser window found to enter secret.");
    }
    const target = tab.contents;
    if (this.controlState.secretExpectedOrigin) {
      let currentOrigin = "";
      try {
        currentOrigin = new URL(target.getURL()).origin;
      } catch {}
      if (currentOrigin && currentOrigin !== this.controlState.secretExpectedOrigin) {
        throw new Error(
          `Security check failed: page origin changed from ${this.controlState.secretExpectedOrigin} to ${currentOrigin} before secret was supplied.`
        );
      }
    }
    const secretRef = this.controlState.secretRef;
    const spec = secretRef ? parseSelectorSpec(secretRef) : null;

    const writeOutcome = await target
      .executeJavaScript(`
      (function() {
        const spec = ${JSON.stringify(spec)};
        const secret = ${JSON.stringify(text)};
        ${PAGE_SELECTOR_HELPERS}
        const isSecretish = (el) => {
          if (!el) return false;
          const type = String(el.type || "").toLowerCase();
          if (type === "password") return true;
          const autocomplete = String((el.getAttribute && el.getAttribute("autocomplete")) || "").toLowerCase();
          return autocomplete.indexOf("password") !== -1 || autocomplete.indexOf("one-time-code") !== -1;
        };
        let targetEl = spec ? findElement(spec) : null;
        if (!targetEl) {
          const active = document.activeElement;
          const passwordField = document.querySelector('input[type="password"]');
          if (isSecretish(active)) {
            targetEl = active;
          } else if (passwordField) {
            targetEl = passwordField;
          }
        }
        if (!targetEl) {
          return { written: false, reason: "no-target" };
        }
        targetEl.focus();
        const proto = Object.getPrototypeOf(targetEl);
        const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setValue) {
          setValue.call(targetEl, secret);
        } else if ('value' in targetEl) {
          targetEl.value = secret;
        } else if (targetEl.isContentEditable) {
          targetEl.textContent = secret;
        } else {
          return { written: false, reason: "not-editable" };
        }
        targetEl.dispatchEvent(new Event('input', { bubbles: true }));
        targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        const current = ('value' in targetEl) ? String(targetEl.value || "") : String(targetEl.textContent || "");
        return { written: current.length === secret.length, reason: current.length === secret.length ? null : "length-mismatch" };
      })();
    `)
      .catch(() => ({ written: false, reason: "script-error" }));

    if (!writeOutcome?.written) {
      throw new Error(
        `Failed to write the secret into the page (${writeOutcome?.reason || "unknown"}). ` +
          `The secret was NOT entered and is NOT recoverable by the agent. ` +
          `Ask the user to type it directly into the field in the browser pane, or request the secret again with an explicit 'ref' pointing at the target field.`
      );
    }

    const charCount = text.length;
    this.updateControl({
      holder: "bot",
      since: new Date().toISOString(),
      requested: false,
      reason: undefined,
      secretWanted: undefined,
      secretRef: undefined,
      secretSnapshotId: undefined,
      secretExpectedOrigin: undefined,
    });

    if (this.helpResolutionWaiters.length > 0) {
      const waiters = this.helpResolutionWaiters.splice(0, this.helpResolutionWaiters.length);
      for (const resolve of waiters) {
        try {
          resolve({
            status: "resolved",
            message: `User securely supplied the requested secret (${charCount} characters) into the page and handed control back to AI.`,
          });
        } catch {}
      }
    }

    return { success: true, characters: charCount };
  }

  // ---------------------------------------------------------------------------
  // Browser Driver Operations
  // ---------------------------------------------------------------------------

  private normalizeUrl(url: string): string {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "https://www.google.com";
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return `http://${trimmed}`;
    }
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(`Invalid URL for browser_navigate: '${trimmed}'`);
    }
    if (!ALLOWED_NAVIGATION_SCHEMES.has(parsed.protocol)) {
      throw new Error(
        `Blocked navigation to '${parsed.protocol}//' URLs. The browser only loads http:// and https:// pages. ` +
          `Read local files with the read tool (workspace-scoped) instead of rendering them in the browser, ` +
          `and use the 'computer_*' tools for desktop applications.`
      );
    }
    return candidate;
  }

  /**
   * Restrict which hosts the agent may navigate to. When the list is empty
   * every http(s) host stays reachable.
   */
  public setAllowedDomains(domains: string[]): void {
    this.allowedDomains = parseAllowedDomains(domains.join(","));
  }

  public getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }

  private assertHostAllowed(url: string): void {
    if (this.allowedDomains.length === 0) return;
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return;
    }
    const allowed = this.allowedDomains.some((entry) => {
      if (entry === "*") return true;
      if (entry.startsWith("*.")) {
        const suffix = entry.slice(1);
        return host === entry.slice(2) || host.endsWith(suffix);
      }
      return host === entry;
    });
    if (!allowed) {
      throw new Error(
        `Navigation to '${host}' is blocked by the browser domain allowlist (${this.allowedDomains.join(", ")}).`
      );
    }
  }

  public async navigate(
    url: string,
    options?: { tabId?: string; newTab?: boolean }
  ): Promise<{ tabId: string; url: string; title: string; totalTabs: number }> {
    this.assertBotMayAct();

    const cleanUrl = this.normalizeUrl(url);
    this.assertHostAllowed(cleanUrl);
    const tab = await this.ensureTargetTab({
      url: cleanUrl,
      tabId: options?.tabId,
      newTab: options?.newTab,
    });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    this.onAiActionCallback?.({
      type: "navigate",
      details: { tabId: tab.tabId, url: cleanUrl },
    });

    const currentUrl = target.getURL();
    if (currentUrl !== cleanUrl) {
      try {
        await target.loadURL(cleanUrl);
      } catch (err: any) {
        // Ignore ERR_ABORTED (-3) which happens on client-side / SPA redirects
        if (err?.errno !== -3 && err?.code !== "ERR_ABORTED" && !String(err?.message || "").includes("ERR_ABORTED")) {
          throw err;
        }
      }
    }

    // Wait until DOM finishes loading
    await new Promise((resolve) => {
      if (!target.isDestroyed() && target.isLoading()) {
        const onFinish = () => {
          if (!target.isDestroyed()) {
            target.removeListener("did-finish-load", onFinish);
            target.removeListener("did-fail-load", onFinish);
          }
          resolve(true);
        };
        target.once("did-finish-load", onFinish);
        target.once("did-fail-load", onFinish);
        setTimeout(resolve, 8000);
      } else {
        resolve(true);
      }
    });

    this.injectRuntimeHelpers(tab);

    return {
      tabId: tab.tabId,
      url: target.getURL(),
      title: target.getTitle(),
      totalTabs: this.registeredTabs.size,
    };
  }

  public async snapshot(
    options?: AriaSnapshotOptions & { tabId?: string }
  ): Promise<SnapshotResult> {
    const tab = await this.ensureTargetTab({ tabId: options?.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    this.snapshotCounter++;
    this.injectRuntimeHelpers(tab);

    // While a human is handing a secret back to the agent, never surface the
    // value of the field that receives it.
    const maskValues = this.controlState.secretRef ? [this.controlState.secretRef] : [];
    const script = buildEnhancedSnapshotScript(this.snapshotCounter, { ...options, maskValues });
    const raw = await target.executeJavaScript(script);

    const processedAria = postProcessAriaSnapshot(
      raw.ariaSnapshot || "",
      {
        interactive: options?.interactive ?? false,
        compact: options?.compact ?? true,
        urls: options?.urls ?? true,
      },
      raw.hrefs || {}
    );

    let ariaSection = "";
    if (processedAria) {
      if (options?.diff) {
        const key = ariaSnapshotBaselineKey(options.selector, {
          depth: options.depth,
          boxes: options.boxes,
          interactive: options.interactive,
          compact: options.compact ?? true,
          urls: options.urls ?? true,
        });
        const diffRes = diffAriaSnapshot(tab.ariaBaselines, key, raw.url, processedAria);
        if (diffRes.status === "unchanged") {
          ariaSection = `### ARIA Accessibility Tree (Revision ${diffRes.revision} — Unchanged since last snapshot)`;
        } else if (diffRes.status === "delta") {
          ariaSection = `### ARIA Accessibility Tree Delta (Revision ${diffRes.baseRevision} -> ${diffRes.revision})\n\`\`\`diff\n${diffRes.delta}\n\`\`\``;
        } else {
          ariaSection = `### ARIA Accessibility Tree (Revision ${diffRes.revision})\n\`\`\`yaml\n${diffRes.snapshot.slice(0, 6000)}\n\`\`\``;
        }
      } else {
        ariaSection = `### ARIA Accessibility Tree\n\`\`\`yaml\n${processedAria.slice(0, 6000)}\n\`\`\``;
      }
    }

    const elements: SnapshotElement[] = Array.isArray(raw.elements) ? raw.elements : [];
    const elementLines = elements.slice(0, 120).map((e) => {
      let desc = `[${e.ref}] ${e.role || e.tag}`;
      if (e.name) desc += ` "${e.name}"`;
      if (e.placeholder && e.placeholder !== e.name) desc += ` placeholder="${e.placeholder}"`;
      if (e.value) desc += ` value="${e.value}"`;
      if (e.checked !== undefined) desc += ` checked=${e.checked}`;
      if (e.disabled) desc += ` (disabled)`;
      return desc;
    });
    if (elements.length > 120) {
      elementLines.push(
        `... and ${elements.length - 120} more interactive elements (scroll or scope with selector)`
      );
    }

    // Check recent console errors & failed network requests
    const telemetry = await tab.telemetry.readTelemetry(target, {
      level: "error",
      includeNetwork: true,
      onlyFailedNetwork: true,
      limit: 15,
    });

    const diagLines: string[] = [];
    for (const cErr of telemetry.consoleEntries) {
      diagLines.push(`- [${cErr.type.toUpperCase()}] ${cErr.text}${cErr.location ? ` (${cErr.location})` : ""}`);
    }
    for (const nErr of telemetry.networkRecords) {
      diagLines.push(
        `- [NETWORK ${nErr.status || "ERR"}] ${nErr.method} ${nErr.url} (${nErr.durationMs}ms)${nErr.statusText ? ` - ${nErr.statusText}` : ""}`
      );
    }

    const vp = raw.viewport;
    const summaryParts: string[] = [
      `### Page Metadata`,
      `- **Tab**: \`${tab.tabId}\` (${this.registeredTabs.size} browser tab(s) open)`,
      `- **URL**: ${raw.url}`,
      `- **Title**: ${raw.title || "(Untitled)"}`,
      vp
        ? `- **Viewport**: ${vp.width}x${vp.height}px (Scroll: ${vp.scrollX}, ${vp.scrollY} of ${vp.scrollWidth}x${vp.scrollHeight}px)`
        : "",
    ].filter(Boolean);

    if (diagLines.length > 0) {
      summaryParts.push(
        `\n### Page Errors & Failed Requests (${diagLines.length})\n${diagLines.join("\n")}`
      );
    }

    if (elementLines.length > 0) {
      summaryParts.push(
        `\n### Interactive Elements (use ref="eN" or selector with browser_click / browser_type)\n${elementLines.join("\n")}`
      );
    } else {
      summaryParts.push(`\n### Interactive Elements\n(No visible interactive elements detected in current viewport)`);
    }

    if (ariaSection) {
      summaryParts.push(`\n${ariaSection}`);
    }

    if (raw.readableText) {
      summaryParts.push(`\n### Readable Page Text\n${String(raw.readableText).slice(0, 3000)}`);
    }

    return {
      snapshotId: this.snapshotCounter,
      tabId: tab.tabId,
      url: raw.url,
      title: raw.title,
      viewport: raw.viewport,
      ariaSnapshot: processedAria,
      elements,
      readableText: raw.readableText,
      textSummary: summaryParts.join("\n"),
    };
  }

  public async click(params: {
    ref?: string;
    selector?: string;
    x?: number;
    y?: number;
    button?: "left" | "right" | "middle";
    clickCount?: number;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    ref?: string;
    selector?: string;
    x: number;
    y: number;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    let targetX = params.x;
    let targetY = params.y;
    const rawTarget = params.ref || params.selector;

    if (rawTarget) {
      const spec = parseSelectorSpec(rawTarget);
      const pos = await this.resolveElementBox(target, spec);
      if (!pos) {
        throw new Error(
          `Element '${rawTarget}' not found after waiting ${DEFAULT_WAIT_TIMEOUT_MS}ms. Call browser_snapshot to inspect current refs.`
        );
      }
      targetX = pos.x;
      targetY = pos.y;
    }

    if (typeof targetX !== "number" || typeof targetY !== "number") {
      throw new Error(
        "browser_click requires an element 'ref' (e.g. 'e1'), a 'selector' (e.g. 'text/Sign in', '#submit'), or 'x' and 'y' coordinates."
      );
    }

    this.onAiActionCallback?.({
      type: "click",
      details: { tabId: tab.tabId, ref: rawTarget, x: targetX, y: targetY },
    });

    await target
      .executeJavaScript(`
        if (window.__constShowClickRipple) {
          window.__constShowClickRipple(${targetX}, ${targetY});
        }
      `)
      .catch(() => {});

    const button = params.button || "left";
    const clickCount = params.clickCount || 1;

    await this.ensureCdp(target);

    let cdpSuccess = false;
    if (target.debugger.isAttached()) {
      try {
        const cdpButton = button === "right" ? "right" : button === "middle" ? "middle" : "left";
        await target.debugger.sendCommand("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: targetX,
          y: targetY,
        });
        await target.debugger.sendCommand("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x: targetX,
          y: targetY,
          button: cdpButton,
          clickCount,
        });
        await new Promise((r) => setTimeout(r, 50));
        await target.debugger.sendCommand("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: targetX,
          y: targetY,
          button: cdpButton,
          clickCount,
        });
        cdpSuccess = true;
      } catch (err) {
        console.warn("[BrowserController] CDP click dispatch failed, falling back to sendInputEvent:", err);
      }
    }

    if (!cdpSuccess) {
      target.sendInputEvent({
        type: "mouseMove",
        x: targetX,
        y: targetY,
      });

      target.sendInputEvent({
        type: "mouseDown",
        x: targetX,
        y: targetY,
        button,
        clickCount,
      });

      await new Promise((r) => setTimeout(r, 50));

      target.sendInputEvent({
        type: "mouseUp",
        x: targetX,
        y: targetY,
        button,
        clickCount,
      });
    }

    await new Promise((r) => setTimeout(r, 120));

    return {
      action: "click",
      tabId: tab.tabId,
      ref: params.ref,
      selector: params.selector,
      x: targetX,
      y: targetY,
      url: target.getURL(),
    };
  }

  public async type(params: {
    ref?: string;
    selector?: string;
    text: string;
    submit?: boolean;
    clearFirst?: boolean;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    ref?: string;
    characters: number;
    submitted: boolean;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const rawTarget = params.ref || params.selector;
    const clearFirst = params.clearFirst !== false;

    if (rawTarget) {
      const spec = parseSelectorSpec(rawTarget);
      const focused = await this.focusElement(target, spec, { clearFirst });
      if (!focused) {
        throw new Error(
          `Element '${rawTarget}' not found after waiting ${DEFAULT_WAIT_TIMEOUT_MS}ms. Call browser_snapshot to get updated element refs.`
        );
      }
      await target
        .executeJavaScript(`
          if (window.__constShowClickRipple) {
            window.__constShowClickRipple(${focused.x}, ${focused.y});
          }
        `)
        .catch(() => {});
    }

    this.onAiActionCallback?.({
      type: "type",
      details: { tabId: tab.tabId, ref: rawTarget, characters: params.text.length },
    });

    await this.ensureCdp(target);

    let cdpTyped = false;
    if (target.debugger.isAttached()) {
      try {
        await target.debugger.sendCommand("Input.insertText", { text: params.text });
        cdpTyped = true;
      } catch (err) {
        console.warn("[BrowserController] CDP insertText failed, falling back to sendInputEvent:", err);
      }
    }

    if (!cdpTyped) {
      for (const char of params.text) {
        target.sendInputEvent({
          type: "char",
          keyCode: char,
        });
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    // Ensure React controlled inputs & contenteditable elements accurately reflect the typed value
    await target
      .executeJavaScript(`
        (function() {
          const el = document.activeElement;
          if (!el) return;
          const expected = ${JSON.stringify(params.text)};
          const clear = ${clearFirst};
          if ('value' in el && clear && el.value !== expected) {
            const proto = Object.getPrototypeOf(el);
            const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setValue) setValue.call(el, expected);
            else el.value = expected;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })();
      `)
      .catch(() => {});

    if (params.submit) {
      await new Promise((r) => setTimeout(r, 80));
      let cdpSubmitSuccess = false;
      if (target.debugger.isAttached()) {
        try {
          await target.debugger.sendCommand("Input.dispatchKeyEvent", {
            type: "rawKeyDown",
            key: "Enter",
            code: "Enter",
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
          });
          await target.debugger.sendCommand("Input.dispatchKeyEvent", {
            type: "char",
            text: "\r",
            unmodifiedText: "\r",
          });
          await target.debugger.sendCommand("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Enter",
            code: "Enter",
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
          });
          cdpSubmitSuccess = true;
        } catch {}
      }
      if (!cdpSubmitSuccess) {
        target.sendInputEvent({ type: "keyDown", keyCode: "Enter" });
        target.sendInputEvent({ type: "char", keyCode: "\r" });
        target.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    return {
      action: "type",
      tabId: tab.tabId,
      ref: rawTarget,
      characters: params.text.length,
      submitted: Boolean(params.submit),
      url: target.getURL(),
    };
  }

  /**
   * Poll an in-page probe until it returns a truthy value or the timeout
   * elapses. Replaces fixed sleeps with a real readiness check.
   */
  private async pollUntil<T>(
    probe: () => Promise<T | null | undefined>,
    timeoutMs: number
  ): Promise<T | null> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    for (;;) {
      let result: T | null | undefined = null;
      try {
        result = await probe();
      } catch {
        result = null;
      }
      if (result) return result;
      if (Date.now() >= deadline) return null;
      await new Promise((r) => setTimeout(r, WAIT_POLL_INTERVAL_MS));
    }
  }

  /** Resolve an element to viewport coordinates, waiting for it to appear. */
  private async resolveElementBox(
    target: WebContents,
    spec: SelectorSpec,
    options?: { timeoutMs?: number }
  ): Promise<{ x: number; y: number; tag: string } | null> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const script = `
      (function() {
        const spec = ${JSON.stringify(spec)};
        ${PAGE_SELECTOR_HELPERS}
        const el = findElement(spec);
        if (!el) return null;
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        const rect = el.getBoundingClientRect();
        if (window.__constHighlightElement) {
          window.__constHighlightElement(el);
        }
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          tag: (el.tagName || '').toLowerCase()
        };
      })();
    `;
    return this.pollUntil(async () => {
      const pos = await target.executeJavaScript(script).catch(() => null);
      return pos && typeof pos.x === "number" && typeof pos.y === "number" ? pos : null;
    }, timeoutMs);
  }

  /** Focus an element (and optionally clear it), waiting for it to appear. */
  private async focusElement(
    target: WebContents,
    spec: SelectorSpec,
    options?: { clearFirst?: boolean; timeoutMs?: number }
  ): Promise<{ x: number; y: number } | null> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const clearFirst = options?.clearFirst !== false;
    const script = `
      (function() {
        const spec = ${JSON.stringify(spec)};
        ${PAGE_SELECTOR_HELPERS}
        const el = findElement(spec);
        if (!el) return null;
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        el.focus();
        ${clearFirst ? `
        if ('value' in el) {
          const proto = Object.getPrototypeOf(el);
          const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setValue) {
            setValue.call(el, '');
          } else {
            el.value = '';
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.isContentEditable) {
          el.textContent = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }` : ""}
        if (window.__constHighlightElement) {
          window.__constHighlightElement(el);
        }
        const rect = el.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2)
        };
      })();
    `;
    return this.pollUntil(async () => {
      const focused = await target.executeJavaScript(script).catch(() => null);
      return focused && typeof focused.x === "number" ? focused : null;
    }, timeoutMs);
  }

  public async waitFor(params: {
    selector?: string;
    ref?: string;
    state?: "visible" | "hidden" | "attached" | "detached";
    text?: string;
    url?: string;
    timeMs?: number;
    timeoutMs?: number;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    matched: boolean;
    elapsedMs: number;
    description: string;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();
    const startedAt = Date.now();

    const timeoutMs = Math.min(
      MAX_WAIT_TIMEOUT_MS,
      Math.max(0, typeof params.timeoutMs === "number" ? params.timeoutMs : DEFAULT_WAIT_TIMEOUT_MS)
    );
    const state = params.state || "visible";
    const rawTarget = params.ref || params.selector;

    if (typeof params.timeMs === "number" && !rawTarget && !params.text && !params.url) {
      const sleepMs = Math.min(MAX_WAIT_TIMEOUT_MS, Math.max(0, params.timeMs));
      await new Promise((r) => setTimeout(r, sleepMs));
      return {
        action: "wait_for",
        tabId: tab.tabId,
        matched: true,
        elapsedMs: Date.now() - startedAt,
        description: `Waited ${sleepMs}ms`,
        url: target.getURL(),
      };
    }

    const spec = rawTarget ? parseSelectorSpec(rawTarget) : null;
    const description = rawTarget
      ? `element '${rawTarget}' to be ${state}`
      : params.text
        ? `text '${params.text}' to appear`
        : `URL to contain '${params.url}'`;

    const matched = await this.pollUntil(async () => {
      if (spec) {
        const stateOk = await target
          .executeJavaScript(`
            (function() {
              const spec = ${JSON.stringify(spec)};
              ${PAGE_SELECTOR_HELPERS}
              const el = findElement(spec);
              const wanted = ${JSON.stringify(state)};
              if (wanted === "detached") return !el || el.isConnected === false;
              if (!el) return wanted === "hidden";
              if (wanted === "attached") return el.isConnected !== false;
              if (wanted === "hidden") return !isVisible(el);
              return isVisible(el);
            })();
          `)
          .catch(() => false);
        return stateOk ? true : null;
      }
      if (typeof params.text === "string") {
        const found = await target
          .executeJavaScript(`
            (function() {
              const wanted = ${JSON.stringify(params.text)}.toLowerCase();
              const body = (document.body && (document.body.innerText || document.body.textContent)) || "";
              return body.toLowerCase().indexOf(wanted) !== -1;
            })();
          `)
          .catch(() => false);
        return found ? true : null;
      }
      if (typeof params.url === "string") {
        return target.getURL().indexOf(params.url) !== -1 ? true : null;
      }
      return null;
    }, timeoutMs);

    if (matched === null) {
      throw new Error(
        `browser_wait_for timed out after ${timeoutMs}ms waiting for ${description}. Current URL: ${target.getURL()}`
      );
    }

    return {
      action: "wait_for",
      tabId: tab.tabId,
      matched: true,
      elapsedMs: Date.now() - startedAt,
      description: `Waited for ${description}`,
      url: target.getURL(),
    };
  }

  public async verifyText(params: {
    text: string;
    selector?: string;
    state?: "visible" | "absent";
    caseSensitive?: boolean;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    found: boolean;
    matched: boolean;
    occurrences: number;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const scope = params.selector ? parseSelectorSpec(params.selector) : null;
    const result = await target
      .executeJavaScript(`
        (function() {
          const spec = ${JSON.stringify(scope)};
          ${PAGE_SELECTOR_HELPERS}
          const wanted = ${JSON.stringify(params.text)};
          const caseSensitive = ${Boolean(params.caseSensitive)};
          const needle = caseSensitive ? wanted : wanted.toLowerCase();
          let root = document;
          if (spec) {
            const el = findElement(spec);
            if (!el) return { found: false, occurrences: 0, scopeMissing: true };
            root = el;
          }
          const source = root === document ? (document.body || document.documentElement) : root;
          const haystack = (source.innerText || source.textContent || "");
          const hay = caseSensitive ? haystack : haystack.toLowerCase();
          let occurrences = 0;
          let idx = hay.indexOf(needle);
          while (idx !== -1) {
            occurrences++;
            idx = hay.indexOf(needle, idx + Math.max(1, needle.length));
          }
          return { found: occurrences > 0, occurrences: occurrences, scopeMissing: false };
        })();
      `)
      .catch(() => ({ found: false, occurrences: 0, scopeMissing: false }));

    const expectAbsent = params.state === "absent";
    const matched = expectAbsent ? !result.found : result.found;
    return {
      action: "verify_text",
      tabId: tab.tabId,
      found: result.found,
      matched,
      occurrences: result.occurrences,
      url: target.getURL(),
    };
  }

  public async find(params: {
    text: string;
    selector?: string;
    limit?: number;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    query: string;
    totalMatches: number;
    matches: Array<{
      ref?: string;
      role?: string;
      tag?: string;
      name?: string;
      rect?: { x: number; y: number; width: number; height: number };
    }>;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const scope = params.selector ? parseSelectorSpec(params.selector) : null;
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));

    const result = await target
      .executeJavaScript(`
        (function() {
          const spec = ${JSON.stringify(scope)};
          const needle = ${JSON.stringify(params.text)}.trim().toLowerCase();
          ${PAGE_SELECTOR_HELPERS}
          if (!needle) return { matches: [], total: 0 };

          const refByElement = new Map();
          const elementMap = window.__constElementMap || {};
          for (const ref in elementMap) {
            try { refByElement.set(elementMap[ref], ref); } catch (e) {}
          }

          const scopeRoot = spec ? findElement(spec) : document.body;
          if (!scopeRoot) return { matches: [], total: 0 };

          const candidates = [];
          const collect = (root) => {
            if (!root || !root.querySelectorAll) return;
            for (const el of Array.from(root.querySelectorAll("*"))) {
              candidates.push(el);
              if (el.shadowRoot) collect(el.shadowRoot);
            }
          };
          collect(scopeRoot);

          const matched = [];
          for (const el of candidates) {
            const label = (el.getAttribute("aria-label") || el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
            if (!label) continue;
            if (label.toLowerCase().indexOf(needle) === -1) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            matched.push(el);
          }

          // Drop ancestors that matched only because a descendant matched.
          const leafMatched = matched.filter((el) => !matched.some((other) => other !== el && el.contains(other)));

          const matches = leafMatched.map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              ref: refByElement.get(el) || undefined,
              role: (el.getAttribute("role") || el.tagName || "").toLowerCase(),
              tag: (el.tagName || "").toLowerCase(),
              name: (el.getAttribute("aria-label") || el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120),
              rect: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              }
            };
          });

          return { matches: matches, total: matches.length };
        })();
      `)
      .catch(() => ({ matches: [] as any[], total: 0 }));

    const all = Array.isArray(result?.matches) ? result.matches : [];
    return {
      action: "find",
      tabId: tab.tabId,
      query: params.text,
      totalMatches: Number(result?.total ?? all.length),
      matches: all.slice(0, limit),
      url: target.getURL(),
    };
  }

  public async hover(params: {
    ref?: string;
    selector?: string;
    x?: number;
    y?: number;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    ref?: string;
    selector?: string;
    x: number;
    y: number;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    let targetX = params.x;
    let targetY = params.y;
    const rawTarget = params.ref || params.selector;

    if (rawTarget) {
      const spec = parseSelectorSpec(rawTarget);
      const pos = await this.resolveElementBox(target, spec);
      if (!pos) {
        throw new Error(
          `Element '${rawTarget}' not found after waiting ${DEFAULT_WAIT_TIMEOUT_MS}ms. Call browser_snapshot to inspect current refs.`
        );
      }
      targetX = pos.x;
      targetY = pos.y;
    }

    if (typeof targetX !== "number" || typeof targetY !== "number") {
      throw new Error(
        "browser_hover requires an element 'ref' (e.g. 'e1'), a 'selector' (e.g. 'text/User menu'), or 'x' and 'y' coordinates."
      );
    }

    this.onAiActionCallback?.({
      type: "hover",
      details: { tabId: tab.tabId, ref: rawTarget, x: targetX, y: targetY },
    });

    await this.ensureCdp(target);
    if (target.debugger.isAttached()) {
      await target.debugger
        .sendCommand("Input.dispatchMouseEvent", { type: "mouseMoved", x: targetX, y: targetY })
        .catch(() => {});
    } else {
      target.sendInputEvent({ type: "mouseMove", x: targetX, y: targetY });
    }

    await new Promise((r) => setTimeout(r, 50));

    return {
      action: "hover",
      tabId: tab.tabId,
      ref: params.ref,
      selector: params.selector,
      x: targetX,
      y: targetY,
      url: target.getURL(),
    };
  }

  public async paste(params: {
    text: string;
    ref?: string;
    selector?: string;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    ref?: string;
    characters: number;
    url: string;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const rawTarget = params.ref || params.selector;
    if (rawTarget) {
      const spec = parseSelectorSpec(rawTarget);
      const focused = await this.focusElement(target, spec, { clearFirst: true });
      if (!focused) {
        throw new Error(
          `Element '${rawTarget}' not found after waiting ${DEFAULT_WAIT_TIMEOUT_MS}ms. Call browser_snapshot to inspect current refs.`
        );
      }
    }

    this.onAiActionCallback?.({
      type: "paste",
      details: { tabId: tab.tabId, ref: rawTarget, characters: params.text.length },
    });

    const wrote = await target
      .executeJavaScript(`
        (function() {
          const text = ${JSON.stringify(params.text)};
          const el = document.activeElement;
          if (!el || el === document.body) return false;
          if (el.isContentEditable) {
            el.textContent = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          if ('value' in el) {
            const proto = Object.getPrototypeOf(el);
            const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setValue) {
              setValue.call(el, text);
            } else {
              el.value = text;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        })();
      `)
      .catch(() => false);

    if (!wrote) {
      await this.ensureCdp(target);
      if (target.debugger.isAttached()) {
        await target.debugger.sendCommand("Input.insertText", { text: params.text });
      } else {
        for (const char of params.text) {
          target.sendInputEvent({ type: "char", keyCode: char });
        }
      }
    }

    return {
      action: "paste",
      tabId: tab.tabId,
      ref: params.ref,
      characters: params.text.length,
      url: target.getURL(),
    };
  }

  public async key(params: {
    key: string;
    modifiers?: string[];
    tabId?: string;
  }): Promise<{ action: string; tabId: string; key: string }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    this.onAiActionCallback?.({ type: "key", details: { ...params, tabId: tab.tabId } });

    await this.ensureCdp(target);

    let cdpKeySuccess = false;
    if (target.debugger.isAttached()) {
      try {
        const modifiers = getCdpModifiers(params.modifiers);
        const code = getCdpCodeForKey(params.key);
        await target.debugger.sendCommand("Input.dispatchKeyEvent", {
          type: "rawKeyDown",
          key: params.key,
          code,
          modifiers,
        });
        if (params.key === "Enter" || params.key === "Return") {
          await target.debugger.sendCommand("Input.dispatchKeyEvent", {
            type: "char",
            text: "\r",
            unmodifiedText: "\r",
            modifiers,
          });
        }
        await new Promise((r) => setTimeout(r, 40));
        await target.debugger.sendCommand("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: params.key,
          code,
          modifiers,
        });
        cdpKeySuccess = true;
      } catch (err) {
        console.warn("[BrowserController] CDP key dispatch failed, falling back to sendInputEvent:", err);
      }
    }

    if (!cdpKeySuccess) {
      const modifiers = (params.modifiers || []) as any;
      target.sendInputEvent({
        type: "keyDown",
        keyCode: params.key,
        modifiers,
      });

      if (params.key === "Enter" || params.key === "Return") {
        target.sendInputEvent({
          type: "char",
          keyCode: "\r",
          modifiers,
        });
      }

      await new Promise((r) => setTimeout(r, 40));

      target.sendInputEvent({
        type: "keyUp",
        keyCode: params.key,
        modifiers,
      });
    }

    return { action: "key", tabId: tab.tabId, key: params.key };
  }

  public async scroll(params: {
    direction?: "up" | "down" | "left" | "right" | "top" | "bottom";
    amount?: number;
    deltaY?: number;
    deltaX?: number;
    ref?: string;
    selector?: string;
    tabId?: string;
  }): Promise<{
    action: string;
    tabId: string;
    scrollX: number;
    scrollY: number;
    scrollHeight: number;
  }> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const rawTarget = params.ref || params.selector;
    const amount = typeof params.amount === "number" ? params.amount : 500;
    let deltaY = typeof params.deltaY === "number" ? params.deltaY : 0;
    let deltaX = typeof params.deltaX === "number" ? params.deltaX : 0;

    if (params.direction === "down") deltaY = amount;
    else if (params.direction === "up") deltaY = -amount;
    else if (params.direction === "right") deltaX = amount;
    else if (params.direction === "left") deltaX = -amount;
    else if (!params.direction && deltaY === 0 && deltaX === 0) deltaY = amount;

    this.onAiActionCallback?.({
      type: "scroll",
      details: { tabId: tab.tabId, direction: params.direction, deltaY, ref: rawTarget },
    });

    if (rawTarget) {
      const spec = parseSelectorSpec(rawTarget);
      await target.executeJavaScript(`
        (function() {
          const spec = ${JSON.stringify(spec)};
          ${PAGE_SELECTOR_HELPERS}
          const el = findElement(spec);
          if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
            if (window.__constHighlightElement) window.__constHighlightElement(el);
          }
        })();
      `);
    } else if (params.direction === "top") {
      await target.executeJavaScript(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    } else if (params.direction === "bottom") {
      await target.executeJavaScript(
        `window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });`
      );
    } else {
      await this.ensureCdp(target);
      if (target.debugger.isAttached() && (deltaX !== 0 || deltaY !== 0)) {
        try {
          await target.debugger.sendCommand("Input.dispatchMouseEvent", {
            type: "mouseWheel",
            x: 200,
            y: 200,
            deltaX,
            deltaY,
          });
        } catch {}
      }
      await target.executeJavaScript(
        `window.scrollBy({ left: ${deltaX}, top: ${deltaY}, behavior: 'instant' });`
      );
    }

    const scrollState = await target.executeJavaScript(`({
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
      scrollHeight: document.documentElement ? document.documentElement.scrollHeight : window.innerHeight
    })`);

    return {
      action: "scroll",
      tabId: tab.tabId,
      scrollX: scrollState?.scrollX ?? 0,
      scrollY: scrollState?.scrollY ?? 0,
      scrollHeight: scrollState?.scrollHeight ?? 0,
    };
  }

  /**
   * Remove stale browser captures so page screenshots do not pile up on disk.
   * Runs at most once per minute.
   */
  private pruneOldScreenshots(): void {
    const now = Date.now();
    if (now - this.lastScreenshotPruneAt < 60_000) return;
    this.lastScreenshotPruneAt = now;
    try {
      const tmp = os.tmpdir();
      for (const entry of fs.readdirSync(tmp)) {
        if (!entry.startsWith(SCREENSHOT_FILE_PREFIX)) continue;
        const full = path.join(tmp, entry);
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) continue;
          if (now - stat.mtimeMs < SCREENSHOT_RETENTION_MS) continue;
          fs.unlinkSync(full);
        } catch {}
      }
    } catch {}
  }

  public async screenshot(params?: {
    annotate?: boolean;
    quality?: number;
    format?: "jpeg" | "png";
    ref?: string;
    selector?: string;
    tabId?: string;
  }): Promise<{
    tabId: string;
    base64: string;
    dataUrl: string;
    mimeType: string;
    filePath: string;
    width: number;
    height: number;
    url: string;
    title: string;
    legend: string;
  }> {
    const tab = await this.ensureTargetTab({ tabId: params?.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const rawTarget = params?.ref || params?.selector;
    if (rawTarget) {
      const spec = parseSelectorSpec(rawTarget);
      await target
        .executeJavaScript(`
          (function() {
            const spec = ${JSON.stringify(spec)};
            ${PAGE_SELECTOR_HELPERS}
            const el = findElement(spec);
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
          })();
        `)
        .catch(() => {});
    }

    const shouldAnnotate = params?.annotate !== false;
    let annotationToken = "";
    let annotationTargets: ScreenshotAnnotationTarget[] = [];

    if (shouldAnnotate) {
      try {
        const snap = await this.snapshot({ tabId: tab.tabId });
        annotationTargets = snap.elements
          .filter(
            (e) =>
              e.rect.width > 4 &&
              e.rect.height > 4 &&
              e.rect.x >= 0 &&
              e.rect.y >= 0 &&
              e.rect.y <= (snap.viewport?.height ?? 1080)
          )
          .slice(0, 50)
          .map((e) => ({
            ref: e.ref,
            role: e.role || e.tag,
            name: e.name,
            x: e.rect.x,
            y: e.rect.y,
            width: e.rect.width,
            height: e.rect.height,
          }));

        if (annotationTargets.length > 0) {
          annotationToken = `const-shot-${crypto.randomUUID()}`;
          await target.executeJavaScript(
            buildInstallAnnotationOverlayScript(annotationToken, annotationTargets)
          );
          await new Promise((r) => setTimeout(r, 40));
        }
      } catch {}
    }

    let image: Electron.NativeImage | null = null;
    try {
      await this.ensureCdp(target);
      if (target.debugger.isAttached()) {
        try {
          const cdpFormat = params?.format === "png" ? "png" : "jpeg";
          const quality = Math.max(10, Math.min(100, Math.round(params?.quality ?? 80)));
          const res = (await target.debugger.sendCommand("Page.captureScreenshot", {
            format: cdpFormat,
            quality: cdpFormat === "jpeg" ? quality : undefined,
            fromSurface: true,
          })) as { data: string };
          if (res && res.data) {
            image = nativeImage.createFromBuffer(Buffer.from(res.data, "base64"));
          }
        } catch (cdpErr) {
          console.warn("[BrowserController] CDP captureScreenshot failed, falling back to capturePage:", cdpErr);
        }
      }

      if (!image) {
        image = await target.capturePage();
      }
    } finally {
      if (annotationToken && !target.isDestroyed()) {
        await target
          .executeJavaScript(buildRemoveAnnotationOverlayScript(annotationToken))
          .catch(() => {});
      }
    }

    const originalSize = image.getSize();
    if (originalSize.width > 1280) {
      image = image.resize({ width: 1280 });
    }
    const finalSize = image.getSize();
    const format = params?.format === "png" ? "png" : "jpeg";
    const quality = Math.max(10, Math.min(100, Math.round(params?.quality ?? 80)));

    const buffer = format === "png" ? image.toPNG() : image.toJPEG(quality);
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const ext = format === "png" ? "png" : "jpg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const filePath = path.join(
      os.tmpdir(),
      `const-browser-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    );
    await fs.promises.writeFile(filePath, buffer).catch(() => {});
    this.pruneOldScreenshots();

    const legend = formatScreenshotLegend(annotationTargets);

    this.onAiActionCallback?.({
      type: "screenshot",
      details: {
        tabId: tab.tabId,
        width: finalSize.width,
        height: finalSize.height,
        filePath,
        url: target.getURL(),
      },
    });

    return {
      tabId: tab.tabId,
      base64,
      dataUrl,
      mimeType,
      filePath,
      width: finalSize.width,
      height: finalSize.height,
      url: target.getURL(),
      title: target.getTitle(),
      legend,
    };
  }

  public async evaluate(params: {
    script?: string;
    steps?: Array<{
      action: "navigate" | "click" | "type" | "key" | "scroll" | "wait" | "select";
      url?: string;
      ref?: string;
      selector?: string;
      text?: string;
      key?: string;
      submit?: boolean;
      clear?: boolean;
      direction?: "up" | "down" | "left" | "right" | "top" | "bottom";
      amount?: number;
      value?: string;
      ms?: number;
    }>;
    tabId?: string;
  }): Promise<any> {
    this.assertBotMayAct();
    const tab = await this.ensureTargetTab({ tabId: params.tabId });
    const target = tab.contents;
    tab.lastUsedAt = Date.now();

    const stepResults: any[] = [];
    if (Array.isArray(params.steps) && params.steps.length > 0) {
      for (const step of params.steps) {
        this.assertBotMayAct();
        switch (step.action) {
          case "navigate":
            if (step.url) {
              stepResults.push(await this.navigate(step.url, { tabId: tab.tabId }));
            }
            break;
          case "click":
            stepResults.push(
              await this.click({
                ref: step.ref,
                selector: step.selector,
                tabId: tab.tabId,
              })
            );
            break;
          case "type":
            stepResults.push(
              await this.type({
                ref: step.ref,
                selector: step.selector,
                text: step.text ?? "",
                clearFirst: step.clear !== false,
                submit: step.submit,
                tabId: tab.tabId,
              })
            );
            break;
          case "key":
            if (step.key) {
              stepResults.push(await this.key({ key: step.key, tabId: tab.tabId }));
            }
            break;
          case "scroll":
            stepResults.push(
              await this.scroll({
                direction: step.direction,
                amount: step.amount,
                ref: step.ref,
                selector: step.selector,
                tabId: tab.tabId,
              })
            );
            break;
          case "select": {
            const rawTarget = step.ref || step.selector;
            if (rawTarget && step.value !== undefined) {
              const spec = parseSelectorSpec(rawTarget);
              const selected = await target.executeJavaScript(`
                (function() {
                  const spec = ${JSON.stringify(spec)};
                  const wanted = ${JSON.stringify(String(step.value))};
                  ${PAGE_SELECTOR_HELPERS}
                  const el = findElement(spec);
                  if (!el || el.tagName !== "SELECT") throw new Error("Target is not a <select> element");
                  const options = Array.from(el.options);
                  const match = options.find(o => o.value === wanted || o.label === wanted || (o.text || '').trim() === wanted);
                  if (!match) throw new Error("Option not found: " + wanted);
                  el.selectedIndex = match.index;
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                  return match.value;
                })()
              `);
              stepResults.push({ action: "select", ref: rawTarget, selected });
            }
            break;
          }
          case "wait": {
            const waitMs = Math.min(10000, Math.max(50, step.ms ?? 500));
            if (step.selector || step.ref) {
              const spec = parseSelectorSpec((step.ref || step.selector)!);
              const deadline = Date.now() + waitMs;
              let found = false;
              while (Date.now() <= deadline) {
                found = await target.executeJavaScript(`
                  (function() {
                    const spec = ${JSON.stringify(spec)};
                    ${PAGE_SELECTOR_HELPERS}
                    return Boolean(findElement(spec));
                  })()
                `);
                if (found) break;
                await new Promise((r) => setTimeout(r, 100));
              }
              stepResults.push({ action: "wait", target: step.ref || step.selector, found });
            } else {
              await new Promise((r) => setTimeout(r, waitMs));
              stepResults.push({ action: "wait", ms: waitMs });
            }
            break;
          }
        }
      }
    }

    let evalOutput: any = undefined;
    if (params.script && params.script.trim()) {
      this.onAiActionCallback?.({
        type: "evaluate",
        details: { tabId: tab.tabId },
      });
      const wrappedScript = `(async function() {
        try {
          ${PAGE_SELECTOR_HELPERS}
          const __fn = async () => { ${params.script.includes("return ") ? params.script : `return (${params.script});`} };
          const val = await __fn();
          return { ok: true, value: val };
        } catch (err) {
          return { ok: false, error: err && err.message ? err.message : String(err), stack: err && err.stack ? err.stack : undefined };
        }
      })()`;
      const env = await target.executeJavaScript(wrappedScript);
      if (env && env.ok === false) {
        throw new Error(`Page evaluate error: ${env.error}`);
      }
      evalOutput = env?.value;
    }

    return {
      tabId: tab.tabId,
      url: target.getURL(),
      title: target.getTitle(),
      stepsExecuted: stepResults.length > 0 ? stepResults : undefined,
      result: evalOutput,
    };
  }

  public async readConsoleAndNetwork(params?: {
    level?: BrowserConsoleLevel | "all";
    includeNetwork?: boolean;
    onlyFailedNetwork?: boolean;
    clear?: boolean;
    limit?: number;
    tabId?: string;
  }) {
    const tab = await this.ensureTargetTab({ tabId: params?.tabId });
    tab.lastUsedAt = Date.now();
    return await tab.telemetry.readTelemetry(tab.contents, params);
  }

  // ---------------------------------------------------------------------------
  // Visual AI Cursor Overlay Injection
  // ---------------------------------------------------------------------------

  private injectAiCursorOverlay(target: WebContents) {
    if (target.isDestroyed()) return;

    const overlayCode = `
      (function() {
        if (window.__constOverlayInjected) return;
        window.__constOverlayInjected = true;

        const cursorContainer = document.createElement('div');
        cursorContainer.id = '__const_ai_cursor_overlay';
        cursorContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;';
        
        const pointer = document.createElement('div');
        pointer.id = '__const_ai_pointer';
        pointer.style.cssText = 'position:absolute;width:16px;height:16px;background:#3b82f6;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.9);transform:translate(-50%,-50%);transition:top 0.18s cubic-bezier(0.16,1,0.3,1), left 0.18s cubic-bezier(0.16,1,0.3,1), transform 0.15s ease;display:none;';
        
        const badge = document.createElement('span');
        badge.innerText = 'AI';
        badge.style.cssText = 'position:absolute;top:-18px;left:14px;background:#1e1b4b;color:#93c5fd;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;border:1px solid #3b82f6;font-family:sans-serif;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
        pointer.appendChild(badge);

        cursorContainer.appendChild(pointer);
        document.documentElement.appendChild(cursorContainer);

        window.__constShowClickRipple = function(x, y) {
          pointer.style.left = x + 'px';
          pointer.style.top = y + 'px';
          pointer.style.display = 'block';

          const ripple = document.createElement('div');
          ripple.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:10px;height:10px;border-radius:50%;border:2px solid #60a5fa;transform:translate(-50%,-50%) scale(1);animation:constRipple 0.5s ease-out forwards;pointer-events:none;';
          cursorContainer.appendChild(ripple);

          setTimeout(() => {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
          }, 500);
        };

        window.__constHighlightElement = function(el) {
          if (!el) return;
          const prevOutline = el.style.outline;
          el.style.outline = '2px solid #3b82f6';
          el.style.outlineOffset = '2px';
          setTimeout(() => {
            el.style.outline = prevOutline;
          }, 1200);
        };

        const style = document.createElement('style');
        style.innerText = '@keyframes constRipple { 0% { transform:translate(-50%,-50%) scale(1); opacity:1; } 100% { transform:translate(-50%,-50%) scale(4.5); opacity:0; } }';
        document.head.appendChild(style);
      })();
    `;

    target.executeJavaScript(overlayCode).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Agent Tool Dispatcher
  // ---------------------------------------------------------------------------

  public async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<{ result: any; isError: boolean }> {
    const norm = toolName.toLowerCase().replace(/[-_]/g, "");
    try {
      if (norm === "browsertabs") {
        if (args.tabId) {
          this.setActiveTab(String(args.tabId));
        }
        const tabs = this.listTabs();
        return {
          result: JSON.stringify(
            {
              activeTabId: this.activeTabId,
              totalTabs: tabs.length,
              tabs,
            },
            null,
            2
          ),
          isError: false,
        };
      }

      if (norm === "browsernavigate") {
        const url = args.url || args.target;
        if (typeof url === "string" && /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url)) {
          return {
            result: "Error: browser_navigate only loads http:// and https:// pages. Local files (file://) and other schemes are blocked so the browser cannot be used to bypass the workspace file sandbox — use the read tool for local files, and the 'computer_*' tools for desktop applications.",
            isError: true,
          };
        }
        if (url === "tabs") {
          return {
            result: JSON.stringify({ activeTabId: this.activeTabId, tabs: this.listTabs() }, null, 2),
            isError: false,
          };
        }
        if (!url) {
          return {
            result: "Error: Missing 'url' parameter for browser_navigate.",
            isError: true,
          };
        }
        if (url === "back") {
          this.assertBotMayAct();
          const target = this.getActiveWebContents(args.tabId);
          if (!target || !target.canGoBack()) {
            return { result: "Cannot go back: history is empty.", isError: true };
          }
          target.goBack();
          return { result: "Navigated back.", isError: false };
        }
        if (url === "forward") {
          this.assertBotMayAct();
          const target = this.getActiveWebContents(args.tabId);
          if (!target || !target.canGoForward()) {
            return { result: "Cannot go forward: history is empty.", isError: true };
          }
          target.goForward();
          return { result: "Navigated forward.", isError: false };
        }
        if (url === "reload") {
          this.assertBotMayAct();
          const target = this.getActiveWebContents(args.tabId);
          if (!target) {
            return { result: "No active browser tab to reload.", isError: true };
          }
          target.reload();
          return { result: "Page reloaded.", isError: false };
        }
        const res = await this.navigate(url, {
          tabId: args.tabId,
          newTab: Boolean(args.newTab),
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browsersnapshot") {
        const res = await this.snapshot({
          selector: args.selector,
          interactive: args.interactive,
          compact: args.compact,
          urls: args.urls,
          diff: args.diff,
          depth: args.depth,
          boxes: args.boxes,
          tabId: args.tabId,
        });
        return { result: res.textSummary || JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserclick") {
        const res = await this.click({
          ref: args.ref,
          selector: args.selector,
          x: args.x,
          y: args.y,
          button: args.button,
          clickCount: args.clickCount,
          tabId: args.tabId,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browsertype") {
        const res = await this.type({
          text: args.text ?? "",
          ref: args.ref,
          selector: args.selector,
          clearFirst: args.clearFirst ?? args.clear !== false,
          submit: args.submit ?? false,
          tabId: args.tabId,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserkey" || norm === "browserpresskey") {
        const res = await this.key({
          key: args.key,
          modifiers: args.modifiers,
          tabId: args.tabId,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserscroll") {
        const res = await this.scroll({
          direction: args.direction,
          amount: args.amount,
          deltaX: args.deltaX,
          deltaY: args.deltaY,
          ref: args.ref,
          selector: args.selector,
          tabId: args.tabId,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserscreenshot") {
        const res = await this.screenshot({
          annotate: args.annotate !== false,
          quality: args.quality,
          format: args.format,
          ref: args.ref,
          selector: args.selector,
          tabId: args.tabId,
        });
        const lines = [
          `### Browser Screenshot Captured`,
          `- **Tab**: \`${res.tabId}\``,
          `- **URL**: ${res.url}`,
          `- **Dimensions**: ${res.width}x${res.height}px (${res.mimeType})`,
          `- **Saved File**: \`${res.filePath}\` (can also be inspected with the \`read\` tool)`,
          res.legend ? `\n${res.legend}` : "",
        ].filter(Boolean);
        return {
          result: lines.join("\n"),
          isError: false,
        };
      }

      if (norm === "browserconsole" || norm === "browserdiagnostics") {
        const res = await this.readConsoleAndNetwork({
          level: args.level,
          includeNetwork: args.includeNetwork ?? true,
          onlyFailedNetwork: args.onlyFailedNetwork ?? false,
          clear: args.clear ?? false,
          limit: args.limit ?? 50,
          tabId: args.tabId,
        });
        return {
          result: JSON.stringify(res, null, 2),
          isError: false,
        };
      }

      if (norm === "browserevaluate" || norm === "browserrun" || norm === "browserbatch") {
        const res = await this.evaluate({
          script: args.script || args.code,
          steps: args.steps,
          tabId: args.tabId,
        });
        return {
          result: JSON.stringify(res, null, 2),
          isError: false,
        };
      }

      if (norm === "browserwaitfor" || norm === "browserwait") {
        const res = await this.waitFor({
          selector: args.selector,
          ref: args.ref,
          state: args.state,
          text: args.text,
          url: args.url,
          timeMs: args.timeMs,
          timeoutMs: args.timeoutMs,
          tabId: args.tabId,
        });
        return {
          result: JSON.stringify(res, null, 2),
          isError: false,
        };
      }

      if (norm === "browserverifytext" || norm === "browserverify") {
        const res = await this.verifyText({
          text: args.text,
          selector: args.selector,
          state: args.state,
          caseSensitive: args.caseSensitive,
          tabId: args.tabId,
        });
        const expectation = res.matched ? "PASS" : "FAIL";
        const lines = [
          `### Browser Text Verification — ${expectation}`,
          `- **Tab**: \`${res.tabId}\``,
          `- **URL**: ${res.url}`,
          `- **Text**: ${JSON.stringify(args.text)}`,
          `- **Expected**: ${args.state === "absent" ? "absent from page" : "visible on page"}`,
          `- **Occurrences**: ${res.occurrences}`,
          `- **Result**: ${expectation}`,
        ];
        return {
          result: lines.join("\n"),
          isError: !res.matched,
        };
      }

      if (norm === "browserfind" || norm === "browserfindtext") {
        const res = await this.find({
          text: args.text || args.query,
          selector: args.selector,
          limit: args.limit,
          tabId: args.tabId,
        });
        const lines = [
          `### Browser Find — "${res.query}"`,
          `- **Tab**: \`${res.tabId}\``,
          `- **URL**: ${res.url}`,
          `- **Matches**: ${res.totalMatches}${res.totalMatches > res.matches.length ? ` (showing first ${res.matches.length})` : ""}`,
          ...res.matches.map((m) =>
            `- ${m.ref ? `[${m.ref}] ` : ""}${m.role}${m.name ? ` "${m.name}"` : ""}${m.rect ? ` @(${m.rect.x},${m.rect.y} ${m.rect.width}x${m.rect.height})` : ""}`
          ),
        ];
        return {
          result: lines.join("\n"),
          isError: res.totalMatches === 0,
        };
      }

      if (norm === "browserhover") {
        const res = await this.hover({
          ref: args.ref,
          selector: args.selector,
          x: args.x,
          y: args.y,
          tabId: args.tabId,
        });
        return {
          result: JSON.stringify(res, null, 2),
          isError: false,
        };
      }

      if (norm === "browserpaste") {
        const res = await this.paste({
          text: args.text,
          ref: args.ref,
          selector: args.selector,
          tabId: args.tabId,
        });
        return {
          result: JSON.stringify(res, null, 2),
          isError: false,
        };
      }

      if (norm === "browserrequesthelp") {
        const reason = args.reason || "The assistant needs human intervention.";
        const secretWanted = args.secretWanted || args.secretName;
        const targetRef = args.ref || args.targetRef;
        if (secretWanted) {
          this.requestSecret(secretWanted, targetRef);
        } else {
          this.requestHelp(reason);
        }
        const waitOutcome = await this.waitForHumanHelpResolution(
          typeof args.timeoutMs === "number" ? args.timeoutMs : 5 * 60 * 1000
        );
        return {
          result: waitOutcome.message,
          isError: waitOutcome.status === "timeout",
        };
      }

      return { result: `Unknown browser tool: '${toolName}'`, isError: true };
    } catch (err: any) {
      return {
        result: `Browser tool error (${toolName}): ${err?.message || String(err)}`,
        isError: true,
      };
    }
  }
}

export const browserController = new BrowserController();
