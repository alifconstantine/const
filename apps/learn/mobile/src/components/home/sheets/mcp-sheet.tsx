import React from "react";
import { X, Cable } from "lucide-react";
import { ScrollArea } from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import { InteractiveBottomSheet } from "./interactive-bottom-sheet";
import { MobileMcpTab } from "./mobile-mcp-tab";

export interface McpSheetProps {
  open: boolean;
  onClose: () => void;
}

export function McpSheet({ open, onClose }: McpSheetProps) {
  const { t } = useI18n();

  return (
    <InteractiveBottomSheet
      open={open}
      onClose={onClose}
      defaultHeightVh={82}
      ariaLabel={t("mcpServers") || "MCP Servers"}
    >
      {/* Sheet Top Header */}
      <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Cable className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {t("mcpServers") || "MCP Servers"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("mcpServersSubtitle") || "Connect and manage Model Context Protocol servers"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
          aria-label={t("close") || "Close"}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="px-4 py-3.5">
        <MobileMcpTab />
      </ScrollArea>
    </InteractiveBottomSheet>
  );
}
