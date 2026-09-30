import React from "react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  Progress,
  ScrollArea,
  cn,
} from "@const/ui";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAppUpdate } from "../../lib/app-update";
import { useI18n } from "../../lib/i18n";

export function DesktopUpdateBadge() {
  const {
    latestRelease,
    isUpdateAvailable,
    isDownloading,
    downloadProgress,
    isReadyToInstall,
    applyUpdate,
  } = useAppUpdate();
  const { t } = useI18n();

  if (!isUpdateAvailable || !latestRelease) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyUpdate();
  };

  return (
    <HoverCard openDelay={120} closeDelay={180}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          disabled={isDownloading}
          className={cn(
            "relative p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center outline-none select-none",
            "text-[#969696] hover:text-[#ffffff] hover:bg-[#383838]/50 focus:outline-none focus-visible:outline-none ring-0",
            isDownloading && "cursor-wait opacity-70"
          )}
          title={`${t("updateAvailable")}: ${latestRelease.version}`}
          aria-label={t("updateAvailable")}
        >
          {/* Minimalist update icon */}
          {isDownloading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : isReadyToInstall ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
          )}

          {/* Minimalist notification dot */}
          {!isDownloading && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        side="bottom"
        sideOffset={8}
        alignOffset={-8}
        className="w-80 p-3.5 bg-[#222222] border border-[#383838] text-foreground rounded-xl shadow-none outline-none focus:outline-none focus-visible:outline-none ring-0 select-none font-sans text-xs animate-in fade-in-50 zoom-in-95 duration-100 z-50"
      >
        {/* Release Header */}
        <div className="flex flex-col gap-0.5 mb-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-xs text-white">
              {latestRelease.version} {t("releaseNotes")}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#1b1b1b] border border-[#2e2e2e] text-[10px] text-[#969696] font-sans">
              {t("updateAvailable")}
            </span>
          </div>
          <span className="text-[11px] text-[#969696]">
            {latestRelease.releaseDate}
          </span>
        </div>

        {/* Scrollable Changelog List (Mandatory Radix ScrollArea per DESIGN.md) */}
        <ScrollArea className="max-h-48 pr-2">
          <div className="flex flex-col gap-3">
            {latestRelease.sections.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[#d4d4d4]">
                  {section.title === "Bug Fixes"
                    ? t("bugFixes")
                    : section.title === "What's New"
                    ? t("whatsNew")
                    : section.title}
                </span>
                <ul className="flex flex-col gap-1 pl-1">
                  {section.items.map((item, itemIdx) => (
                    <li
                      key={itemIdx}
                      className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#969696]"
                    >
                      <span className="text-[#5d5d5d] shrink-0 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Download Progress Indicator (if active) */}
        {isDownloading && (
          <div className="mt-2.5 pt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-[#969696]">
              <span>{t("downloadingUpdate")}</span>
              <span className="font-sans">{downloadProgress}%</span>
            </div>
            <Progress value={downloadProgress} className="h-1 bg-[#1b1b1b]" />
          </div>
        )}

        {/* Minimalist Action Button (Zero shadow, Level 2 fill, no sparkles) */}
        <button
          type="button"
          onClick={applyUpdate}
          disabled={isDownloading}
          className="w-full mt-3 py-1.5 px-3 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-white border border-[#383838] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer outline-none focus:outline-none"
        >
          {isDownloading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>{t("downloadingUpdate")}</span>
            </>
          ) : isReadyToInstall ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t("restartAndInstall")}</span>
            </>
          ) : (
            <>
              <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t("updateNow")}</span>
            </>
          )}
        </button>
      </HoverCardContent>
    </HoverCard>
  );
}
