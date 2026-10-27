import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useTranslation } from "../src/lib/i18n";
import { ChatMessageItem } from "../src/components/workbench/chat-message-item";
import { FilePreviewTab } from "../src/components/right-pane/file-preview-tab";
import { ScrollArea } from "@const/ui";
import "../src/index.css";

const fixture = await (await fetch("/__excalidraw-fixture")).json();
let scene = fixture.view.scene;
const filePath =
  "C:/Fixture/artifacts/diagrams/" + fixture.view.id + ".excalidraw";
(window as any).electron = {
  mcp: {
    appView: async () => ({ ...fixture.view, filePath, scene }),
    saveDiagram: async (_id: string, value: any) => {
      scene = value;
      localStorage.setItem("excalidraw-fixture-scene", JSON.stringify(value));
      return filePath;
    },
    readDiagram: async () => ({
      id: fixture.view.id,
      title: "Excalidraw",
      filePath,
      scene,
    }),
    appContext: async () => {},
    appCall: async (_id: string, name: string, args: any) => {
      if (name === "save_checkpoint") {
        scene = JSON.parse(args.data);
        localStorage.setItem("excalidraw-fixture-scene", JSON.stringify(scene));
      }
      return {
        content: [
          {
            type: "text",
            text: name === "read_checkpoint" ? JSON.stringify(scene) : "ok",
          },
        ],
      };
    },
  },
  openExternal: async () => {},
};
function Fixture() {
  const { language, setLanguage } = useTranslation();
  const [open, setOpen] = useState<string>();
  const ref = { id: fixture.view.id, title: "Excalidraw", filePath };
  return (
    <div className="h-screen flex flex-col bg-[#161616] text-white">
      <header className="h-11 px-5 bg-[#222222] flex items-center justify-between text-xs">
        <span>Excalidraw · public server, synthetic diagram</span>
        <button onClick={() => setLanguage(language === "en" ? "id" : "en")}>
          EN / ID
        </button>
      </header>
      <div className="flex flex-1 min-h-0">
        <ScrollArea
          className={open ? "w-[46%] p-6" : "w-full max-w-[960px] mx-auto p-8"}
        >
          <ChatMessageItem
            message={{
              id: "diagram-message",
              role: "assistant",
              content: "Diagram percakapan dan editor Excalidraw.",
              toolCalls: [
                {
                  id: "draw",
                  name: "mcp_fixture_create_view",
                  result: JSON.stringify({ constMcpApp: ref }),
                },
              ],
            }}
            onOpenFilePreview={setOpen}
          />
        </ScrollArea>
        {open && (
          <div className="flex-1 min-w-0 bg-[#222222] flex flex-col">
            <div className="h-10 px-4 flex items-center justify-between text-xs">
              <span>Excalidraw</span>
              <button onClick={() => setOpen(undefined)}>Close editor</button>
            </div>
            <div className="flex-1 min-h-0">
              <FilePreviewTab
                tab={{
                  id: "diagram",
                  type: "file_preview",
                  title: "Excalidraw",
                  filePath: open,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
