import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  FileText,
  FilePlus,
  Code,
  Search,
  ListTodo,
  ExternalLink,
  ChevronDown,
  ArrowRight,
  Send,
  Wrench,
  Check,
  Circle,
  Layers,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";

export interface DisplayToolCall {
  id: string;
  name: string;
  args: any;
  result?: any;
  isError?: boolean;
  status: "running" | "completed" | "error";
}

// ---------------------------------------------------------------------------
// 1. Socratic Question Card (ask_question)
// ---------------------------------------------------------------------------
interface SocraticQuestionCardProps {
  toolCall: DisplayToolCall;
  onAnswer: (toolCallId: string, answer: string) => void;
}

export function SocraticQuestionCard({ toolCall, onAnswer }: SocraticQuestionCardProps) {
  const { t } = useI18n();
  const [customInput, setCustomInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawQuestion =
    toolCall.args?.question ||
    toolCall.args?.questions?.[0]?.question ||
    t("howToProceedFallback");

  const rawOptions: string[] = Array.isArray(toolCall.args?.options)
    ? toolCall.args.options
    : Array.isArray(toolCall.args?.questions?.[0]?.options)
    ? toolCall.args.questions[0].options
    : [];

  const allowCustom = toolCall.args?.allow_custom !== false;
  const isCompleted = toolCall.status === "completed" || Boolean(toolCall.result);

  const handleSelectOption = async (option: string) => {
    if (isCompleted || isSubmitting) return;
    setSelectedOption(option);
    setIsSubmitting(true);
    try {
      await onAnswer(toolCall.id, option);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || isCompleted || isSubmitting) return;
    setSelectedOption(trimmed);
    setIsSubmitting(true);
    try {
      await onAnswer(toolCall.id, trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-sky-500/30 bg-sky-950/10 dark:bg-sky-950/20 p-4 text-xs shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">
            {t("socraticQuestion")}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-sans font-medium">
            {t("inquiry")}
          </span>
        </div>

        {isCompleted ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-sans font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("answered")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-sans font-medium animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("waitingForChoice")}
          </span>
        )}
      </div>

      {/* Question Prompt */}
      <div className="text-sm font-medium text-foreground/95 leading-relaxed pl-1">
        {rawQuestion}
      </div>

      {/* Completed State View */}
      {isCompleted ? (
        <div className="p-3 rounded-xl bg-background/60 border border-border/50 text-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs">
              {t("choiceLabel")}{" "}
              <strong className="text-emerald-400">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : selectedOption || JSON.stringify(toolCall.result)}
              </strong>
            </span>
          </div>
        </div>
      ) : (
        /* Active Options Selection */
        <div className="space-y-2 pt-1">
          {rawOptions.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectOption(opt)}
              className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-medium flex items-center justify-between group cursor-pointer ${
                selectedOption === opt
                  ? "bg-sky-500/20 border-sky-400 text-sky-200"
                  : "bg-background/60 hover:bg-sky-500/10 border-border/60 hover:border-sky-500/40 text-foreground active:scale-99"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-muted/80 text-muted-foreground group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center text-[10px] font-sans tabular-nums font-medium transition-colors">
                  {idx + 1}
                </span>
                <span>{opt}</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}

          {/* Custom Text Input */}
          {allowCustom && (
            <form onSubmit={handleCustomSubmit} className="pt-1.5 flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                disabled={isSubmitting}
                placeholder={t("customAnswerPlaceholder")}
                className="flex-1 bg-background/80 border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-sky-500/70 transition-all"
              />
              <button
                type="submit"
                disabled={!customInput.trim() || isSubmitting}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                title={t("sendCustomAnswer")}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Python Runner Card (run_python with visual artifacts & plots)
// ---------------------------------------------------------------------------
interface PythonRunnerCardProps {
  toolCall: DisplayToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}

export function PythonRunnerCard({ toolCall, isExpanded, onToggle }: PythonRunnerCardProps) {
  const { t } = useI18n();
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});

  const artifacts: string[] = Array.isArray(toolCall.result?.artifacts)
    ? toolCall.result.artifacts
    : [];

  const code = toolCall.args?.code || "";
  const stdout = toolCall.result?.stdout || "";
  const stderr = toolCall.result?.stderr || "";

  // Load preview data URLs for visual artifacts (plots, charts, svgs)
  useEffect(() => {
    if (artifacts.length === 0) return;
    const electron = (window as any).electron;
    if (!electron?.readMedia) return;

    let isMounted = true;
    for (const artPath of artifacts) {
      if (
        artPath.endsWith(".png") ||
        artPath.endsWith(".svg") ||
        artPath.endsWith(".jpg") ||
        artPath.endsWith(".jpeg")
      ) {
        electron.readMedia(artPath).then((dataUri: string | null) => {
          if (isMounted && dataUri) {
            setMediaPreviews((prev) => ({ ...prev, [artPath]: dataUri }));
          }
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [artifacts]);

  const handleOpenPath = (targetPath: string) => {
    const electron = (window as any).electron;
    if (electron?.openPath) {
      electron.openPath(targetPath);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs overflow-hidden shadow-xs space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-yellow-500/15 text-yellow-500 flex items-center justify-center font-sans text-[10px] font-bold">
            Py
          </div>
          <span className="font-sans font-semibold text-foreground">
            Python Engine
          </span>
          <span className="text-[10px] text-muted-foreground font-sans truncate max-w-[200px] sm:max-w-xs">
            {code ? code.split("\n")[0]?.slice(0, 35) + "..." : t("calculation")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {toolCall.status === "running" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent font-sans font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("calculating")}
            </span>
          ) : toolCall.status === "completed" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-sans font-medium">
              <CheckCircle2 className="h-3 w-3" />
              {t("completed")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-sans font-medium">
              <AlertCircle className="h-3 w-3" />
              {t("failed")}
            </span>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="h-6 px-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] transition-colors cursor-pointer border border-border/40"
          >
            {isExpanded ? t("closeDetail") : t("details")}
          </button>
        </div>
      </div>

      {/* Visual Artifacts Display (Always show image preview even when collapsed) */}
      {artifacts.length > 0 && (
        <div className="space-y-2 pt-1">
          {artifacts.map((artPath) => {
            const fileName = artPath.split(/[\\/]/).pop() || artPath;
            const dataUri = mediaPreviews[artPath];

            return (
              <div
                key={artPath}
                className="p-2.5 rounded-xl bg-background/80 border border-border/40 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-sans text-foreground/90 flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-yellow-400" />
                    {t("generatedChart")} <strong>{fileName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenPath(artPath)}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                  >
                    <span>{t("openFile")}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>

                {dataUri && (
                  <div className="rounded-lg overflow-hidden border border-border/30 bg-card p-1">
                    <img
                      src={dataUri}
                      alt={fileName}
                      className="max-h-72 w-auto mx-auto object-contain rounded"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Code & Output Details */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-2 font-sans text-[11px]">
          {code && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1">
                {t("pythonCodeExecuted")}
              </div>
              <pre className="p-2.5 rounded-xl bg-background/80 border border-border/30 overflow-x-auto text-yellow-300/90 whitespace-pre max-h-48 overflow-y-auto font-mono">
                {code}
              </pre>
            </div>
          )}

          {stdout && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1">
                {t("stdoutOutput")}
              </div>
              <pre className="p-2.5 rounded-xl bg-background/80 border border-border/30 overflow-x-auto text-emerald-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {stdout}
              </pre>
            </div>
          )}

          {stderr && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1 text-destructive">
                Error (stderr):
              </div>
              <pre className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 overflow-x-auto text-destructive whitespace-pre-wrap max-h-48 overflow-y-auto">
                {stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Learning Roadmap / Todo Write Card (todo_write)
// ---------------------------------------------------------------------------
interface TodoWriteCardProps {
  toolCall: DisplayToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TodoWriteCard({ toolCall, isExpanded, onToggle }: TodoWriteCardProps) {
  const { t } = useI18n();
  const title = toolCall.args?.title || t("studyRoadmapAndTasks");
  const tasks: Array<{ id: string; text: string; status: "pending" | "in_progress" | "completed" }> =
    Array.isArray(toolCall.args?.tasks) ? toolCall.args.tasks : [];

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-3 text-xs shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <ListTodo className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-foreground">{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-sans tabular-nums font-medium">
            {t("tasksCompleted", { completed: completedCount, total: tasks.length })}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="h-6 px-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] transition-colors cursor-pointer border border-border/40"
        >
          {isExpanded ? t("closeDetail") : t("viewRoadmap")}
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-1.5 pt-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs transition-colors ${
              task.status === "completed"
                ? "bg-muted/40 border-border/40 text-muted-foreground line-through"
                : task.status === "in_progress"
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-200 font-medium"
                : "bg-background/60 border-border/50 text-foreground"
            }`}
          >
            {task.status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : task.status === "in_progress" ? (
              <Loader2 className="h-4 w-4 text-cyan-400 shrink-0 animate-spin mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{task.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Generic Tool Card (read, write, edit, run_command, ls, find, grep)
// ---------------------------------------------------------------------------
interface GenericToolCardProps {
  toolCall: DisplayToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}

export function GenericToolCard({ toolCall, isExpanded, onToggle }: GenericToolCardProps) {
  const { t } = useI18n();
  const getToolIcon = (name: string) => {
    switch (name) {
      case "run_command":
      case "bash":
        return <Terminal className="h-3.5 w-3.5 text-amber-500" />;
      case "read":
      case "read_file":
        return <FileText className="h-3.5 w-3.5 text-blue-400" />;
      case "write":
      case "write_file":
        return <FilePlus className="h-3.5 w-3.5 text-emerald-400" />;
      case "edit":
      case "edit_file":
        return <Code className="h-3.5 w-3.5 text-purple-400" />;
      case "ls":
      case "find":
      case "grep":
        return <Search className="h-3.5 w-3.5 text-orange-400" />;
      default:
        return <Wrench className="h-3.5 w-3.5 text-accent" />;
    }
  };

  const getArgSummary = (args: any) => {
    if (!args) return "";
    if (args.path) return args.path.split(/[\\/]/).slice(-2).join("/");
    if (args.command) {
      return args.command.length > 30 ? args.command.slice(0, 30) + "..." : args.command;
    }
    if (args.query) return `"${args.query}"`;
    return Object.keys(args).join(", ");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs overflow-hidden shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getToolIcon(toolCall.name)}
          <span className="font-sans font-semibold text-foreground">
            {toolCall.name}
          </span>
          <span
            className="text-[10px] text-muted-foreground font-sans truncate max-w-[200px] sm:max-w-xs"
            title={JSON.stringify(toolCall.args)}
          >
            ({getArgSummary(toolCall.args)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {toolCall.status === "running" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent font-sans font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("running")}
            </span>
          ) : toolCall.status === "completed" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-sans font-medium">
              <CheckCircle2 className="h-3 w-3" />
              {t("completed")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-sans font-medium">
              <AlertCircle className="h-3 w-3" />
              {t("failed")}
            </span>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="h-6 px-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] transition-colors cursor-pointer border border-border/40"
          >
            {isExpanded ? t("closeDetail") : t("details")}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-1.5 font-sans text-[11px]">
          <div className="text-muted-foreground text-[10px]">{t("inputParams")}</div>
          <pre className="p-2.5 rounded-xl bg-background/80 border border-border/30 overflow-x-auto text-foreground/90 font-mono">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>

          {toolCall.result && (
            <>
              <div className="text-muted-foreground text-[10px] mt-2">
                {t("executionResult")}
              </div>
              <pre className="p-2.5 rounded-xl bg-background/80 border border-border/30 overflow-x-auto text-emerald-500/90 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
