import type { McpAppView } from "../../lib/mcp/apps";

let library: Promise<typeof import("@excalidraw/excalidraw")> | undefined;
export function loadExcalidraw() {
  (window as any).EXCALIDRAW_ASSET_PATH = new URL(
    `${import.meta.env.BASE_URL}excalidraw-assets/`,
    document.baseURI,
  ).href;
  return (library ??= import("@excalidraw/excalidraw"));
}
export async function normalizeDiagram(
  view: Pick<McpAppView, "scene" | "arguments">,
) {
  const api = await loadExcalidraw();
  const raw =
    view.scene?.elements ?? JSON.parse(String(view.arguments.elements ?? "[]"));
  if (!Array.isArray(raw)) throw new Error("invalid");
  // A canvas export registers and loads the library's bundled font faces. Calling
  // document.fonts.load before registration silently measures fallback fonts.
  const text = raw.map((el) => el.text ?? el.label?.text ?? "").join(" ");
  const probe = api.convertToExcalidrawElements([
    { type: "text", x: 0, y: 0, text: " " },
  ])[0];
  await api.exportToCanvas({
    elements: [{ ...probe, text, width: 1, height: 1 }] as any,
    appState: {},
    files: {},
    getDimensions: () => ({ width: 1, height: 1, scale: 1 }),
  });
  const draw = raw.filter(
    (el) =>
      el && !["cameraUpdate", "delete", "restoreCheckpoint"].includes(el.type),
  );
  const elements = draw.every((el) => typeof el.version === "number")
    ? draw
    : api.convertToExcalidrawElements(
        draw.map((el) =>
          el.label
            ? {
                ...el,
                label: {
                  textAlign: "center",
                  verticalAlign: "middle",
                  ...el.label,
                },
              }
            : el,
        ),
        { regenerateIds: false },
      );
  const restored = api.restore(
    {
      elements,
      appState: view.scene?.appState ?? { viewBackgroundColor: "#ffffff" },
      files: view.scene?.files ?? {},
    } as any,
    null,
    null,
  );
  return {
    elements: restored.elements as any[],
    appState: { viewBackgroundColor: restored.appState.viewBackgroundColor },
    files: restored.files,
  };
}
export function previewElements(elements: any[]) {
  // The remote app converts native elements as skeletons again. Skeleton text
  // coordinates describe its alignment anchor; native coordinates are top-left.
  return elements.map((el) =>
    el.type === "text"
      ? { ...el, textAlign: "left", verticalAlign: "top" }
      : el,
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
