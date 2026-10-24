import type { BridgeRequest, BridgeResponse, ComputerSnapshot } from "./computer-types";

const methods: Record<string, string> = {
  handshake: "handshake", list_apps: "listApps", list_windows: "listWindows", get_app_state: "getAppState",
  click: "click", set_value: "setValue", type_text: "typeText", press_key: "pressKey", hotkey: "hotkey",
  paste_text: "pasteText", scroll: "scroll", drag: "drag", perform_secondary_action: "performSecondaryAction",
};

export function encodeMacRequest(request: BridgeRequest): object {
  const method = methods[request.tool];
  if (!method) throw new Error(`Unsupported macOS computer tool: ${request.tool}`);
  const params: Record<string, unknown> = {};
  for (const key of ["app", "windowId", "windowIndex", "noScreenshot", "restoreWindow", "x", "y", "direction", "pages", "text", "key", "value", "modifiers", "action", "session"] as const) {
    if (request[key] !== undefined && request[key] !== null) params[key] = request[key];
  }
  Object.assign(params, {
    elementIndex: request.element?.index, fromElementIndex: request.fromElement?.index, toElementIndex: request.toElement?.index,
    fromX: request.from_x, fromY: request.from_y, toX: request.to_x, toY: request.to_y,
    mouseButton: request.mouse_button, clickCount: request.click_count,
  });
  return { id: request.requestId, method, params };
}

export function decodeMacResponse(raw: any, request: BridgeRequest): BridgeResponse {
  if (typeof raw?.id !== "number" || typeof raw?.ok !== "boolean") throw new Error("Invalid macOS computer response envelope");
  if (!raw.ok) return { requestId: raw.id, ok: false, error: `${raw.error?.code ?? "native_error"}: ${raw.error?.message ?? String(raw.error)}` };
  const result = raw.result;
  if (!result || typeof result !== "object") throw new Error("macOS computer response is missing its result");
  if (request.tool === "handshake") return { requestId: raw.id, ok: true, capabilities: result };
  if (request.tool === "list_apps") {
    if (!Array.isArray(result.apps)) throw new Error("Invalid macOS app list");
    return { requestId: raw.id, ok: true, apps: result.apps };
  }
  if (request.tool === "list_windows") {
    if (!Array.isArray(result.windows)) throw new Error("Invalid macOS window list");
    return { requestId: raw.id, ok: true, app: result.app, windows: result.windows };
  }
  const native = result.snapshot;
  const screenshot = result.screenshot;
  let snapshot: ComputerSnapshot | undefined;
  if (request.tool === "get_app_state" && !native) throw new Error("macOS observation returned no snapshot");
  if (native) {
    if (!native.app || !native.window || typeof native.treeText !== "string") throw new Error("Invalid macOS snapshot");
    const elements = native.elements ?? Array.from(native.treeText.matchAll(/^\s*(\d+)\s+/gm), (match: RegExpMatchArray) => ({ index: Number(match[1]) }));
    snapshot = {
      id: native.id, app: native.app, windowId: native.window.id, windowIndex: native.window.index,
      windowTitle: native.window.title,
      windowBounds: { x: native.window.x, y: native.window.y, width: native.window.width, height: native.window.height },
      treeText: native.treeText, elements, elementCount: native.elementCount, focusedElementId: native.focusedElementId,
      screenshotPngBase64: screenshot?.data ?? null, screenshotWidth: screenshot?.width, screenshotHeight: screenshot?.height, screenshotScale: screenshot?.scale,
    };
  }
  return { requestId: raw.id, ok: true, snapshot, action: result.action, observationError: result.observationError };
}
