import { ARIA_SNAPSHOT_BUNDLE } from "./aria-snapshot-bundle.js";

const INTERACTIVE_ROLES: Readonly<Record<string, true>> = {
  button: true,
  link: true,
  textbox: true,
  combobox: true,
  listbox: true,
  checkbox: true,
  radio: true,
  tab: true,
  menuitem: true,
  menuitemcheckbox: true,
  menuitemradio: true,
  slider: true,
  switch: true,
  option: true,
  spinbutton: true,
  searchbox: true,
};

const EMPTY_STRUCTURAL_ROLES: Readonly<Record<string, true>> = {
  generic: true,
  none: true,
  group: true,
};

export interface SnapshotPostProcessOptions {
  /** Keep interactive nodes and the structural path leading to them. */
  interactive?: boolean;
  /** Remove unnamed structural wrappers that do not contain interactive controls. */
  compact?: boolean;
  /** Append resolved link destinations to link entries. */
  urls?: boolean;
}

export interface AriaSnapshotOptions extends SnapshotPostProcessOptions {
  /** Maximum tree depth to render. */
  depth?: number;
  /** Append `[box=x,y,w,h]` bounding boxes to each node. */
  boxes?: boolean;
  /** Return a revisioned full, unchanged, or delta result. */
  diff?: boolean;
  /** Optional root CSS selector to scope snapshot. */
  selector?: string;
  /**
   * Selectors or ARIA refs whose current value must be masked in the returned
   * payload. Used while a human is handing a password / OTP back to the agent.
   */
  maskValues?: string[];
}

export type AriaHrefMap = Readonly<Record<string, string>>;

export type AriaSnapshotDiffResult =
  | { status: "full"; revision: number; snapshot: string }
  | { status: "unchanged"; revision: number }
  | { status: "delta"; revision: number; baseRevision: number; delta: string };

export interface AriaSnapshotBaseline {
  url: string;
  revision: number;
  snapshot: string;
}

interface SnapshotLine {
  text: string;
  indent: number;
  role?: string;
  name: string;
  children: SnapshotLine[];
  interactive: boolean;
  containsInteractive: boolean;
}

function lineIndent(line: string): number {
  let width = 0;
  for (const char of line) {
    if (char === " ") width++;
    else if (char === "\t") width += 2;
    else break;
  }
  return width;
}

function parseSnapshotLine(text: string): SnapshotLine {
  const body = text.trimStart().replace(/^-[ \t]*/, "");
  const role = /^([a-z][\w-]*)\b/i.exec(body)?.[1]?.toLowerCase();
  const rest = role ? body.slice(role.length) : body;
  const name = rest
    .replace(/\[[^\]]*\]/g, "")
    .replace(/:\s*$/, "")
    .trim()
    .replace(/^(?:""|'')$/, "");
  const interactive = role ? INTERACTIVE_ROLES[role] === true : false;
  return {
    text,
    indent: lineIndent(text),
    role,
    name,
    children: [],
    interactive,
    containsInteractive: interactive,
  };
}

