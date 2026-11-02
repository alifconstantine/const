export type ResolvedMarkdownLink =
  | { type: "web"; url: string }
  | { type: "external"; url: string }
  | { type: "trajectory"; idOrPath: string }
  | { type: "folder"; path: string }
  | { type: "file"; path: string }
  | { type: "plugin"; id: string }
  | { type: "none" };

/**
 * Classifies and normalizes links generated in Markdown output or clicked in chat messages.
 * Ensures web links (HTTP, HTTPS, localhost, domain-like URLs, browser://) are routed to
 * the embedded browser sidepanel instead of opening full-screen in the main window.
 */
export function resolveMarkdownLink(rawHref: string): ResolvedMarkdownLink {
  const href = (rawHref || "").trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return { type: "none" };
  const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
  if (/^workspace:\/\//i.test(href)) {
    const path = decode(href.replace(/^workspace:\/\/\/?/i, ""));
    return { type: path.endsWith("/") ? "folder" : "file", path };
  }

  if (href.startsWith("plugin://")) {
    return { type: "plugin", id: href.replace(/^plugin:\/\//, "") };
  }

  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    return { type: "external", url: href };
  }

  // Web links (must be evaluated BEFORE folder/file checks so URLs like https://site.com/ aren't treated as folders)
  const isWebUrl =
    /^(?:https?:\/\/|\/\/|browser:\/\/|www\.|(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$))/i.test(href) ||
    (!href.startsWith("file:") &&
      !href.startsWith("folder:") &&
      !href.startsWith("trajectory:") &&
      !href.startsWith("conversation:") &&
      !href.startsWith("plugin:") &&
      !href.startsWith("skill:") &&
      !/^[a-zA-Z]:[\\/]/.test(href) &&
      !/\.(?:html?|md|txt|json|ya?ml|[cm]?[jt]sx?|py|css|svg|png|jpe?g|gif|webp|pdf|docx?|xlsx?|pptx?|csv|mp[34]|wav|webm|zip)$/i.test(href) &&
      /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?::\d+)?(?:\/.*)?$/i.test(href));

  if (isWebUrl) {
    let targetUrl = href;
    if (targetUrl.startsWith("browser://")) {
      targetUrl = targetUrl.replace(/^browser:\/\/\/?/i, "");
    }
    if (targetUrl.startsWith("//")) {
      targetUrl = `https:${targetUrl}`;
    } else if (!/^[a-zA-Z]+:\/\//i.test(targetUrl)) {
      if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(targetUrl)) {
        targetUrl = `http://${targetUrl}`;
      } else {
        targetUrl = `https://${targetUrl}`;
      }
    }
    return { type: "web", url: targetUrl };
  }

  // Trajectory / Conversation links
  if (href.startsWith("trajectory://") || href.startsWith("conversation://")) {
    const targetIdOrPath = href.replace(/^(?:trajectory|conversation):\/\/\/?/i, "");
    return { type: "trajectory", idOrPath: targetIdOrPath };
  }

  // Unknown schemes must never become filesystem paths, even with a trailing slash.
  if (/^[a-z][\w+.-]*:/i.test(href) && !/^(?:file|folder):/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) return { type: "none" };

  // Folder links
  if (href.startsWith("folder://") || href.endsWith("/")) {
    let cleanDir = decode(href.replace(/^folder:\/\//i, "").replace(/^file:\/\//i, ""));
    if (/^\/[a-zA-Z]:/i.test(cleanDir)) {
      cleanDir = cleanDir.slice(1);
    }
    return { type: "folder", path: cleanDir };
  }

  // File links
  if (
    href.startsWith("file://") ||
    href.startsWith("file;file://") ||
    href.startsWith("file;") ||
    /^[a-zA-Z]:[\\/]/.test(href)
  ) {
    let cleaned = href
      .replace(/^file;file:\/\//i, "")
      .replace(/^file:\/\//i, "")
      .replace(/^file;/i, "");
    if (/^\/[a-zA-Z]:/i.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
    return { type: "file", path: decode(cleaned) };
  }

  if (!href.startsWith("#") && (/^(?:\/|\.{1,2}[\\/]|~[\\/])/.test(href) || /[\\/]/.test(href) || /\.[\w-]+$/.test(href))) return { type: "file", path: decode(href) };

  return { type: "none" };
}

/** Canonical local links survive sanitization without allowing arbitrary URI schemes. */
export function markdownLinkHref(href: string): string {
  const resolved = resolveMarkdownLink(href);
  if (resolved.type !== "file" && resolved.type !== "folder") return href;
  const path = resolved.path.replace(/\\/g, "/").replace(/^\.\//, "");
  const encoded = encodeURI(path).replace(/#/g, "%23").replace(/\?/g, "%3F");
  if (/^(?:\/|[a-z]:\/)/i.test(path)) return `${resolved.type === "folder" ? "folder" : "file"}://${path.startsWith("/") ? "" : "/"}${encoded}`;
  return `workspace:///${encoded}`;
}
