// Ported & adapted from oh-my-pi cmux-tab.ts & screenshot.ts

export type SelectorKind =
  | "css"
  | "aria-ref"
  | "text"
  | "aria"
  | "xpath"
  | "pierce"
  | "label"
  | "placeholder"
  | "testid"
  | "alt"
  | "title"
  | "role";

export interface SelectorSpec {
  kind: SelectorKind;
  value: string;
  raw: string;
  name?: string;
  role?: string;
  exact?: boolean;
}

export function parseSelectorSpec(selector: string): SelectorSpec {
  const raw = String(selector || "").trim();
  let normalized = raw;
  if (normalized.startsWith("p-text/")) {
    normalized = `text/${normalized.slice("p-text/".length)}`;
  } else if (normalized.startsWith("p-aria/")) {
    normalized = `aria/${normalized.slice("p-aria/".length)}`;
  } else if (normalized.startsWith("p-xpath/")) {
    normalized = `xpath/${normalized.slice("p-xpath/".length)}`;
  } else if (normalized.startsWith("p-pierce/")) {
    normalized = `pierce/${normalized.slice("p-pierce/".length)}`;
  }

  const ariaRef = /^(?:aria-ref=|aria-ref\/|ariaref\/|ref[:=\/]\s*|@?|\[?)(e\d+)(?:\]|\s*\(.*?\))?$/i.exec(normalized);
  if (ariaRef) {
    return { kind: "aria-ref", value: ariaRef[1]!.toLowerCase(), raw };
  }

  // Handle synthetic selector like button[text="Submit"]
  const syntheticText = /^([a-z0-9_-]+)?\[text=["']([^"']+)["']\]$/i.exec(normalized);
  if (syntheticText) {
    const tag = syntheticText[1];
    const textVal = syntheticText[2]!;
    if (tag) {
      return {
        kind: "role",
        value: normalized,
        raw,
        role: tag.toLowerCase(),
        name: textVal,
        exact: false,
      };
    }
    return { kind: "text", value: textVal, raw };
  }

  const slash = normalized.indexOf("/");
  if (slash > 0) {
    const prefix = normalized.slice(0, slash);
    const value = normalized.slice(slash + 1);
    if (prefix === "role") {
      const roleMatch = /^\s*([^\s[]+)/.exec(value);
      const nameMatch =
        /\[\s*name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))(?:\s+(exact))?\s*\]/i.exec(value);
      return {
        kind: "role",
        value,
        raw,
        role: roleMatch?.[1] ?? "",
        name: nameMatch?.[1] ?? nameMatch?.[2] ?? nameMatch?.[3],
        exact: nameMatch?.[4]?.toLowerCase() === "exact",
      };
    }
    if (
      prefix === "text" ||
      prefix === "aria" ||
      prefix === "xpath" ||
      prefix === "pierce" ||
      prefix === "label" ||
      prefix === "placeholder" ||
      prefix === "testid" ||
      prefix === "alt" ||
      prefix === "title"
    ) {
      return { kind: prefix, value, raw, name: prefix === "aria" ? value : undefined };
    }
  }

  return { kind: "css", value: normalized, raw };
}

