/** Native media URLs resolve through encrypted RPC; the web never exposes a public file server. */
export function installRemoteAssets() {
  let disposed = false;
  const cache = new Map<string, Promise<string>>();
  const pending = new WeakMap<Element, string>();
  let cachedBytes = 0;
  const transparent =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const update = (element: Element) => {
    if (
      !["IMG", "VIDEO", "AUDIO", "SOURCE", "IFRAME"].includes(element.tagName)
    )
      return;
    const source = element.getAttribute("src") || "";
    if (!source.startsWith("const-file://") && !source.startsWith("file:///"))
      return;
    let path = source.replace(/^(?:const-file|file):\/\//, "");
    try {
      path = decodeURIComponent(path);
    } catch {
      return;
    }
    path = path.replace(/^\/([A-Za-z]:)/, "$1");
    element.setAttribute("src", element.tagName === "IMG" ? transparent : "");
    pending.set(element, source);
    let result = cache.get(path);
    if (!result) {
      result = window.electron!.readAsDataUrl!(path).then((value) => {
        if (!value.success || typeof value.dataUrl !== "string")
          throw new Error("REMOTE_ASSET_FAILED");
        cachedBytes += value.dataUrl.length;
        if (cachedBytes > 24 * 1024 * 1024) {
          cache.clear();
          cachedBytes = 0;
        }
        return value.dataUrl;
      });
      cache.set(path, result);
    }
    void result
      .then((data) => {
        if (disposed || !element.isConnected || pending.get(element) !== source)
          return;
        const current = element.getAttribute("src");
        if (current !== (element.tagName === "IMG" ? transparent : "")) return;
        if (element.tagName === "IFRAME") {
          if (!data.startsWith("data:application/pdf;")) return;
          element.setAttribute("sandbox", "");
        }
        element.setAttribute("src", data);
      })
      .catch(() => {
        cache.delete(path);
      });
  };
  const visit = (element: Element) => {
    update(element);
    element
      .querySelectorAll(
        "img[src],video[src],audio[src],source[src],iframe[src]",
      )
      .forEach(update);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") update(record.target as Element);
      for (const node of record.addedNodes)
        if (node instanceof Element) visit(node);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  visit(document.documentElement);
  return () => {
    disposed = true;
    observer.disconnect();
    cache.clear();
  };
}
