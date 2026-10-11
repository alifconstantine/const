import { webContents, type WebContents } from "electron";

export interface ControlState {
  holder: "bot" | "human";
  since: string;
  requested: boolean;
  requestedAt?: string;
  reason?: string;
  secretWanted?: string;
  secretRef?: string;
  secretSnapshotId?: number;
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
  url: string;
  title: string;
  elements: SnapshotElement[];
  textSummary: string;
}

export const HELP_REQUEST_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class BrowserController {
  private controlState: ControlState = {
    holder: "bot",
    since: new Date().toISOString(),
    requested: false,
  };

  private registeredTabs = new Map<string, { guestContentsId: number; contents: WebContents }>();
  private activeTabId: string | null = null;
  private snapshotCounter = 0;
  private onStateChangeCallback?: (state: ControlState) => void;
  private onAiActionCallback?: (action: { type: string; details?: any }) => void;
  private onTabOpenRequestCallback?: (url: string) => Promise<string | null>;

  constructor(options?: {
    onStateChange?: (state: ControlState) => void;
    onAiAction?: (action: { type: string; details?: any }) => void;
    onTabOpenRequest?: (url: string) => Promise<string | null>;
  }) {
    if (options?.onStateChange) this.onStateChangeCallback = options.onStateChange;
    if (options?.onAiAction) this.onAiActionCallback = options.onAiAction;
    if (options?.onTabOpenRequest) this.onTabOpenRequestCallback = options.onTabOpenRequest;
  }

  public setCallbacks(callbacks: {
    onStateChange?: (state: ControlState) => void;
    onAiAction?: (action: { type: string; details?: any }) => void;
    onTabOpenRequest?: (url: string) => Promise<string | null>;
  }) {
    if (callbacks.onStateChange) this.onStateChangeCallback = callbacks.onStateChange;
    if (callbacks.onAiAction) this.onAiActionCallback = callbacks.onAiAction;
    if (callbacks.onTabOpenRequest) this.onTabOpenRequestCallback = callbacks.onTabOpenRequest;
  }

  public registerWebview(tabId: string, guestContentsId: number) {
    const contents = webContents.fromId(guestContentsId);
    if (!contents || contents.isDestroyed()) {
      console.warn(`[BrowserController] Could not find WebContents with ID ${guestContentsId}`);
      return;
    }
    this.registeredTabs.set(tabId, { guestContentsId, contents });
    if (!this.activeTabId) {
      this.activeTabId = tabId;
    }
    console.log(`[BrowserController] Registered webview for tab ${tabId} (webContentsId: ${guestContentsId})`);

    // Inject visual cursor styles once attached
    this.injectAiCursorOverlay(contents);
  }

  public unregisterWebview(tabId: string) {
    this.registeredTabs.delete(tabId);
    if (this.activeTabId === tabId) {
      const nextKey = this.registeredTabs.keys().next().value;
      this.activeTabId = nextKey || null;
    }
  }

  public setActiveTab(tabId: string) {
    this.activeTabId = tabId;
  }

  public getActiveWebContents(): WebContents | null {
    if (this.activeTabId) {
      const reg = this.registeredTabs.get(this.activeTabId);
      if (reg && !reg.contents.isDestroyed()) {
        return reg.contents;
      }
    }
    // Fallback: get the first valid registered tab
    for (const [id, reg] of this.registeredTabs.entries()) {
      if (!reg.contents.isDestroyed()) {
        this.activeTabId = id;
        return reg.contents;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Control State Machine ("Who has the wheel")
  // ---------------------------------------------------------------------------

  public getControl(): ControlState {
    // Drop unanswered request if older than HELP_REQUEST_TTL_MS (OpenBot pattern)
    // Only drop if holder is bot; a human actively driving is never timed out from under them
    if (
      this.controlState.requested &&
      this.controlState.holder === "bot" &&
      this.controlState.requestedAt &&
      Date.now() - Date.parse(this.controlState.requestedAt) > HELP_REQUEST_TTL_MS
    ) {
      this.controlState = {
        ...this.controlState,
        requested: false,
        requestedAt: undefined,
        reason: undefined,
        secretWanted: undefined,
        secretRef: undefined,
        secretSnapshotId: undefined,
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
    if (this.controlState.holder === "human") {
      throw new Error("A person has control of the computer right now. Wait for them to hand it back before acting.");
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
    });
    return this.getControl();
  }

  public requestHelp(reason: string): ControlState {
    const safeReason = typeof reason === "string" && reason.trim()
      ? reason.trim().slice(0, 500)
      : "The assistant needs a person to continue (e.g. solve CAPTCHA or confirm action).";
    this.updateControl({
      requested: true,
      requestedAt: new Date().toISOString(),
      reason: safeReason,
    });
    return this.getControl();
  }

  public requestSecret(label: string, ref?: string): ControlState {
    const safeLabel = typeof label === "string" && label.trim()
      ? label.trim().slice(0, 200)
      : "password or authentication secret";
    this.updateControl({
      requested: true,
      requestedAt: new Date().toISOString(),
      secretWanted: safeLabel,
      secretRef: ref,
      secretSnapshotId: this.snapshotCounter,
      reason: `The assistant needs you to enter ${safeLabel}.`,
    });
    return this.getControl();
  }

  public async supplySecret(text: string): Promise<{ success: boolean; characters: number }> {
    const target = this.getActiveWebContents();
    if (!target) {
      throw new Error("No active browser window found to enter secret.");
    }
    const secretRef = this.controlState.secretRef;

    // Type the secret directly into the element or focused input via DOM execution
    await target.executeJavaScript(`
      (function() {
        const ref = ${JSON.stringify(secretRef)};
        let targetEl = null;
        if (ref && window.__constElementMap && window.__constElementMap[ref]) {
          targetEl = window.__constElementMap[ref];
        } else {
          targetEl = document.activeElement || document.querySelector('input[type="password"], input');
        }
        if (targetEl) {
          targetEl.focus();
          const proto = Object.getPrototypeOf(targetEl);
          const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setValue) {
            setValue.call(targetEl, ${JSON.stringify(text)});
          } else {
            targetEl.value = ${JSON.stringify(text)};
          }
          targetEl.dispatchEvent(new Event('input', { bubbles: true }));
          targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })();
    `);

    const charCount = text.length;
    // Clear the secret request
    this.updateControl({
      requested: false,
      secretWanted: undefined,
      secretRef: undefined,
      secretSnapshotId: undefined,
    });
    return { success: true, characters: charCount };
  }

  // ---------------------------------------------------------------------------
  // Browser Driver Operations
  // ---------------------------------------------------------------------------

  public async navigate(url: string): Promise<{ url: string; title: string }> {
    this.assertBotMayAct();

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://") && !cleanUrl.startsWith("file://")) {
      cleanUrl = `https://${cleanUrl}`;
    }

    let target = this.getActiveWebContents();
    if (!target && this.onTabOpenRequestCallback) {
      const newTabId = await this.onTabOpenRequestCallback(cleanUrl);
      if (newTabId) {
        // Wait a brief moment for webview registration
        await new Promise((r) => setTimeout(r, 600));
        target = this.getActiveWebContents();
      }
    }

    if (!target) {
      throw new Error("No browser tab is currently open in the desktop app.");
    }

    this.onAiActionCallback?.({ type: "navigate", details: { url: cleanUrl } });

    await target.loadURL(cleanUrl);

    // Wait until DOM is ready
    await new Promise((resolve) => {
      if (target?.isLoading()) {
        const onFinish = () => {
          target?.removeListener("did-finish-load", onFinish);
          target?.removeListener("did-fail-load", onFinish);
          resolve(true);
        };
        target.once("did-finish-load", onFinish);
        target.once("did-fail-load", onFinish);
        setTimeout(resolve, 8000); // 8s safety timeout
      } else {
        resolve(true);
      }
    });

    this.injectAiCursorOverlay(target);

    return {
      url: target.getURL(),
      title: target.getTitle(),
    };
  }

  public async snapshot(): Promise<SnapshotResult> {
    const target = this.getActiveWebContents();
    if (!target) {
      throw new Error("No browser tab is currently open. Please navigate to a URL first.");
    }

    this.snapshotCounter++;
    this.injectAiCursorOverlay(target);

    const script = `
      (function() {
        const snapshotId = ${this.snapshotCounter};
        window.__constElementMap = window.__constElementMap || {};
        window.__constElementMap = {}; // Reset for current snapshot

        const actionableSelectors = [
          'a[href]', 'button', 'input', 'select', 'textarea',
          '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
          '[role="tab"]', '[role="menuitem"]', '[role="option"]', '[role="switch"]',
          '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
          'h1', 'h2', 'h3', 'p', 'summary'
        ];

        const allNodes = document.querySelectorAll(actionableSelectors.join(','));
        const elements = [];
        let counter = 1;

        function isVisible(el) {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }

        function getAccessibleName(el) {
          return (
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.getAttribute('placeholder') ||
            el.innerText ||
            el.value ||
            el.getAttribute('alt') ||
            ''
          ).trim().replace(/\\s+/g, ' ').slice(0, 80);
        }

        allNodes.forEach((el) => {
          if (!isVisible(el)) return;
          const rect = el.getBoundingClientRect();
          const ref = 'e' + counter++;
          window.__constElementMap[ref] = el;

          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || tag;
          const name = getAccessibleName(el);

          elements.push({
            ref,
            tag,
            role,
            name,
            type: el.type || undefined,
            placeholder: el.placeholder || undefined,
            value: el.value ? String(el.value).slice(0, 50) : undefined,
            checked: typeof el.checked === 'boolean' ? el.checked : undefined,
            disabled: el.disabled || undefined,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            selector: el.id ? '#' + el.id : tag + (name ? '[text="' + name.slice(0, 20) + '"]' : '')
          });
        });

        const lines = elements.slice(0, 120).map(e => {
          let desc = '[' + e.ref + '] ' + e.role;
          if (e.name) desc += ' "' + e.name + '"';
          if (e.placeholder && e.placeholder !== e.name) desc += ' placeholder="' + e.placeholder + '"';
          if (e.value) desc += ' value="' + e.value + '"';
          if (e.checked !== undefined) desc += ' checked=' + e.checked;
          if (e.disabled) desc += ' (disabled)';
          return desc;
        });

        if (elements.length > 120) {
          lines.push('... and ' + (elements.length - 120) + ' more elements (scroll down to reveal more)');
        }

        return {
          snapshotId,
          url: window.location.href,
          title: document.title,
          elements,
          textSummary: lines.join('\\n')
        };
      })();
    `;

    const result = await target.executeJavaScript(script);
    return result as SnapshotResult;
  }

  public async click(params: {
    ref?: string;
    x?: number;
    y?: number;
    button?: "left" | "right" | "middle";
    clickCount?: number;
  }): Promise<{ action: string; ref?: string; x: number; y: number; url: string }> {
    this.assertBotMayAct();
    const target = this.getActiveWebContents();
    if (!target) throw new Error("No browser tab is currently open.");

    let targetX = params.x;
    let targetY = params.y;

    if (params.ref) {
      const getPosScript = `
        (function() {
          const el = window.__constElementMap ? window.__constElementMap[${JSON.stringify(params.ref)}] : null;
          if (!el) return null;
          el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
          const rect = el.getBoundingClientRect();
          return {
            x: Math.round(rect.x + rect.width / 2),
            y: Math.round(rect.y + rect.height / 2)
          };
        })();
      `;
      const pos = await target.executeJavaScript(getPosScript);
      if (!pos) {
        throw new Error(`Element ref ${params.ref} not found on page. Take a new snapshot.`);
      }
      targetX = pos.x;
      targetY = pos.y;
    }

    if (typeof targetX !== "number" || typeof targetY !== "number") {
      throw new Error("Click requires either a valid element ref or x, y coordinates.");
    }

    this.onAiActionCallback?.({
      type: "click",
      details: { ref: params.ref, x: targetX, y: targetY },
    });

    // Visual ripple effect inside webview
    await target.executeJavaScript(`
      if (window.__constShowClickRipple) {
        window.__constShowClickRipple(${targetX}, ${targetY});
      }
    `);

    // Dispatch native mouse events
    const button = params.button || "left";
    const clickCount = params.clickCount || 1;

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

    await new Promise((r) => setTimeout(r, 60));

    target.sendInputEvent({
      type: "mouseUp",
      x: targetX,
      y: targetY,
      button,
      clickCount,
    });

    return {
      action: "click",
      ref: params.ref,
      x: targetX,
      y: targetY,
      url: target.getURL(),
    };
  }

  public async type(params: {
    ref?: string;
    text: string;
    submit?: boolean;
    clearFirst?: boolean;
  }): Promise<{ action: string; ref?: string; characters: number; submitted: boolean; url: string }> {
    this.assertBotMayAct();
    const target = this.getActiveWebContents();
    if (!target) throw new Error("No browser tab is currently open.");

    if (params.ref) {
      // Focus and optionally clear target element (React-friendly clearing via prototype descriptor)
      const focusScript = `
        (function() {
          const el = window.__constElementMap ? window.__constElementMap[${JSON.stringify(params.ref)}] : null;
          if (!el) return false;
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
          el.focus();
          if (${params.clearFirst !== false}) {
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
              el.innerText = '';
            }
          }
          if (window.__constHighlightElement) {
            window.__constHighlightElement(el);
          }
          return true;
        })();
      `;
      const focused = await target.executeJavaScript(focusScript);
      if (!focused) {
        throw new Error(`Element ref ${params.ref} not found on page. Take a new snapshot.`);
      }
    }

    this.onAiActionCallback?.({
      type: "type",
      details: { ref: params.ref, characters: params.text.length },
    });

    // Insert text cleanly into the focused field
    for (const char of params.text) {
      target.sendInputEvent({
        type: "char",
        keyCode: char,
      });
      await new Promise((r) => setTimeout(r, 12));
    }

    if (params.submit) {
      await new Promise((r) => setTimeout(r, 100));
      target.sendInputEvent({ type: "keyDown", keyCode: "Return" });
      target.sendInputEvent({ type: "keyUp", keyCode: "Return" });
    }

    return {
      action: "type",
      ref: params.ref,
      characters: params.text.length,
      submitted: Boolean(params.submit),
      url: target.getURL(),
    };
  }

  public async key(params: { key: string; modifiers?: string[] }): Promise<{ action: string; key: string }> {
    this.assertBotMayAct();
    const target = this.getActiveWebContents();
    if (!target) throw new Error("No browser tab is currently open.");

    this.onAiActionCallback?.({ type: "key", details: params });

    target.sendInputEvent({
      type: "keyDown",
      keyCode: params.key,
      modifiers: (params.modifiers || []) as any,
    });

    await new Promise((r) => setTimeout(r, 40));

    target.sendInputEvent({
      type: "keyUp",
      keyCode: params.key,
      modifiers: (params.modifiers || []) as any,
    });

    return { action: "key", key: params.key };
  }

  public async scroll(params: { deltaY?: number; deltaX?: number; ref?: string }): Promise<{ action: string; deltaY: number }> {
    this.assertBotMayAct();
    const target = this.getActiveWebContents();
    if (!target) throw new Error("No browser tab is currently open.");

    const deltaY = typeof params.deltaY === "number" ? params.deltaY : 500;
    const deltaX = typeof params.deltaX === "number" ? params.deltaX : 0;

    if (params.ref) {
      await target.executeJavaScript(`
        (function() {
          const el = window.__constElementMap ? window.__constElementMap[${JSON.stringify(params.ref)}] : null;
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        })();
      `);
    } else {
      target.sendInputEvent({
        type: "mouseWheel",
        x: 400,
        y: 400,
        deltaX,
        deltaY,
      });
    }

    return { action: "scroll", deltaY };
  }

  public async screenshot(params?: { fullPage?: boolean }): Promise<{ base64: string; width: number; height: number; url: string }> {
    const target = this.getActiveWebContents();
    if (!target) throw new Error("No browser tab is currently open.");

    const image = await target.capturePage();
    const size = image.getSize();
    const base64 = image.toPNG().toString("base64");

    return {
      base64,
      width: size.width,
      height: size.height,
      url: target.getURL(),
    };
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

        // Add ripple animation
        const style = document.createElement('style');
        style.innerText = '@keyframes constRipple { 0% { transform:translate(-50%,-50%) scale(1); opacity:1; } 100% { transform:translate(-50%,-50%) scale(4.5); opacity:0; } }';
        document.head.appendChild(style);
      })();
    `;

    target.executeJavaScript(overlayCode).catch(() => {});
  }

  public async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<{ result: any; isError: boolean }> {
    const norm = toolName.toLowerCase().replace(/[-_]/g, "");
    try {
      if (norm === "browsernavigate") {
        const url = args.url || args.target;
        if (!url) {
          return { result: "Error: Missing 'url' parameter for browser_navigate.", isError: true };
        }
        if (url === "back") {
          const target = this.getActiveWebContents();
          if (!target || !target.canGoBack()) return { result: "Cannot go back: history is empty.", isError: true };
          target.goBack();
          return { result: "Navigated back.", isError: false };
        }
        if (url === "forward") {
          const target = this.getActiveWebContents();
          if (!target || !target.canGoForward()) return { result: "Cannot go forward: history is empty.", isError: true };
          target.goForward();
          return { result: "Navigated forward.", isError: false };
        }
        if (url === "reload") {
          const target = this.getActiveWebContents();
          if (!target) return { result: "No active browser tab to reload.", isError: true };
          target.reload();
          return { result: "Page reloaded.", isError: false };
        }
        const res = await this.navigate(url);
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browsersnapshot") {
        const res = await this.snapshot();
        return { result: res.textSummary || JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserclick") {
        const res = await this.click({
          ref: args.ref,
          x: args.x,
          y: args.y,
          button: args.button,
          clickCount: args.clickCount,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browsertype") {
        const res = await this.type({
          text: args.text ?? "",
          ref: args.ref,
          clearFirst: args.clearFirst ?? (args.clear !== false),
          submit: args.submit ?? false,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserkey") {
        const res = await this.key({
          key: args.key,
          modifiers: args.modifiers,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserscroll") {
        const res = await this.scroll({
          deltaX: args.deltaX ?? 0,
          deltaY: args.deltaY ?? 500,
          ref: args.ref,
        });
        return { result: JSON.stringify(res, null, 2), isError: false };
      }

      if (norm === "browserscreenshot") {
        const res = await this.screenshot({
          fullPage: args.fullPage ?? false,
        });
        return {
          result: `[Browser Screenshot captured: ${res.width}x${res.height}px]`,
          isError: false,
        };
      }

      if (norm === "browserrequesthelp") {
        const reason = args.reason || "The assistant needs human intervention.";
        if (args.secretWanted) {
          this.requestSecret(args.secretWanted, args.ref);
          return {
            result: `Control handed over to human: Requested secret '${args.secretWanted}'. Waiting for user input.`,
            isError: false,
          };
        } else {
          this.requestHelp(reason);
          return {
            result: `Control handed over to human: '${reason}'. The assistant is paused until the user completes the action and clicks 'Hand back to AI'.`,
            isError: false,
          };
        }
      }

      return { result: `Unknown browser tool: '${toolName}'`, isError: true };
    } catch (err: any) {
      return { result: `Browser tool error (${toolName}): ${err?.message || String(err)}`, isError: true };
    }
  }
}

export const browserController = new BrowserController();

