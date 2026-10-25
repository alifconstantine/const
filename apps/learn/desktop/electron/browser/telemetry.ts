import type { WebContents } from "electron";
import {
  sanitizeBodyPreview,
  sanitizeConsoleLocation,
  sanitizeConsoleText,
  sanitizeNetworkStatusText,
  sanitizeStack,
  sanitizeUrl,
} from "./console-sanitizer.js";

export type BrowserConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export interface BrowserConsoleEntry {
  seq: number;
  ts: number;
  type: "console" | "pageerror" | "requestfailed";
  level: BrowserConsoleLevel;
  text: string;
  location?: string;
  stack?: string;
}

export interface BrowserNetworkRecord {
  id: number;
  ts: number;
  method: string;
  resourceType: "fetch" | "xhr" | "navigation";
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  bodyPreview?: string;
}

/** Redact every model-visible field of a console entry. */
function sanitizeConsoleEntry(entry: unknown): BrowserConsoleEntry {
  const source = (entry && typeof entry === "object" ? entry : {}) as Partial<BrowserConsoleEntry>;
  const sanitized: BrowserConsoleEntry = {
    ...(source as BrowserConsoleEntry),
    text: sanitizeConsoleText(source.text ?? ""),
  };
  if (typeof source.location === "string") {
    sanitized.location = sanitizeConsoleLocation(source.location);
  }
  if (typeof source.stack === "string") {
    sanitized.stack = sanitizeStack(source.stack);
  }
  return sanitized;
}

/** Redact every model-visible field of a network record. */
function sanitizeNetworkRecord(record: unknown): BrowserNetworkRecord {
  const source = (record && typeof record === "object" ? record : {}) as Partial<BrowserNetworkRecord>;
  const sanitized: BrowserNetworkRecord = {
    ...(source as BrowserNetworkRecord),
    url: sanitizeUrl(source.url ?? ""),
    statusText: sanitizeNetworkStatusText(source.statusText ?? ""),
  };
  if (typeof source.bodyPreview === "string") {
    sanitized.bodyPreview = sanitizeBodyPreview(source.bodyPreview);
  }
  return sanitized;
}

/** Page-side console & uncaught error capture hook ported from oh-my-pi. */
export const CONSOLE_CAPTURE_SCRIPT = String.raw`(() => {
  if (globalThis.__ompConsoleCapture) return true;
  const state = { entries: [], nextSeq: 1, dropped: 0 };
  const push = entry => {
    state.entries.push({ seq: state.nextSeq++, ts: Date.now(), ...entry });
    while (state.entries.length > 500) { state.entries.shift(); state.dropped++; }
  };
  const text = value => {
    try { return String(value); } catch {
      try { const json = JSON.stringify(value); if (json !== undefined) return json; } catch {}
      try { return Object.prototype.toString.call(value); } catch { return "[unserializable]"; }
    }
  };
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      const msgText = args.map(text).join(" ").slice(0, 8192);
      if (!msgText.startsWith("__HARNESS_ELEMENT_")) {
        push({ type: "console", level, text: msgText });
      }
      return original(...args);
    };
  }
  addEventListener("error", event => push({
    type: "pageerror",
    level: "error",
    text: String(event.message || event.error || "Uncaught error").slice(0, 8192),
    location: event.filename ? event.filename + ":" + event.lineno + ":" + event.colno : undefined,
    stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 16384) : undefined,
  }));
  addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    push({
      type: "pageerror",
      level: "error",
      text: String((reason && reason.message) || reason || "Unhandled promise rejection").slice(0, 8192),
      stack: reason && reason.stack ? String(reason.stack).slice(0, 16384) : undefined,
    });
  });
  globalThis.__ompConsoleCapture = state;
  return true;
})()`;

