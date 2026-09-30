import { X, RefreshCw, CheckCircle2, ArrowDownCircle } from "lucide-react";
import { Button, Progress, cn } from "@const/ui";
import { InteractiveBottomSheet } from "./interactive-bottom-sheet";
import { useAppUpdate } from "../../../lib/app-update";
import { useI18n } from "../../../lib/i18n";

export interface UpdateSheetProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateSheet({ open, onClose }: UpdateSheetProps) {
  const {
    latestRelease,
    isDownloading,
    downloadProgress,
    isReadyToInstall,
    applyUpdate,
    dismissUpdate,
  } = useAppUpdate();
  const { t } = useI18n();

  if (!latestRelease) return null;

  const handleUpdate = async () => {
    await applyUpdate();
  };

  const handleLater = () => {
    dismissUpdate();
    onClose();
  };

  return (
    <InteractiveBottomSheet
      open={open}
      onClose={onClose}
      defaultHeightVh={70}
      ariaLabel={t("releaseNotes")}
    >
      <div className="flex flex-col h-full bg-[#1e1e1e] text-foreground select-none pb-safe">
        {/* Header Strip */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#383838]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-white flex items-center gap-2">
                <span>{latestRelease.version}</span>
                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {t("updateAvailable")}
                </span>
              </h2>
              <p className="text-[11px] text-[#969696] font-normal">
                {latestRelease.releaseDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label={t("cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {latestRelease.sections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-2">
              <h3 className="font-medium text-xs text-[#ffffff]">
                {section.title === "Bug Fixes"
                  ? t("bugFixes")
                  : section.title === "What's New"
                  ? t("whatsNew")
                  : section.title}
              </h3>
              <div className="flex flex-col gap-2 bg-[#252525] p-3 rounded-xl border border-[#383838]/60">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-start gap-2.5 text-xs text-[#d4d4d4] leading-relaxed">
                    <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Download Progress Bar */}
          {isDownloading && (
            <div className="bg-[#252525] p-3.5 rounded-xl border border-emerald-500/30 flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between text-xs text-emerald-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {t("downloadingUpdate")}
                </span>
                <span className="font-mono font-semibold">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2 bg-[#1a1a1a]" />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#383838] flex items-center gap-2.5 bg-[#1e1e1e]">
          <Button
            type="button"
            variant="ghost"
            onClick={handleLater}
            disabled={isDownloading}
            className="flex-1 h-10 rounded-xl text-xs text-[#969696] hover:text-white hover:bg-muted/40 cursor-pointer"
          >
            {t("updateLater")}
          </Button>

          <Button
            type="button"
            onClick={handleUpdate}
            disabled={isDownloading}
            className="flex-2 h-10 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t("downloadingUpdate")}</span>
              </>
            ) : isReadyToInstall ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("restartAndInstall")}</span>
              </>
            ) : (
              <>
                <ArrowDownCircle className="w-4 h-4" />
                <span>{t("updateNow")}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </InteractiveBottomSheet>
  );
}
