import React, {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BuiltinActionType,
  Renderer,
  type ActionEvent,
  type OpenUIError,
  type ParseResult,
} from "@openuidev/react-lang";
import { ScrollArea, toast } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { intelligenceLibrary } from "./library";
import { validUiState } from "./schema";
import { validateUiProgram } from "./validation";
import { safeWidgetLink } from "./widget-contract";
import { formatFormSubmission, submissionFields } from "./format";
import { scopeControlIds } from "./control-ids";

export interface IntelligenceBlockProps {
  program: string;
  complete: boolean;
  isStreaming: boolean;
  disabled: boolean;
  state?: Record<string, unknown>;
  onStateChange?: (state: Record<string, unknown>) => void;
  onSubmit?: (prompt: string) => void | Promise<void>;
  onOpenBrowser?: (url: string) => void;
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
  onOpenBrowser,
}: IntelligenceBlockProps) {
  const { t } = useTranslation();
  const controlRoot = useRef<HTMLFieldSetElement>(null);
  const controlPrefix = `const-ui-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  useLayoutEffect(() => {
    const root = controlRoot.current;
    if (!root) return;
    const scope = () => scopeControlIds(root, controlPrefix);
    scope();
    const observer = new MutationObserver(scope);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "for"],
    });
    return () => observer.disconnect();
  }, [controlPrefix]);
  const [initialState] = useState(() => (validUiState(state) ? state : {}));
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
  const validation = useMemo(
    () => (complete ? validateUiProgram(program) : null),
    [complete, program],
  );
  const invalid = Boolean(validation?.errors.length);
  const unavailable =
    !isStreaming &&
    (!complete ||
      incomplete ||
      errors.some((error) => error.severity !== "warning") ||
      !hasRoot ||
      invalid);

  const onAction = async (event: ActionEvent) => {
    if (disabled || isStreaming || !complete || unavailable) return;

    if (
      event.type === "open_url" ||
      (typeof BuiltinActionType !== "undefined" &&
        event.type === BuiltinActionType.OpenUrl)
    ) {
      const url = safeWidgetLink(event.params?.url);
      if (url) {
        if (onOpenBrowser) {
          onOpenBrowser(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
      return;
    }

    if (
      (event.type === "continue_conversation" ||
        (typeof BuiltinActionType !== "undefined" &&
          event.type === BuiltinActionType.ContinueConversation)) &&
      onSubmit &&
      !submitting.current
    ) {
      submitting.current = true;
      setPending(true);
      try {
        let msg = event.humanFriendlyMessage || "";
        if (
          validUiState(event.formState) &&
          Object.keys(event.formState).length > 0
        ) {
          const fields = submissionFields(event.formState, event.formName).map(
            (field) => {
              const input = [
                ...(controlRoot.current?.querySelectorAll<HTMLInputElement>(
                  "input[name],select[name],textarea[name]",
                ) || []),
              ].find((element) => element.name === field.label);
              return {
                ...field,
                label: input?.labels?.[0]?.textContent?.trim() || field.label,
              };
            },
          );
          msg = formatFormSubmission(msg, fields, {
            yes: t("common.yes"),
            no: t("common.no"),
          });
        }
        if (!msg.trim()) return;
        await onSubmit(msg);
      } catch {
        toast.error(t("intelligenceUi.submitFailed"));
      } finally {
        submitting.current = false;
        setPending(false);
      }
    }
  };

  return (
    <div
      className="min-w-0 font-sans text-[#262626] dark:text-white"
      data-intelligence-ui="true"
      aria-busy={isStreaming || pending}
    >
      <fieldset
        ref={controlRoot}
        className="m-0 min-w-0 border-0 p-0 disabled:opacity-60"
        disabled={
          disabled ||
          isStreaming ||
          !complete ||
          unavailable ||
          pending ||
          !onSubmit
        }
        inert={
          disabled ||
          isStreaming ||
          !complete ||
          unavailable ||
          pending ||
          !onSubmit
        }
      >
        {!invalid && (
          <Renderer
            response={program}
            library={intelligenceLibrary}
            isStreaming={isStreaming || disabled || pending || !onSubmit}
            initialState={initialState}
            onParseResult={onParseResult}
            onError={setErrors}
            onStateUpdate={(nextState) => {
              if (disabled || isStreaming || !complete || pending || !onSubmit)
                return;
              if (!validUiState(nextState)) return;
              const serialized = JSON.stringify(nextState);
              if (serialized === lastState.current) return;
              lastState.current = serialized;
              onStateChange?.(nextState);
            }}
            onAction={(event) => {
              void onAction(event);
            }}
            publishObservability={false}
          />
        )}
      </fieldset>
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
