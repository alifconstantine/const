import React, { useCallback, useRef, useState } from "react";
import {
  Renderer,
  type ActionEvent,
  type OpenUIError,
  type ParseResult,
} from "@openuidev/react-lang";
import { ScrollArea, toast } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { intelligenceLibrary, InteractionContext } from "./library";

export interface IntelligenceBlockProps {
  program: string;
  complete: boolean;
  isStreaming: boolean;
  disabled: boolean;
  state?: Record<string, unknown>;
  onStateChange?: (state: Record<string, unknown>) => void;
  onSubmit?: (prompt: string) => void | Promise<void>;
}

export function ProgramSource({ program }: { program: string }) {
  const { t } = useTranslation();
  return (
    <details className="mt-2 text-xs text-[#737373] dark:text-[#969696]">
      <summary className="w-fit cursor-pointer rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5">
        {t("intelligenceUi.showSource")}
      </summary>
      <ScrollArea
        orientation="both"
        className="mt-2 max-h-60 rounded-xl bg-black/[0.03] dark:bg-[#222222]"
        thumbClassName="bg-white/20 hover:bg-white/30"
      >
        <pre className="p-3 font-mono text-xs">{program}</pre>
      </ScrollArea>
    </details>
  );
}

export default function IntelligenceBlock({
  program,
  complete,
  isStreaming,
  disabled,
  state,
  onStateChange,
  onSubmit,
}: IntelligenceBlockProps) {
  const { t } = useTranslation();
  const [initialState] = useState(() => state || {});
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  const [hasRoot, setHasRoot] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const lastState = useRef(JSON.stringify(initialState));
  const onParseResult = useCallback((result: ParseResult | null) => {
    setHasRoot(Boolean(result?.root));
    setIncomplete(
      Boolean(result?.meta.incomplete || result?.meta.unresolved.length),
    );
  }, []);
  const unavailable =
    !isStreaming && (!complete || incomplete || errors.length > 0 || !hasRoot);

  const onAction = async (event: ActionEvent) => {
    if (
      disabled ||
      isStreaming ||
      !complete ||
      unavailable ||
      submitting.current ||
      !onSubmit ||
      event.type !== "continue_conversation"
    )
      return;
    submitting.current = true;
    setPending(true);
    try {
      await onSubmit(event.humanFriendlyMessage);
    } catch {
      toast.error(t("intelligenceUi.submitFailed"));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <div
      className="min-w-0 font-sans text-[#262626] dark:text-white"
      data-intelligence-ui="true"
      aria-busy={isStreaming || pending}
    >
      <InteractionContext.Provider
        value={{
          disabled:
            disabled ||
            isStreaming ||
            !complete ||
            unavailable ||
            pending ||
            !onSubmit,
        }}
      >
        <Renderer
          response={program}
          library={intelligenceLibrary}
          isStreaming={isStreaming}
          initialState={initialState}
          onParseResult={onParseResult}
          onError={setErrors}
          onStateUpdate={(nextState) => {
            const serialized = JSON.stringify(nextState);
            if (serialized === lastState.current) return;
            lastState.current = serialized;
            onStateChange?.(nextState);
          }}
          onAction={(event) => {
            void onAction(event);
          }}
        />
      </InteractionContext.Provider>
      {isStreaming && !hasRoot && (
        <p
          role="status"
          className="rounded-xl bg-black/[0.025] p-4 text-xs text-[#969696] dark:bg-[#222222]"
        >
          {t("intelligenceUi.preparing")}
        </p>
      )}
      {unavailable && (
        <div
          role="status"
          className="mt-2 rounded-xl bg-black/[0.025] p-3 text-xs text-[#737373] dark:bg-[#222222] dark:text-[#969696]"
        >
          {t("intelligenceUi.unavailable")}
          <ProgramSource program={program} />
        </div>
      )}
    </div>
  );
}