function parseSnapshot(snapshot: string): SnapshotLine[] {
  const roots: SnapshotLine[] = [];
  const stack: SnapshotLine[] = [];
  for (const text of snapshot.split("\n")) {
    if (!text.trim()) continue;
    const node = parseSnapshotLine(text);
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= node.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  const mark = (node: SnapshotLine): boolean => {
    for (const child of node.children) {
      node.containsInteractive = mark(child) || node.containsInteractive;
    }
    return node.containsInteractive;
  };
  for (const root of roots) mark(root);
  return roots;
}

function appendHref(text: string, role: string | undefined, hrefs: AriaHrefMap): string {
  if (role !== "link" || text.includes("[href=")) return text;
  const ref = /\[ref=(e\d+)\]/.exec(text)?.[1];
  const href = ref ? hrefs[ref] : undefined;
  if (!href) return text;
  const suffix = `[href=${JSON.stringify(href)}]`;
  return text.trimEnd().endsWith(":")
    ? `${text.trimEnd().slice(0, -1)} ${suffix}:`
    : `${text} ${suffix}`;
}

function renderSnapshot(
  nodes: readonly SnapshotLine[],
  options: SnapshotPostProcessOptions,
  hrefs: AriaHrefMap,
  indent: number
): string[] {
  const output: string[] = [];
  for (const node of nodes) {
    if (options.interactive && !node.containsInteractive) continue;
    const promote =
      options.compact &&
      node.role !== undefined &&
      EMPTY_STRUCTURAL_ROLES[node.role] === true &&
      !node.name &&
      !node.containsInteractive;
    if (promote) {
      output.push(...renderSnapshot(node.children, options, hrefs, indent));
      continue;
    }
    const trimmed = node.text.trimStart();
    output.push(`${" ".repeat(indent)}${appendHref(trimmed, node.role, hrefs)}`);
    if (node.children.length > 0) {
      const originalStep = Math.max(2, node.children[0]!.indent - node.indent);
      output.push(...renderSnapshot(node.children, options, hrefs, indent + originalStep));
    }
  }
  return output;
}

/** Apply interactive, compact, and URL decorations to rendered ARIA YAML. */
export function postProcessAriaSnapshot(
  snapshot: string,
  options: SnapshotPostProcessOptions = {},
  hrefs: AriaHrefMap = {}
): string {
  if (!options.interactive && !options.compact && !options.urls) return snapshot;
  const roots = parseSnapshot(snapshot);
  if (roots.length === 0) return snapshot;
  const rendered = renderSnapshot(roots, options, options.urls ? hrefs : {}, roots[0]!.indent);
  return rendered.join("\n");
}

/** Extract the distinct eN refs present in rendered snapshot YAML. */
export function collectAriaSnapshotRefs(snapshot: string): string[] {
  const refs = new Set<string>();
  for (const match of snapshot.matchAll(/\[ref=(e\d+)\]/g)) refs.add(match[1]!);
  return [...refs];
}

/** Build a stable baseline key excluding the `diff` output-mode switch. */
export function ariaSnapshotBaselineKey(
  selector: string | undefined,
  options: SnapshotPostProcessOptions & {
    depth?: number;
    boxes?: boolean;
  }
): string {
  return JSON.stringify({
    selector: selector ?? null,
    depth: options.depth ?? null,
    boxes: options.boxes ?? false,
    interactive: options.interactive ?? false,
    compact: options.compact ?? false,
    urls: options.urls ?? false,
  });
}

function unifiedReplacement(oldText: string, newText: string, context = 3): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }
  const contextStart = Math.max(0, prefix - context);
  const oldChangeEnd = oldLines.length - suffix;
  const newChangeEnd = newLines.length - suffix;
  const contextEndCount = Math.min(context, suffix);
  const oldEnd = oldChangeEnd + contextEndCount;
  const newEnd = newChangeEnd + contextEndCount;
  const lines = [
    `@@ -${contextStart + 1},${oldEnd - contextStart} +${contextStart + 1},${newEnd - contextStart} @@`,
  ];
  for (let i = contextStart; i < prefix; i++) lines.push(` ${oldLines[i]}`);
  for (let i = prefix; i < oldChangeEnd; i++) lines.push(`-${oldLines[i]}`);
  for (let i = prefix; i < newChangeEnd; i++) lines.push(`+${newLines[i]}`);
  for (let i = 0; i < contextEndCount; i++) lines.push(` ${oldLines[oldChangeEnd + i]}`);
  return lines.join("\n");
}

/** Update one keyed snapshot baseline and return its compact revision result. */
export function diffAriaSnapshot(
  baselines: Map<string, AriaSnapshotBaseline>,
  key: string,
  url: string,
  snapshot: string
): AriaSnapshotDiffResult {
  const previous = baselines.get(key);
  if (!previous) {
    baselines.set(key, { url, revision: 1, snapshot });
    return { status: "full", revision: 1, snapshot };
  }
  if (previous.url === url && previous.snapshot === snapshot) {
    return { status: "unchanged", revision: previous.revision };
  }
  const revision = previous.revision + 1;
  baselines.set(key, { url, revision, snapshot });
  if (previous.url !== url) return { status: "full", revision, snapshot };
  const delta = unifiedReplacement(previous.snapshot, snapshot);
  if (delta.length >= snapshot.length) return { status: "full", revision, snapshot };
  return { status: "delta", revision, baseRevision: previous.revision, delta };
}

/**
 * Build an in-page script that executes the Playwright ARIA snapshot bundle,
 * populates `window.__constElementMap[ref]` for every `[ref=eN]`, collects
 * structured interactive elements + readable text, and returns the payload.
 */