/** Page-side fetch & XHR network observer ported from oh-my-pi cmux-tab.ts. */
export const RESPONSE_OBSERVER_SCRIPT = String.raw`(() => {
  const key = "__ompCmuxResponses";
  if (globalThis[key]) return true;
  const state = { nextId: 1, records: [] };
  Object.defineProperty(globalThis, key, { value: state, configurable: true });
  const remember = async (response, meta) => {
    try {
      const clone = response.clone();
      const body = await clone.text().catch(() => "");
      state.records.push({
        id: state.nextId++,
        ts: meta.ts,
        method: meta.method,
        resourceType: "fetch",
        url: response.url,
        status: response.status,
        statusText: response.statusText || "",
        bodyPreview: body ? body.slice(0, 1000) : "",
        durationMs: Math.max(0, Date.now() - meta.ts),
      });
      if (state.records.length > 200) state.records.splice(0, state.records.length - 200);
    } catch {}
  };
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === "function") {
    globalThis.fetch = async (...args) => {
      const input = args[0];
      const init = args[1] || {};
      const ts = Date.now();
      const method = String(init.method || (input && input.method) || "GET").toUpperCase();
      try {
        const response = await originalFetch(...args);
        void remember(response, { ts, method });
        return response;
      } catch (err) {
        state.records.push({
          id: state.nextId++,
          ts,
          method,
          resourceType: "fetch",
          url: typeof input === "string" ? input : (input && input.url) || "",
          status: 0,
          statusText: String((err && err.message) || err || "NetworkError"),
          durationMs: Math.max(0, Date.now() - ts),
        });
        throw err;
      }
    };
  }
  const OriginalXHR = globalThis.XMLHttpRequest;
  if (typeof OriginalXHR === "function") {
    globalThis.XMLHttpRequest = function XMLHttpRequestProxy() {
      const xhr = new OriginalXHR();
      let method = "GET";
      let ts = Date.now();
      let reqUrl = "";
      const originalOpen = xhr.open.bind(xhr);
      xhr.open = (nextMethod, url, ...rest) => {
        method = String(nextMethod || "GET").toUpperCase();
        reqUrl = String(url || "");
        return originalOpen(nextMethod, url, ...rest);
      };
      const originalSend = xhr.send.bind(xhr);
      xhr.send = (...args) => {
        ts = Date.now();
        return originalSend(...args);
      };
      xhr.addEventListener("loadend", () => {
        let bodyPreview = "";
        try {
          if (!xhr.responseType || xhr.responseType === "text") {
            bodyPreview = typeof xhr.responseText === "string" ? xhr.responseText.slice(0, 1000) : "";
          }
        } catch {}
        state.records.push({
          id: state.nextId++,
          ts,
          method,
          resourceType: "xhr",
          url: xhr.responseURL || reqUrl,
          status: xhr.status,
          statusText: xhr.statusText || "",
          bodyPreview,
          durationMs: Math.max(0, Date.now() - ts),
        });
        if (state.records.length > 200) state.records.splice(0, state.records.length - 200);
      });
      return xhr;
    };
  }
  return true;
})()`;

export class TabTelemetryBuffer {
  private hostEntries: BrowserConsoleEntry[] = [];
  private seq = 1;
  private attachedContentsId?: number;

