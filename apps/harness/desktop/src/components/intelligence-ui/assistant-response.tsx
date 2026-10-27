import React, { lazy, Suspense, useMemo } from "react";
import { ScrollArea } from "@const/ui";
import { MarkdownContent } from "../workbench/markdown-content";
import { useTranslation } from "../../lib/i18n";
import { splitAssistantResponse } from "./protocol";
import type { IntelligenceUiState } from "./schema";

const IntelligenceBlock = lazy(() => {
  // react-lang 1.0.1 auto-mounts a CDN-backed inspector in development.
  // Keep desktop output self-contained; the production build removes this branch.
  if (import.meta.env.DEV) {
    (globalThis as Record<symbol, unknown>)[
      Symbol.for("openui.devtools.autoMount")
    ] = true;
  }
  return import("./intelligence-block");
});

interface AssistantResponseProps {
  content: string;
  isStreaming?: boolean;
  disabled?: boolean;
  state?: IntelligenceUiState;
  onStateChange?: (blockId: string, state: Record<string, unknown>) => void;
  onSubmit?: (prompt: string) => void | Promise<void>;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onOpenBrowser?: (url: string) => void;
}

class BlockBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; program: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous: Readonly<{ program: string }>) {
    if (previous.program !== this.props.program && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function AssistantResponse({
  content,
  isStreaming = false,
  disabled = false,
  state,
  onStateChange,
  onSubmit,
  onOpenFilePreview,
  onOpenTrajectory,
  onOpenBrowser,
}: AssistantResponseProps) {
  const { t } = useTranslation();
  const parts = useMemo(
    () => splitAssistantResponse(content, isStreaming),
    [content, isStreaming],
  );
  return (
    <div className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
      {parts.map((part) =>
        part.kind === "markdown" ? (
          <MarkdownContent
            key={part.id}
            content={part.content}
            onOpenFilePreview={onOpenFilePreview}
            onOpenTrajectory={onOpenTrajectory}
            onOpenBrowser={onOpenBrowser}
          />
        ) : (
          <BlockBoundary
            key={part.id}
            program={part.content}
            fallback={
              <div
                role="status"
                className="rounded-xl bg-black/[0.025] p-4 text-xs text-[#737373] dark:bg-[#222222] dark:text-[#969696]"
              >
                {t("intelligenceUi.unavailable")}
                <details className="mt-2">
                  <summary className="cursor-pointer">
                    {t("intelligenceUi.showSource")}
                  </summary>
                  <ScrollArea orientation="both" className="mt-2 max-h-60">
                    <pre className="p-2 font-mono text-xs">{part.content}</pre>
                  </ScrollArea>
                </details>
              </div>
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-4 text-xs text-[#969696]">
                  {t("intelligenceUi.preparing")}
                </p>
              }
            >
              <IntelligenceBlock
                program={part.content}
                complete={part.complete}
                isStreaming={isStreaming && !part.complete}
                disabled={disabled}
                state={state?.[part.id]}
                onStateChange={
                  onStateChange
                    ? (value) => onStateChange(part.id, value)
                    : undefined
                }
                onSubmit={onSubmit}
                onOpenBrowser={onOpenBrowser}
              />
            </Suspense>
          </BlockBoundary>
        ),
      )}
    </div>
  );
}
