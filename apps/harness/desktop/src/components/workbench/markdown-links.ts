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
  if (!href) return { type: "none" };

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

  // Folder links
  if (href.startsWith("folder://") || href.endsWith("/")) {
    let cleanDir = href.replace(/^folder:\/\/\/?/i, "").replace(/^file:\/\/\/?/i, "");
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
      .replace(/^file;file:\/\/\/?/i, "")
      .replace(/^file:\/\/\/?/i, "")
      .replace(/^file;/i, "");
    if (/^\/[a-zA-Z]:/i.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
    return { type: "file", path: cleaned };
  }

  return { type: "none" };
}