  public attachToWebContents(contents: WebContents) {
    if (contents.isDestroyed() || this.attachedContentsId === contents.id) {
      return;
    }
    this.attachedContentsId = contents.id;

    contents.on("console-message", (_event, level, message, line, sourceId) => {
      if (!message || message.startsWith("__HARNESS_ELEMENT_")) return;
      const mappedLevel: BrowserConsoleLevel =
        level === 3 ? "error" : level === 2 ? "warn" : level === 0 ? "debug" : "log";
      this.pushHostEntry({
        type: "console",
        level: mappedLevel,
        text: message.slice(0, 4096),
        location: sourceId ? `${sourceId}:${line}` : undefined,
      });
    });

    contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (errorCode === -3) return; // Ignore ERR_ABORTED
      this.pushHostEntry({
        type: "requestfailed",
        level: "error",
        text: `Load failed (${errorCode} ${errorDescription})${isMainFrame ? " [main_frame]" : ""}: ${validatedURL}`,
        location: validatedURL,
      });
    });
  }

  private pushHostEntry(entry: Omit<BrowserConsoleEntry, "seq" | "ts">) {
    this.hostEntries.push({
      seq: this.seq++,
      ts: Date.now(),
      ...entry,
      text: sanitizeConsoleText(entry.text),
      location: entry.location ? sanitizeConsoleLocation(entry.location) : entry.location,
      stack: entry.stack ? sanitizeStack(entry.stack) : entry.stack,
    });
    if (this.hostEntries.length > 300) {
      this.hostEntries.shift();
    }
  }

  public async injectObservers(contents: WebContents): Promise<void> {
    if (contents.isDestroyed()) return;
    await contents
      .executeJavaScript(`${CONSOLE_CAPTURE_SCRIPT}; ${RESPONSE_OBSERVER_SCRIPT}; true;`)
      .catch(() => {});
  }

  public async readTelemetry(
    contents: WebContents,
    options?: {
      level?: BrowserConsoleLevel | "all";
      includeNetwork?: boolean;
      onlyFailedNetwork?: boolean;
      clear?: boolean;
      limit?: number;
    }
  ): Promise<{
    consoleEntries: BrowserConsoleEntry[];
    networkRecords: BrowserNetworkRecord[];
  }> {
    const limit = options?.limit ?? 50;
    let pageConsole: BrowserConsoleEntry[] = [];
    let networkRecords: BrowserNetworkRecord[] = [];

    if (!contents.isDestroyed()) {
      try {
        const pageData = await contents.executeJavaScript(`(function() {
          const cState = globalThis.__ompConsoleCapture || { entries: [] };
          const nState = globalThis.__ompCmuxResponses || { records: [] };
          const out = {
            consoleEntries: cState.entries.slice(-200),
            networkRecords: nState.records.slice(-150)
          };
          if (${Boolean(options?.clear)}) {
            cState.entries = [];
            nState.records = [];
          }
          return out;
        })()`);
        if (pageData && Array.isArray(pageData.consoleEntries)) {
          pageConsole = pageData.consoleEntries.map((entry: unknown) => sanitizeConsoleEntry(entry));
        }
        if (pageData && Array.isArray(pageData.networkRecords)) {
          networkRecords = pageData.networkRecords.map((record: unknown) => sanitizeNetworkRecord(record));
        }
      } catch {}
    }

    // Merge host-captured entries (such as unhandled syntax errors or did-fail-load) with page entries
    const combinedConsole = [...this.hostEntries, ...pageConsole];
    // Deduplicate identical messages within 500ms window
    const deduped: BrowserConsoleEntry[] = [];
    for (const item of combinedConsole) {
      const dup = deduped.some(
        (existing) =>
          existing.text === item.text &&
          existing.level === item.level &&
          Math.abs(existing.ts - item.ts) < 800
      );
      if (!dup) deduped.push(item);
    }

    if (options?.clear) {
      this.hostEntries = [];
    }

    const filteredConsole = deduped
      .filter((entry) => {
        if (!options?.level || options.level === "all") return true;
        if (options.level === "error") {
          return entry.level === "error" || entry.type === "pageerror" || entry.type === "requestfailed";
        }
        return entry.level === options.level;
      })
      .slice(-limit);

    const filteredNetwork = (options?.includeNetwork === false ? [] : networkRecords)
      .filter((rec) => {
        if (options?.onlyFailedNetwork) {
          return rec.status === 0 || rec.status >= 400;
        }
        return true;
      })
      .slice(-limit);

    // Sanitize centrally so no capture path (host hooks or page-side merge) can bypass redaction.
    return {
      consoleEntries: filteredConsole.map((entry) => sanitizeConsoleEntry(entry)),
      networkRecords: filteredNetwork.map((record) => sanitizeNetworkRecord(record)),
    };
  }
}
