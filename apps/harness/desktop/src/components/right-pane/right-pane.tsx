import React, { useRef } from "react";
import { MessageSquare, Globe } from "lucide-react";
import { TabHeader } from "./tab-header";
import { OpenTabView } from "./open-tab-view";
import { TerminalTab } from "./terminal-tab";
import { TaskOutputTab } from "./task-output-tab";
import { ReviewTab } from "./review-tab";
import { FileDiffTab } from "./file-diff-tab";
import { FilePreviewTab } from "./file-preview-tab";
import { BrowserTab } from "./browser-tab";
import { SubagentTab } from "./subagent-tab";
import { SideChatTab } from "./side-chat-tab";
import type { RightPaneTab, RightPaneTabType, BrowserSelectedElement } from "./types";
import type { FileMutationRecord, SubAgentItem } from "../../vite-env";
import type { ConversationItem } from "../../lib/conversation-store";
import { useTranslation } from "../../lib/i18n";

interface RightPaneProps {
  width: number;
  maxWidth?: number;
  minWidth?: number;
  onWidthChange: (width: number) => void;
  tabs: RightPaneTab[];
  activeTabId: string | null;
  isOpeningNewTab: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  onOpenTabType: (type: RightPaneTabType) => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  workspacePath?: string;
  mutations?: FileMutationRecord[];
  onRollbackFile?: (record: FileMutationRecord) => Promise<any> | void;
  onRollbackAll?: (records: FileMutationRecord[]) => Promise<any> | void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  conversations?: ConversationItem[];
  onStopTask?: (taskId: string) => void;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onSelectElementForChat?: (element: BrowserSelectedElement) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  subagents?: SubAgentItem[];
  onKillAgent?: (agentId: string) => void;
  parentMessages?: any[];
  parentConversationTitle?: string;
  parentConversationId?: string;
  defaultModel?: string;
  onInsertToMainPrompt?: (text: string) => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function RightPane({
  width,
  maxWidth,
  minWidth = 300,
  onWidthChange,
  tabs,
  activeTabId,
  isOpeningNewTab,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenTabType,
  onReorderTabs,
  workspacePath,
  mutations,
  onRollbackFile,
  onRollbackAll,
  onOpenFileDiff,
  onOpenFilePreview,
  onOpenTrajectory,
  conversations,
  onStopTask,
  onUpdateTab,
  onSelectElementForChat,
  onDraggingChange,
  subagents,
  onKillAgent,
  parentMessages,
  parentConversationTitle,
  parentConversationId,
  defaultModel,
  onInsertToMainPrompt,
  onCollapse,
  isExpanded = false,
  onToggleExpand,
}: RightPaneProps) {
  const { t } = useTranslation();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const renderTabContent = (tab: RightPaneTab) => {
    switch (tab.type) {
      case "terminal":
        return <TerminalTab tab={tab} />;
      case "task_output":
        return <TaskOutputTab tab={tab} onStopTask={onStopTask} />;
      case "review":
        return (
          <ReviewTab
            mutations={mutations}
            onRollbackFile={onRollbackFile}
            onRollbackAll={onRollbackAll}
            onOpenFileDiff={onOpenFileDiff}
          />
        );
      case "file_diff":
        return <FileDiffTab tab={tab} onRollbackFile={onRollbackFile} />;
      case "file_preview":
      case "directory":
        return (
          <FilePreviewTab
            tab={tab}
            workspacePath={workspacePath}
            onOpenFilePreview={onOpenFilePreview}
            onUpdateTab={onUpdateTab}
          />
        );
      case "subagent":
        return (
          <SubagentTab
            tab={tab}
            subagents={subagents}
            onKillAgent={onKillAgent}
            onOpenFilePreview={onOpenFilePreview}
          />
        );
      case "side_conversation":
        return (
          <SideChatTab
            tab={tab}
            parentMessages={parentMessages}
            parentConversationTitle={parentConversationTitle}
            parentConversationId={parentConversationId}
            defaultModel={defaultModel}
            onOpenFilePreview={onOpenFilePreview}
            onOpenFileDiff={onOpenFileDiff}
            onRollbackFile={onRollbackFile}
            onRollbackAll={onRollbackAll}
            onInsertToMainPrompt={onInsertToMainPrompt}
            onUpdateTab={onUpdateTab}
            onOpenTrajectory={onOpenTrajectory}
            conversations={conversations}
          />
        );
      case "browser":
        return (
          <BrowserTab
            tab={tab}
            onUpdateTab={onUpdateTab}
            onSelectElementForChat={onSelectElementForChat}
          />
        );
      default:
        return null;
    }
  };

  return (
    <aside className="h-full w-full flex flex-col relative bg-[#ffffff] dark:bg-[#141414] border border-[#dedee2] dark:border-[#282828] rounded-[10px] overflow-hidden z-20 shadow-xs">
      {/* Top Tab Bar matching Image 1 & 2 */}
      <TabHeader
        tabs={tabs}
        activeTabId={activeTabId}
        isOpeningNewTab={isOpeningNewTab}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onNewTab={onNewTab}
        onReorderTabs={onReorderTabs}
        onCollapse={onCollapse}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onToggleMuteTab={(tabId) => {
          const target = tabs.find((t) => t.id === tabId);
          if (target && onUpdateTab) {
            onUpdateTab(tabId, { isMuted: !target.isMuted });
          }
        }}
      />

      {/* Main Tab Body (Persistent Stack keeping tabs alive in DOM) */}
      <div className="flex-1 w-full h-[calc(100%-44px)] min-h-0 relative overflow-hidden flex flex-col bg-[#ffffff] dark:bg-[#141414] z-10">
        {isOpeningNewTab || tabs.length === 0 || !activeTab ? (
          /* Empty / New Tab Picker matching Image 2 1:1 */
          <OpenTabView
            onSelectTabType={onOpenTabType}
            workspacePath={workspacePath}
          />
        ) : null}

        {tabs.map((tab) => {
          const isTabActive = !isOpeningNewTab && tab.id === activeTabId;
          const isBrowser = tab.type === "browser";
          return (
            <div
              key={tab.id}
              className={`w-full h-full min-h-0 ${
                isTabActive
                  ? "flex flex-col flex-1 relative z-10"
                  : isBrowser
                  ? "flex flex-col absolute inset-0 opacity-0 pointer-events-none -z-10"
                  : "hidden"
              }`}
              style={
                isTabActive
                  ? { display: "flex" }
                  : isBrowser
                  ? { display: "flex", visibility: "hidden" }
                  : { display: "none" }
              }
            >
              {renderTabContent(tab)}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
