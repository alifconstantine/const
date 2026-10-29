import type { WidgetDocument } from "./widget-contract";

export const WIDGET_IMPORTS = {
  three: "https://esm.sh/three@0.180.0",
  d3: "https://esm.sh/d3@7.9.0",
  "chart.js": "https://esm.sh/chart.js@4.5.0/auto",
  leaflet: "https://esm.sh/leaflet@1.9.4",
} as const;

const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const script = (value: string) => value.replace(/<\/script/gi, "<\\/script");
const style = (value: string) => value.replace(/<\/style/gi, "<\\/style");
const text = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// Serialized into an opaque-origin iframe. No Electron, filesystem, or host tools.
const WIDGET_RUNTIME = String.raw`function widgetRuntime(channel, initial, standalone, notice) {
    const emit = (type, args = {}) => {
        if (!standalone)
            parent.postMessage({ channel, type, ...args }, "*");
        else if (type === "followUp" || type === "openLink") {
            let status = document.getElementById("const-export-notice");
            if (!status) {
                status = document.createElement("p");
                status.id = "const-export-notice";
                status.setAttribute("role", "status");
                document.body.append(status);
            }
            status.textContent = notice;
        }
    };
    let state = initial;
    let locked = false;
    const hostDisabled = new WeakSet();
    const updateLock = (value) => {
        locked = value;
        for (const control of document.querySelectorAll("button,input,select,textarea")) {
            if (locked && !control.disabled) { hostDisabled.add(control); control.disabled = true; }
            else if (!locked && hostDisabled.has(control)) { hostDisabled.delete(control); control.disabled = false; }
        }
    };
    for (const type of ["pointerdown", "click", "keydown", "input", "change"]) {
        addEventListener(type, (event) => {
            if (locked && event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
        }, true);
    }
    const controls = () => Array.from(document.querySelectorAll("input[name],textarea[name],select[name]"));
    const validName = (name) => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name) && !["constructor", "prototype", "__proto__"].includes(name);
    const restore = () => {
        const values = state.$controls;
        for (const input of controls()) {
            if (input instanceof HTMLInputElement && ["password", "file"].includes(input.type)) {
                input.disabled = true;
                continue;
            }
            const saved = Object.prototype.hasOwnProperty.call(values || {}, input.name) ? values?.[input.name] : undefined;
            if (!saved)
                continue;
            if (typeof saved.value === "string")
                input.value = saved.value;
            if (input instanceof HTMLInputElement && typeof saved.checked === "boolean")
                input.checked = saved.checked;
        }
    };
    const capture = () => {
        const values = {};
        for (const input of controls()) {
            if (!validName(input.name) || (input instanceof HTMLInputElement && ["password", "file"].includes(input.type)))
                continue;
            values[input.name] = { value: input.value, ...(input instanceof HTMLInputElement ? { checked: input.checked } : {}) };
        }
        state = { ...state, $controls: values };
        emit("state", { state });
    };
    const api = {
        get state() { return structuredClone(state); },
        setState(next) {
            if (!next || typeof next !== "object" || Array.isArray(next))
                return;
            state = { ...state, ...next };
            capture();
        },
        // Requests are displayed by host controls; generated scripts never start agent runs or open host windows.
        sendPrompt({ text: prompt }) { capture(); emit("followUp", { text: prompt }); },
        openLink({ url }) { emit("openLink", { url }); },
    };
    Object.defineProperty(window, "constWidget", { value: api, writable: false });
    restore();
    document.addEventListener("input", capture);
    document.addEventListener("change", capture);
    addEventListener("message", (event) => {
        if (event.source !== parent || event.data?.channel !== channel) return;
        if (event.data.type === "interaction") { updateLock(event.data.disabled === true); return; }
        if (event.data.type !== "snapshot") return;
        capture();
        emit("snapshot", { requestId: event.data.requestId, state });
    });
    document.addEventListener("submit", (event) => { event.preventDefault(); capture(); });
    document.addEventListener("click", (event) => {
        const link = event.target?.closest?.("a[href]");
        if (!link)
            return;
        const url = link.getAttribute("href") || "";
        if (!url.startsWith("#")) {
            event.preventDefault();
            api.openLink({ url });
        }
    });
    let resizeQueued = false;
    const resize = () => {
        if (resizeQueued)
            return;
        resizeQueued = true;
        requestAnimationFrame(() => {
            resizeQueued = false;
            emit("resize", { height: Math.ceil(document.documentElement.getBoundingClientRect().height) });
        });
    };
    new ResizeObserver(resize).observe(document.body);
    addEventListener("resize", resize);
    addEventListener("error", () => emit("error"));
    addEventListener("unhandledrejection", () => emit("error"));
    resize();
}`;