export function buildEnhancedSnapshotScript(
  snapshotId: number,
  options: AriaSnapshotOptions = {}
): string {
  const request = { depth: options.depth ?? 14, boxes: options.boxes ?? false };
  const sel = options.selector ? JSON.stringify(options.selector) : "null";
  const maskRefs = JSON.stringify(options.maskValues ?? []);

  return `(function() {
    var snapshotId = ${snapshotId};
    var module = { exports: {} };
    ${ARIA_SNAPSHOT_BUNDLE}
    var __sel = ${sel};
    var __maskRefs = ${maskRefs};
    var __root = __sel ? document.querySelector(__sel) : null;
    if (__sel && !__root) {
      throw new Error("browser_snapshot: selector " + __sel + " matched no element");
    }

    // Resolve old refs before the ARIA bundle regenerates them. Keep the DOM
    // values unchanged: temporary own getters only affect synchronous reads by
    // the serializer, and are restored before any page callback can run.
    var maskedElements = new Set();
    var secretValues = [];
    var valueDescriptors = [];
    function collectSecrets(root) {
      for (var el of Array.from(root.querySelectorAll('*'))) {
        if (isMaskedField(el)) {
          maskedElements.add(el);
          var secret = 'value' in el ? String(el.value || '') : String(el.textContent || '');
          if (secret) secretValues.push(secret);
          if ('value' in el) {
            valueDescriptors.push([el, Object.getOwnPropertyDescriptor(el, 'value')]);
          }
        }
        if (el.shadowRoot) collectSecrets(el.shadowRoot);
      }
    }
    collectSecrets(document);
    window.__constElementMap = {};
    var ariaYaml = "";
    var hrefs = {};
    try {
      for (var entry of valueDescriptors) {
        Object.defineProperty(entry[0], 'value', { configurable: true, get: function() { return '[REDACTED]'; } });
      }
      ariaYaml = module.exports.ariaSnapshot(__root, ${JSON.stringify(request)}) || "";
    } catch (e) {
      ariaYaml = "";
    } finally {
      for (var entry of valueDescriptors) {
        if (entry[1]) Object.defineProperty(entry[0], 'value', entry[1]);
        else delete entry[0].value;
      }
    }

    var elements = [];
    var seenElements = new Set();

    function isVisible(el) {
      if (!el || typeof el.getBoundingClientRect !== "function") return false;
      var style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    /**
     * Credential-bearing fields must never expose their value to the model.
     * This covers password inputs, one-time-code inputs and fields explicitly
     * marked as secret by the page.
     */
    function isSecretField(el) {
      if (!el) return false;
      var type = String((el.type || "")).toLowerCase();
      if (type === "password") return true;
      var autocomplete = String((el.getAttribute && el.getAttribute("autocomplete")) || "").toLowerCase();
      if (autocomplete.indexOf("password") !== -1) return true;
      if (autocomplete.indexOf("one-time-code") !== -1) return true;
      if (autocomplete.indexOf("current-password") !== -1) return true;
      if (autocomplete.indexOf("new-password") !== -1) return true;
      try {
        if (el.getAttribute && (el.getAttribute("data-secret") === "true" || el.getAttribute("data-const-secret") === "true")) return true;
      } catch (e) {}
      return false;
    }

    /** True when the element is a credential field or an explicitly masked target. */
    function isMaskedField(el) {
      if (maskedElements && maskedElements.has(el)) return true;
      if (isSecretField(el)) return true;
      if (!__maskRefs || !__maskRefs.length) return false;
      for (var i = 0; i < __maskRefs.length; i++) {
        var ref = __maskRefs[i];
        if (!ref) continue;
        try {
          if (el.matches && el.matches(ref)) return true;
        } catch (e) {}
        try {
          if (el._ariaRef && el._ariaRef.ref === ref) return true;
        } catch (e) {}
        try {
          if (window.__constElementMap && window.__constElementMap[ref] === el) return true;
        } catch (e) {}
      }
      return false;
    }

    function getAccessibleName(el) {
      var labelledBy = el.getAttribute && el.getAttribute("aria-labelledby");
      var referenced = labelledBy
        ? labelledBy.split(/\\s+/).map(function(id) {
            var n = document.getElementById(id);
            return n ? n.textContent || "" : "";
          }).join(" ").trim()
        : "";
      var labelled = el.labels
        ? Array.from(el.labels).map(function(l) { return (l.innerText || l.textContent || "").trim(); }).join(" ").trim()
        : "";
      return (
        (el.getAttribute && el.getAttribute("aria-label")) ||
        referenced ||
        labelled ||
        (el.getAttribute && el.getAttribute("title")) ||
        (el.getAttribute && el.getAttribute("placeholder")) ||
        (el.getAttribute && el.getAttribute("alt")) ||
        (isMaskedField(el) ? "" : el.innerText) ||
        (isMaskedField(el) ? "" : el.value) ||
        ""
      ).trim().replace(/\\s+/g, " ").slice(0, 100);
    }

    function recordElement(ref, el) {
      if (!el || seenElements.has(el)) return;
      seenElements.add(el);
      window.__constElementMap[ref] = el;
      try {
        el._ariaRef = { ref: ref };
      } catch (e) {}
      if (el.tagName === "A" && el.href) {
        hrefs[ref] = el.href;
      }
      if (!isVisible(el)) return;
      var rect = el.getBoundingClientRect();
      var tag = (el.tagName || "div").toLowerCase();
      var role = (el.getAttribute && el.getAttribute("role")) || tag;
      var name = getAccessibleName(el);
      elements.push({
        ref: ref,
        tag: tag,
        role: role,
        name: name,
        type: el.type || undefined,
        placeholder: el.placeholder || undefined,
        value: isMaskedField(el) ? undefined : (el.value ? String(el.value).slice(0, 80) : undefined),
        checked: typeof el.checked === "boolean" ? el.checked : undefined,
        disabled: Boolean(el.disabled || (el.getAttribute && el.getAttribute("aria-disabled") === "true")) || undefined,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        selector: el.id ? "#" + el.id : tag
      });
    }

    if (ariaYaml) {
      var matches = ariaYaml.matchAll(/\\[ref=(e\\d+)\\]/g);
      for (var match of matches) {
        var ref = match[1];
        var resolved = null;
        try {
          resolved = module.exports.resolveAriaRef(ref);
        } catch (e) {}
        if (resolved) {
          recordElement(ref, resolved);
        }
      }
    }

    // Also scan DOM + open Shadow DOM for any interactive controls not yet mapped
    var actionableSelectors = [
      'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
      '[role="tab"]', '[role="menuitem"]', '[role="option"]', '[role="switch"]',
      '[role="combobox"]', '[role="searchbox"]', '[role="textbox"]',
      '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]', 'summary'
    ].join(',');

    var maxRefNum = 0;
    Object.keys(window.__constElementMap).forEach(function(k) {
      var n = parseInt(k.slice(1), 10);
      if (n > maxRefNum) maxRefNum = n;
    });

    function scanInteractive(root) {
      if (!root || !root.querySelectorAll) return;
      var nodes = root.querySelectorAll(actionableSelectors);
      nodes.forEach(function(el) {
        if (!seenElements.has(el) && isVisible(el)) {
          maxRefNum++;
          recordElement("e" + maxRefNum, el);
        }
      });
      var all = root.querySelectorAll("*");
      all.forEach(function(el) {
        if (el.shadowRoot) scanInteractive(el.shadowRoot);
      });
    }
    scanInteractive(__root || document);

    // Readable text extraction (oh-my-pi readable style)
    var readableRoot = __root || document.querySelector("main, article, [role='main']") || document.body;
    var readableText = "";
    if (readableRoot) {
      readableText = (readableRoot.innerText || "").replace(/\\n{3,}/g, "\\n\\n").trim().slice(0, 4500);
    }

    function redactSnapshot(value) {
      if (typeof value === 'string') {
        for (var secret of secretValues) {
          value = value.split(secret).join('[REDACTED]');
          var escaped = JSON.stringify(secret).slice(1, -1);
          if (escaped !== secret) value = value.split(escaped).join('[REDACTED]');
        }
        return value;
      }
      if (Array.isArray(value)) return value.map(redactSnapshot);
      if (value && typeof value === 'object') {
        for (var key of Object.keys(value)) value[key] = redactSnapshot(value[key]);
      }
      return value;
    }

    return redactSnapshot({
      snapshotId: snapshotId,
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
        scrollWidth: document.documentElement ? document.documentElement.scrollWidth : window.innerWidth,
        scrollHeight: document.documentElement ? document.documentElement.scrollHeight : window.innerHeight
      },
      ariaSnapshot: ariaYaml,
      hrefs: hrefs,
      elements: elements,
      readableText: readableText
    });
  })();`;
}