export const PAGE_SELECTOR_HELPERS = String.raw`
const isVisible = element => {
  if (!element || typeof element.getBoundingClientRect !== "function") return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
};
const textOf = element => (element.innerText || element.textContent || "").trim();
const allElements = (root = document) => {
  const result = [];
  const walk = node => {
    if (!node || !node.querySelectorAll) return;
    for (const el of Array.from(node.querySelectorAll("*"))) {
      result.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(root);
  return result;
};
const pierceQuery = (root, selector) => {
  try {
    const direct = root.querySelector?.(selector);
    if (direct) return direct;
  } catch {}
  const nodes = root.querySelectorAll ? Array.from(root.querySelectorAll("*")) : [];
  for (const node of nodes) {
    if (node.shadowRoot) {
      const found = pierceQuery(node.shadowRoot, selector);
      if (found) return found;
    }
  }
  return null;
};
const implicitRole = element => {
  const tag = (element.tagName || "").toLowerCase();
  if (tag === "a" && element.hasAttribute("href")) return "link";
  if (tag === "button") return "button";
  if (tag === "textarea") return "textbox";
  if (tag === "select") return element.multiple || element.size > 1 ? "listbox" : "combobox";
  if (tag === "option") return "option";
  if (tag === "img") return "img";
  if (tag === "ul" || tag === "ol") return "list";
  if (tag === "li") return "listitem";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag !== "input") return tag;
  const type = (element.type || "text").toLowerCase();
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "range") return "slider";
  if (type === "number") return "spinbutton";
  if (type === "search") return "searchbox";
  if (["button", "submit", "reset", "image"].includes(type)) return "button";
  return ["hidden", "file", "color", "date", "datetime-local", "month", "time", "week"].includes(type)
    ? tag
    : "textbox";
};
const accessibleName = element => {
  const labelledBy = element.getAttribute?.("aria-labelledby");
  const referenced = labelledBy
    ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim()
    : "";
  const labelled = element.labels ? Array.from(element.labels).map(label => textOf(label)).join(" ").trim() : "";
  return (
    element.getAttribute?.("aria-label") ||
    referenced ||
    labelled ||
    element.getAttribute?.("alt") ||
    element.getAttribute?.("title") ||
    (["button", "submit", "reset"].includes(element.type) ? element.value : "") ||
    textOf(element)
  ).trim();
};
const semanticElements = (spec, includeHidden = false) => {
  if (!["label", "placeholder", "testid", "alt", "title", "role"].includes(spec.kind)) return null;
  const wanted = (spec.value || "").trim().toLowerCase();
  return allElements().filter(element => {
    if (!includeHidden && !isVisible(element)) return false;
    if (spec.kind === "label") return accessibleName(element).toLowerCase().includes(wanted);
    if (spec.kind === "placeholder") return (element.getAttribute("placeholder") || "").toLowerCase().includes(wanted);
    if (spec.kind === "testid") return element.getAttribute("data-testid") === spec.value.trim();
    if (spec.kind === "alt") return (element.getAttribute("alt") || "").toLowerCase().includes(wanted);
    if (spec.kind === "title") return (element.getAttribute("title") || "").toLowerCase().includes(wanted);
    const role = (element.getAttribute("role") || implicitRole(element) || "").toLowerCase();
    const tag = (element.tagName || "").toLowerCase();
    const wantedRole = (spec.role || "").toLowerCase();
    if (role !== wantedRole && tag !== wantedRole) return false;
    if (!spec.name) return true;
    const name = accessibleName(element).toLowerCase();
    return spec.exact ? name === spec.name.toLowerCase() : name.includes(spec.name.toLowerCase());
  });
};
const findElement = (spec, includeHidden = false) => {
  if (!spec) return null;
  if (spec.kind === "aria-ref") {
    const wanted = spec.value;
    if (typeof window.resolveAriaRef === "function") {
      try {
        const found = window.resolveAriaRef(wanted);
        if (found && found.isConnected !== false) return found;
      } catch {}
    }
    if (window.__constElementMap && window.__constElementMap[wanted]) {
      const mapped = window.__constElementMap[wanted];
      if (mapped && mapped.isConnected !== false) return mapped;
    }
    for (const el of allElements()) {
      if (el._ariaRef && el._ariaRef.ref === wanted) return el;
      if (el.getAttribute && (el.getAttribute("data-aria-ref") === wanted || el.getAttribute("ref") === wanted)) return el;
    }
    return null;
  }
  const semantic = semanticElements(spec, includeHidden);
  if (semantic && semantic.length > 0) return semantic[0];
  if (spec.kind === "css") {
    return pierceQuery(document, spec.value);
  }
  if (spec.kind === "pierce") {
    return pierceQuery(document, spec.value);
  }
  if (spec.kind === "xpath") {
    try {
      const result = document.evaluate(spec.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue instanceof Element ? result.singleNodeValue : null;
    } catch {
      return null;
    }
  }
  if (spec.kind === "text") {
    const wanted = spec.value.trim().toLowerCase();
    const matches = allElements().filter(element => (includeHidden || isVisible(element)) && textOf(element).toLowerCase().includes(wanted));
    return matches.find(element => !matches.some(other => other !== element && element.contains(other))) || null;
  }
  if (spec.kind === "aria") {
    const wanted = (spec.name || spec.value).trim().toLowerCase();
    const role = (spec.role || "").toLowerCase();
    return (
      allElements().find(element => {
        if (!includeHidden && !isVisible(element)) return false;
        if (role && (element.getAttribute("role") || "").toLowerCase() !== role) return false;
        const name = accessibleName(element).toLowerCase();
        return name === wanted || name.includes(wanted);
      }) || null
    );
  }
  return null;
};
`;

export interface ScreenshotAnnotationTarget {
  ref: string;
  role: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildInstallAnnotationOverlayScript(
  token: string,
  targets: ScreenshotAnnotationTarget[]
): string {
  return `(function() {
    var payload = ${JSON.stringify({ token, targets })};
    var doc = document;
    var root = doc.createElement("div");
    root.setAttribute("data-const-screenshot-annotations", payload.token);
    root.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;overflow:hidden;";
    for (var i = 0; i < payload.targets.length; i++) {
      var target = payload.targets[i];
      var outline = doc.createElement("div");
      outline.style.cssText = "position:fixed;left:" + target.x + "px;top:" + target.y + "px;width:" + target.width + "px;height:" + target.height + "px;box-sizing:border-box;border:2px solid #ff2bd6;background:rgba(255,43,214,.08);border-radius:3px;";
      var label = doc.createElement("span");
      label.textContent = "[" + target.ref + "]";
      label.style.cssText = "position:absolute;left:-2px;top:-19px;padding:1px 4px;border:1px solid #111;border-radius:3px;background:#ffeb3b;color:#111;font:700 11px/14px ui-monospace,monospace;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.4);";
      outline.appendChild(label);
      root.appendChild(outline);
    }
    doc.documentElement.appendChild(root);
    return true;
  })();`;
}

export function buildRemoveAnnotationOverlayScript(token: string): string {
  return `(function() {
    var el = document.querySelector('[data-const-screenshot-annotations=' + ${JSON.stringify(token)} + ']');
    if (el) el.remove();
    return true;
  })();`;
}

export function formatScreenshotLegend(targets: readonly ScreenshotAnnotationTarget[]): string {
  if (targets.length === 0) return "";
  const lines = targets.slice(0, 60).map((target) => {
    const name = target.name ? ` ${JSON.stringify(target.name)}` : "";
    return `[${target.ref}] ${target.role}${name} (${target.x},${target.y} ${target.width}x${target.height})`;
  });
  return [
    "### Annotated Interactive Elements on Screenshot",
    ...lines,
  ].join("\n");
}