export function buildWidgetDocument(
  widget: Pick<WidgetDocument, "title" | "css" | "html"> &
    Partial<WidgetDocument>,
  options: {
    channel: string;
    nonce: string;
    theme: "dark" | "light";
    state?: Record<string, unknown>;
    preview?: boolean;
    standalone?: boolean;
    language?: string;
    exportNotice?: string;
  },
) {
  const {
    channel,
    nonce,
    theme,
    preview = false,
    standalone = false,
  } = options;
  if (!/^[a-zA-Z0-9-]+$/.test(nonce)) throw new Error("Invalid widget nonce");
  const imports = Object.fromEntries(
    (widget.libraries || []).map((name) => [name, WIDGET_IMPORTS[name]]),
  );
  const libraries = Object.keys(imports).length > 0;
  const policy = `default-src 'none'; script-src ${preview ? "'none'" : `'nonce-${nonce}'${libraries ? " https://esm.sh" : ""}`}; style-src 'unsafe-inline'${widget.libraries?.includes("leaflet") ? " https://unpkg.com" : ""}; img-src data: blob:${widget.libraries?.includes("leaflet") ? " https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com" : ""}; connect-src ${libraries ? "https://esm.sh" : "'none'"}; font-src data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const baseCss = `:root{color-scheme:${theme};--color-background-primary:${theme === "dark" ? "#161616" : "#ffffff"};--color-background-secondary:${theme === "dark" ? "#222222" : "#f4f4f5"};--color-background-tertiary:${theme === "dark" ? "#2b2b2b" : "#e8e8eb"};--color-text-primary:${theme === "dark" ? "#ffffff" : "#262626"};--color-text-secondary:${theme === "dark" ? "#d4d4d4" : "#525252"};--color-text-muted:#969696;--color-border-primary:${theme === "dark" ? "#383838" : "#dedee2"};font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--color-text-primary);background:var(--color-background-primary)}*{box-sizing:border-box}html,body{margin:0;min-height:0;overflow:hidden}body{padding:16px}button,input,select,textarea{font:inherit;color:inherit;background:var(--color-background-tertiary);border:1px solid var(--color-border-primary);border-radius:8px;padding:8px 12px;max-width:100%}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #969696;outline-offset:2px}svg,canvas,img{max-width:100%}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}`;
  const initial = options.state || widget.initialState || {};
  const body = preview
    ? `<fieldset disabled aria-disabled="true" style="border:0;padding:0;margin:0;min-width:0">${widget.html}</fieldset>`
    : widget.html;
  const runtime = preview
    ? ""
    : `<script nonce="${nonce}">(${WIDGET_RUNTIME})(${json(channel)},${json(initial)},${standalone},${json(options.exportNotice || "")});</script><script type="module" nonce="${nonce}">${script(widget.js || "")}\n;${standalone ? "" : `parent.postMessage({channel:${json(channel)},type:"ready"},"*");`}</script>`;
  return `<!doctype html><html lang="${text(options.language || "en")}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${text(policy)}"><title>${text(widget.title)}</title>${libraries && !preview ? `<script type="importmap" nonce="${nonce}">${json({ imports })}</script>` : ""}${widget.libraries?.includes("leaflet") ? '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">' : ""}<style>${baseCss}\n${style(widget.css)}</style></head><body>${body}${runtime}</body></html>`;
}
