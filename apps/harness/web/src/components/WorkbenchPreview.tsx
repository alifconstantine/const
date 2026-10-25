"use client";
import {
  CalendarClock,
  Check,
  ChevronRight,
  FileCode,
  Folder,
  Globe,
  Layers,
  Plus,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useI18n } from "@/context/I18nContext";

// Product illustration based on the desktop workbench's panes and modes.
export function WorkbenchPreview({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={`ch-workbench ${compact ? "ch-workbench-compact" : ""}`}
      role="img"
      aria-label={t("preview.alt")}
    >
      <div className="ch-workbench-titlebar">
        <span className="ch-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>Const Harness</span>
        <span />
      </div>
      <div className="ch-workbench-body">
        <aside className="ch-workbench-sidebar">
          <div className="ch-preview-new">
            <Plus size={15} />
            {t("preview.new")}
          </div>
          <div>
            <Layers size={15} />
            {t("capabilities.0.title")}
          </div>
          <div>
            <CalendarClock size={15} />
            {t("platform.2.title")}
          </div>
          <p>{t("preview.projects")}</p>
          <div>
            <Folder size={15} />
            const-platform
          </div>
          <span className="ch-preview-selected">{t("preview.task")}</span>
          <span>{t("tasks.1.title")}</span>
          <span>{t("tasks.0.title")}</span>
        </aside>
        <div className="ch-workbench-chat">
          <div className="ch-preview-toolbar">
            <span>
              <Folder size={14} />
              const-platform
            </span>
            <span>
              <ShieldCheck size={13} />
              {t("preview.mode")}
            </span>
          </div>
          <div className="ch-preview-conversation">
            <p className="ch-preview-prompt">{t("preview.prompt")}</p>
            <div className="ch-preview-trace">
              <ChevronRight size={13} />
              {t("preview.inspect")}
            </div>
            <div className="ch-preview-trace">
              <Terminal size={13} />
              <code>pnpm check-types</code>
              <Check size={13} />
            </div>
            <p>{t("preview.response")}</p>
            <div className="ch-preview-file">
              <FileCode size={17} />
              <span>src/app/page.tsx</span>
              <span>+48 −12</span>
            </div>
            <div className="ch-preview-file">
              <Globe size={17} />
              <span>{t("preview.browser")}</span>
              <Check size={14} />
            </div>
          </div>
          <div className="ch-preview-composer">
            <span>{t("preview.composer")}</span>
            <span>↑</span>
          </div>
        </div>
        <div className="ch-workbench-review">
          <div className="ch-preview-toolbar">
            <span>
              <Layers size={14} />
              {t("preview.review")}
            </span>
            <span>+48 −12</span>
          </div>
          <div className="ch-preview-code-file">
            <FileCode size={14} />
            src/app/page.tsx
          </div>
          <pre>
            <code>{`  export default function Page() {\n    return (\n      <main>\n+       <Navbar />\n+       <HeroSection />\n+       <TaskExplorer />\n+       <Capabilities />\n+       <DownloadSection />\n+       <Footer />\n      </main>\n    );\n  }`}</code>
          </pre>
          <div className="ch-preview-check">
            <Check size={15} />
            {t("preview.checked")}
          </div>
        </div>
      </div>
    </div>
  );
}
