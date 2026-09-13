import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Brain,
  Terminal,
  FileCode,
  FilePlus,
  FileText,
  Search,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Check,
  ArrowRight,
  Send,
  Wrench,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";

export interface DisplayToolCall {
  id: string;
  name: string;
  args: any;
  result?: any;
  isError?: boolean;
  status?: "running" | "completed" | "error";
  durationMs?: number;
}

export interface ExecutionTraceProps {
  thinking?: string;
  toolCalls?: DisplayToolCall[];
  isExecuting?: boolean;
  durationMs?: number;
  onAnswerQuestion?: (toolCallId: string, answer: any) => void;
}

// ---------------------------------------------------------------------------
// Hardware-accelerated CSS Grid Accordion for buttery-smooth expansion
// ---------------------------------------------------------------------------
export function SmoothCollapse({
  isOpen,
  children,
  className = "",
}: {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        opacity: isOpen ? 1 : 0,
        transition:
          "grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease-out",
        pointerEvents: isOpen ? "auto" : "none",
      }}
      className={className}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}

export function ExecutionTrace({
  thinking,
  toolCalls = [],
  isExecuting = false,
  durationMs,
  onAnswerQuestion,
}: ExecutionTraceProps) {
  // Auto-open while executing; auto-close when finished
  const [isMainOpen, setIsMainOpen] = useState(isExecuting);
  const wasExecutingRef = useRef(isExecuting);

  useEffect(() => {
    if (isExecuting && !wasExecutingRef.current) {
      setIsMainOpen(true);
    } else if (!isExecuting && wasExecutingRef.current) {
      setIsMainOpen(false);
    }
    wasExecutingRef.current = isExecuting;
  }, [isExecuting]);

  const hasThinking = Boolean(thinking && thinking.trim().length > 0);
  const hasTools = toolCalls && toolCalls.length > 0;
  const hasContent = hasThinking || hasTools || isExecuting;

  if (!hasContent) return null;

  // Format execution duration e.g. "Worked for 12s", "Working for 5s..."
  const formatDuration = () => {
    if (isExecuting) {
      if (!durationMs || durationMs < 1000) return "Working...";
      const s = Math.round(durationMs / 1000);
      if (s < 60) return `Working for ${s}s...`;
      const m = Math.floor(s / 60);
      const remS = s % 60;
      return remS === 0 ? `Working for ${m}m...` : `Working for ${m}m ${remS}s...`;
    }
    if (!durationMs || durationMs < 1000) return "Worked for a few seconds";
    const s = Math.round(durationMs / 1000);
    if (s < 60) return `Worked for ${s}s`;
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return remS === 0 ? `Worked for ${m}m` : `Worked for ${m}m ${remS}s`;
  };

  return (
    <div className="w-full flex flex-col gap-1.5 select-none my-1 font-sans">
      {/* Root Accordion Trigger: e.g. Worked for 12s > */}
      <button
        type="button"
        onClick={() => setIsMainOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 w-fit select-none group"
      >
        <span className="font-medium">{formatDuration()}</span>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-foreground transition-transform duration-200 ease-out",
            isMainOpen && "rotate-90"
          )}
        />
      </button>

      {/* Trace Body */}
      <SmoothCollapse isOpen={isMainOpen}>
        <div className="flex flex-col gap-2 pl-3 ml-1 border-l border-border/60 text-[13px] text-muted-foreground pt-1.5 pb-0.5">
          {/* 1. Deep Thinking Step */}
          {hasThinking && (
            <ThoughtTraceItem
              thinking={thinking!}
              isExecuting={isExecuting && !hasTools}
            />
          )}

          {/* 2. Tool Calls */}
          {toolCalls.map((tc, idx) => {
            const norm = (tc.name || "").toLowerCase().replace(/[-_]/g, "");

            // A. Socratic Question (ask_question)
            if (norm === "askquestion" || norm === "question") {
              return (
                <SocraticQuestionTraceItem
                  key={tc.id || `tc_${idx}`}
                  toolCall={tc}
                  onAnswer={onAnswerQuestion}
                />
              );
            }

            // B. Python Execution (run_python)
            if (norm === "runpython" || norm === "python") {
              return (
                <PythonRunnerTraceItem
                  key={tc.id || `tc_${idx}`}
                  toolCall={tc}
                />
              );
            }

            // C. Todo Write / Learning Roadmap (todo_write)
            if (norm === "todowrite" || norm === "todo") {
              return (
                <TodoWriteTraceItem
                  key={tc.id || `tc_${idx}`}
                  toolCall={tc}
                />
              );
            }

            // D. File Mutation (write, edit)
            if (norm.includes("write") || norm.includes("edit") || norm.includes("modify")) {
              return (
                <FileMutationTraceItem
                  key={tc.id || `tc_${idx}`}
                  toolCall={tc}
                />
              );
            }

            // E. Terminal Shell Execution (run_command, bash)
            if (norm === "runcommand" || norm === "bash" || norm === "terminal" || norm === "exec") {
              return (
                <TerminalTraceItem
                  key={tc.id || `tc_${idx}`}
                  toolCall={tc}
                />
              );
            }

            // F. File Exploration & Search (read, ls, find, grep)
            if (
              norm === "read" ||
              norm === "readfile" ||
              norm === "ls" ||
              norm === "find" ||
              norm === "grep"
            ) {
              return (
                <ExplorationTraceItem
                  key={tc.id || `tc_${idx}`}
                  toolCall={tc}
                />
              );
            }

            // G. Generic Fallback
            return (
              <GenericTraceItem
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
              />
            );
          })}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Thought / DeepThinking Item
// ---------------------------------------------------------------------------
function ThoughtTraceItem({
  thinking,
  isExecuting,
}: {
  thinking: string;
  isExecuting?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract brief first line for thought preview
  const firstLine = useMemo(() => {
    const trimmed = thinking.trim();
    const line = trimmed.split("\n")[0] || "";
    return line.length > 70 ? line.slice(0, 70) + "..." : line;
  }, [thinking]);

  return (
    <div className="flex flex-col text-xs font-sans">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit text-left select-none"
      >
        <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="font-medium text-foreground/80">
          {isExecuting ? "Thinking..." : "Thought"}
        </span>
        {firstLine && !isOpen && (
          <span className="text-[11px] text-muted-foreground/60 italic truncate max-w-xs sm:max-w-md">
            — {firstLine}
          </span>
        )}
        <ChevronRight
          className={cn(
            "w-3 h-3 text-muted-foreground/60 transition-transform duration-150 ml-0.5",
            isOpen && "rotate-90"
          )}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 mb-1.5 p-3 rounded-xl bg-muted/30 border border-border/50 text-[12px] text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
          {thinking}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Socratic Question Item (ask_question)
// ---------------------------------------------------------------------------
function SocraticQuestionTraceItem({
  toolCall,
  onAnswer,
}: {
  toolCall: DisplayToolCall;
  onAnswer?: (toolCallId: string, answer: any) => void;
}) {
  const [customInput, setCustomInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawQuestion =
    toolCall.args?.question ||
    toolCall.args?.questions?.[0]?.question ||
    "Bagaimana kita ingin melanjutkan?";

  const rawOptions: string[] = Array.isArray(toolCall.args?.options)
    ? toolCall.args.options.map((opt: any) => (typeof opt === "string" ? opt : opt?.label || JSON.stringify(opt)))
    : Array.isArray(toolCall.args?.questions?.[0]?.options)
    ? toolCall.args.questions[0].options.map((opt: any) => (typeof opt === "string" ? opt : opt?.label || JSON.stringify(opt)))
    : [];

  const isCompleted = toolCall.status === "completed" || Boolean(toolCall.result);

  const handleSelect = async (opt: string) => {
    if (isCompleted || isSubmitting || !onAnswer) return;
    setSelectedOption(opt);
    setIsSubmitting(true);
    try {
      await onAnswer(toolCall.id, opt);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || isCompleted || isSubmitting || !onAnswer) return;
    setSelectedOption(trimmed);
    setIsSubmitting(true);
    try {
      await onAnswer(toolCall.id, trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-950/10 dark:bg-sky-950/20 p-3.5 text-xs shadow-xs space-y-2.5 my-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">
            Pertanyaan Socrates
          </span>
        </div>

        {isCompleted ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Terjawab
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-mono animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Menunggu Pilihan
          </span>
        )}
      </div>

      <div className="text-[13px] font-medium text-foreground/95 leading-relaxed">
        {rawQuestion}
      </div>

      {isCompleted ? (
        <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-foreground flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs">
            Jawaban:{" "}
            <strong className="text-emerald-400">
              {typeof toolCall.result === "string"
                ? toolCall.result
                : selectedOption || JSON.stringify(toolCall.result)}
            </strong>
          </span>
        </div>
      ) : (
        <div className="space-y-1.5 pt-1">
          {rawOptions.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelect(opt)}
              className={cn(
                "w-full text-left p-2.5 rounded-xl border transition-all text-xs font-medium flex items-center justify-between cursor-pointer",
                selectedOption === opt
                  ? "bg-sky-500/20 border-sky-400 text-sky-200"
                  : "bg-background/60 hover:bg-sky-500/10 border-border/60 hover:border-sky-500/40 text-foreground active:scale-[0.99]"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-muted/80 text-muted-foreground flex items-center justify-center text-[9px] font-mono">
                  {idx + 1}
                </span>
                <span>{opt}</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-70" />
            </button>
          ))}

          <form onSubmit={handleCustomSubmit} className="pt-1 flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={isSubmitting}
              placeholder="Atau ketik jawaban sendiri..."
              className="flex-1 bg-background/80 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-sky-500/70 transition-all"
            />
            <button
              type="submit"
              disabled={!customInput.trim() || isSubmitting}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
            >
              <Send className="h-3 w-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Python Runner Item (run_python) with Visual Charts & Media Previews
// ---------------------------------------------------------------------------
function PythonRunnerTraceItem({ toolCall }: { toolCall: DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});

  const code = toolCall.args?.code || "";
  const stdout = toolCall.result?.stdout || "";
  const stderr = toolCall.result?.stderr || "";
  const artifacts: string[] = Array.isArray(toolCall.result?.artifacts)
    ? toolCall.result.artifacts
    : [];

  const isRunning = toolCall.status === "running";
  const isError = toolCall.status === "error" || toolCall.isError;

  // Load visual charts generated by matplotlib/seaborn
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
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs shadow-xs space-y-2 my-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-yellow-500/15 text-yellow-500 flex items-center justify-center font-mono text-[10px] font-bold">
            Py
          </div>
          <span className="font-mono font-medium text-foreground">Python</span>
          <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-xs">
            {code ? code.split("\n")[0]?.slice(0, 35) + "..." : "Perhitungan"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-mono">
              <Loader2 className="h-3 w-3 animate-spin" />
              Menghitung...
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-mono">
              <AlertCircle className="h-3 w-3" />
              Gagal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-mono">
              <CheckCircle2 className="h-3 w-3" />
              Selesai
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="h-6 px-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] transition-colors cursor-pointer border border-border/40"
          >
            {isOpen ? "Tutup" : "Detail"}
          </button>
        </div>
      </div>

      {/* Generated Visual Artifacts (Charts / Plots) */}
      {artifacts.length > 0 && (
        <div className="space-y-2 pt-1">
          {artifacts.map((artPath) => {
            const fileName = artPath.split(/[\\/]/).pop() || artPath;
            const dataUri = mediaPreviews[artPath];

            return (
              <div
                key={artPath}
                className="p-2.5 rounded-xl bg-background/80 border border-border/50 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-foreground/90 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-yellow-500" />
                    Grafik: <strong>{fileName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenPath(artPath)}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    <span>Buka File</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>

                {dataUri && (
                  <div className="rounded-lg overflow-hidden border border-border/40 bg-card p-1">
                    <img
                      src={dataUri}
                      alt={fileName}
                      className="max-h-64 w-auto mx-auto object-contain rounded"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsible Details: Code & Stdout/Stderr */}
      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-2 pt-2 border-t border-border/40 space-y-2 font-mono text-[11px]">
          {code && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1">Kode Python:</div>
              <pre className="p-2.5 rounded-lg bg-background/80 border border-border/40 overflow-x-auto text-yellow-400/90 whitespace-pre max-h-44 overflow-y-auto">
                {code}
              </pre>
            </div>
          )}

          {stdout && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1">Output (stdout):</div>
              <pre className="p-2.5 rounded-lg bg-background/80 border border-border/40 overflow-x-auto text-emerald-400 whitespace-pre-wrap max-h-44 overflow-y-auto">
                {stdout}
              </pre>
            </div>
          )}

          {stderr && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1 text-destructive">Error (stderr):</div>
              <pre className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 overflow-x-auto text-destructive whitespace-pre-wrap max-h-44 overflow-y-auto">
                {stderr}
              </pre>
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Todo Write Item (todo_write)
// ---------------------------------------------------------------------------
function TodoWriteTraceItem({ toolCall }: { toolCall: DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);

  const rawTasks = toolCall.args?.todos || toolCall.args?.tasks || [];
  const tasks: Array<{ content?: string; text?: string; status: "pending" | "in_progress" | "completed" }> =
    Array.isArray(rawTasks) ? rawTasks : [];

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-3 text-xs shadow-xs space-y-2 my-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <ListTodo className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-foreground">Roadmap Belajar</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-mono">
            {completedCount}/{tasks.length} Selesai
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-6 px-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] transition-colors cursor-pointer border border-border/40"
        >
          {isOpen ? "Tutup" : "Lihat"}
        </button>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          {tasks.map((task, idx) => {
            const text = task.content || task.text || `Tugas ${idx + 1}`;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg border text-xs transition-colors",
                  task.status === "completed"
                    ? "bg-muted/30 border-border/40 text-muted-foreground line-through"
                    : task.status === "in_progress"
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 font-medium"
                    : "bg-background/60 border-border/50 text-foreground"
                )}
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : task.status === "in_progress" ? (
                  <Loader2 className="h-3.5 w-3.5 text-cyan-400 shrink-0 animate-spin mt-0.5" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0 mt-0.5" />
                )}
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. File Mutation Item (write, edit)
// ---------------------------------------------------------------------------
function FileMutationTraceItem({ toolCall }: { toolCall: DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const path = toolCall.args?.path || toolCall.args?.filePath || "file";
  const fileName = path.split(/[\\/]/).pop() || path;
  const isEdit = toolCall.name.toLowerCase().includes("edit");

  return (
    <div className="flex flex-col text-xs font-sans">
      <div className="flex items-center justify-between py-1 text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          {isEdit ? (
            <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          ) : (
            <FilePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="font-mono text-foreground/80">{isEdit ? "Edit" : "Buat"}:</span>
          <span className="font-mono text-foreground font-medium truncate max-w-xs sm:max-w-md">
            {fileName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded hover:bg-muted"
        >
          {isOpen ? "Tutup" : "Lihat"}
        </button>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40 font-mono text-[11px] space-y-1 mb-1.5">
          <div className="text-muted-foreground text-[10px]">Path: {path}</div>
          {toolCall.args?.content && (
            <pre className="p-2 rounded bg-background/80 border border-border/30 overflow-x-auto text-foreground/90 max-h-36 overflow-y-auto">
              {typeof toolCall.args.content === "string"
                ? toolCall.args.content.slice(0, 1000)
                : JSON.stringify(toolCall.args.content, null, 2)}
            </pre>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Terminal Shell Item (run_command, bash)
// ---------------------------------------------------------------------------
function TerminalTraceItem({ toolCall }: { toolCall: DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const cmd = toolCall.args?.command || toolCall.args?.cmd || "";

  return (
    <div className="flex flex-col text-xs font-sans">
      <div className="flex items-center justify-between py-1 text-muted-foreground select-none">
        <div className="flex items-center gap-2 truncate">
          <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-mono text-foreground/80">Perintah:</span>
          <span className="font-mono text-foreground truncate max-w-xs sm:max-w-md">
            {cmd}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded hover:bg-muted"
        >
          {isOpen ? "Tutup" : "Output"}
        </button>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="p-2.5 rounded-lg bg-background/80 border border-border/40 font-mono text-[11px] mb-1.5 max-h-40 overflow-y-auto">
          {toolCall.result ? (
            <pre className="text-emerald-400 whitespace-pre-wrap">
              {typeof toolCall.result === "string"
                ? toolCall.result
                : JSON.stringify(toolCall.result, null, 2)}
            </pre>
          ) : (
            <span className="text-muted-foreground">Tidak ada keluaran</span>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Exploration Item (read, ls, find, grep)
// ---------------------------------------------------------------------------
function ExplorationTraceItem({ toolCall }: { toolCall: DisplayToolCall }) {
  const norm = toolCall.name.toLowerCase();
  const summary =
    toolCall.args?.path || toolCall.args?.pattern || Object.values(toolCall.args || {})[0] || "";

  return (
    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground select-none">
      {norm === "read" ? (
        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      ) : (
        <Search className="w-3.5 h-3.5 text-orange-400 shrink-0" />
      )}
      <span className="font-mono font-medium text-foreground/80">{toolCall.name}</span>
      {summary && (
        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-md">
          {typeof summary === "string" ? summary : JSON.stringify(summary)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Generic Tool Fallback
// ---------------------------------------------------------------------------
function GenericTraceItem({ toolCall }: { toolCall: DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col text-xs font-sans">
      <div className="flex items-center justify-between py-1 text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-mono text-foreground font-medium">{toolCall.name}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 rounded hover:bg-muted"
        >
          {isOpen ? "Tutup" : "Detail"}
        </button>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40 font-mono text-[11px] mb-1.5 space-y-1">
          <pre className="p-2 rounded bg-background/80 border border-border/30 overflow-x-auto text-foreground/90 max-h-36 overflow-y-auto">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </div>
      </SmoothCollapse>
    </div>
  );
}
