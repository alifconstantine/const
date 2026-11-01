import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Bot, Check, ChevronDown, Circle, FileDiff, FileText, LayoutList, Loader2, Square, SquareTerminal, X } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import type { TodoItem, SubAgentItem, BackgroundTaskItem, FileMutationRecord } from "../../vite-env";
import type { AttachedFile } from "./chat-card";
import { FileIcon } from "./file-icon";
import { getMutationDiffStats } from "./review-dialog";
import { localMediaUrl, safeMediaUrl } from "../../lib/workbench-activity";
import { useRemoteRuntime } from "../../lib/remote-runtime";

export interface FloatingWorkbenchCardProps {
  todos?: TodoItem[];
  subagents?: SubAgentItem[];
  jobs?: BackgroundTaskItem[];
  changes?: FileMutationRecord[];
  sources?: AttachedFile[];
  isExecuting?: boolean;
  onSelectSubAgent?: (agent: SubAgentItem) => void;
  onKillAgent?: (agentId: string) => void;
  onSelectJob?: (job: BackgroundTaskItem) => void;
  onStopJob?: (id: string) => void;
  onSelectChange?: (change: FileMutationRecord) => void;
  onSelectSource?: (source: AttachedFile) => void;
  onClose?: () => void;
  className?: string;
}

function ActivitySection({ id, title, count, icon, children }: {
  id: string; title: string; count: string | number; icon: ReactNode; children: ReactNode;
}) {
  const expandAutomatically = id === "progress" || id === "jobs";
  const [open, setOpen] = useState(expandAutomatically && (Number(count) > 0 || String(count).includes("/")));
  const hasItems = Number(count) > 0 || String(count).includes("/");
  const hadItems = useRef(hasItems);
  useEffect(() => { if (expandAutomatically && hasItems && !hadItems.current) setOpen(true); hadItems.current = hasItems; }, [hasItems, expandAutomatically]);
  return <section data-activity-section={id}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-[#666666] hover:bg-black/5 dark:text-[#969696] dark:hover:bg-white/5">
      {icon}<span className="flex-1 text-left font-medium">{title}</span>
      <span className="tabular-nums">{count}</span><ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} />
    </button>
    {open && <div className="space-y-1 px-1 pb-2">{children}</div>}
  </section>;
}

function ChangeRow({ change, select }: { change: FileMutationRecord; select?: (change: FileMutationRecord) => void }) {
  const path = change.filePath || change.targetFile;
  const stats = useMemo(() => getMutationDiffStats(change), [change.previousContent, change.newContent]);
  return <button type="button" onClick={() => select?.(change)} title={path}
    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5">
    <FileIcon filename={path} className="size-4 shrink-0" />
    <span className="min-w-0 flex-1 truncate text-xs">{path.replace(/\\/g, "/").split("/").pop()}</span>
    <span className="text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400">+{stats.added}</span>
    <span className="text-[11px] tabular-nums text-red-600 dark:text-red-400">−{stats.removed}</span>
  </button>;
}

function SourceThumbnail({ source }: { source: AttachedFile }) {
  const remote = !!useRemoteRuntime();
  const placeholder = useRef<HTMLSpanElement>(null);
  const [remoteUrl, setRemoteUrl] = useState<string>();
  const inline = safeMediaUrl(source.base64, "image") || safeMediaUrl(source.url, "image");
  const src = inline || (source.path && !remote ? localMediaUrl(source.path) : remoteUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  useEffect(() => {
    setRemoteUrl(undefined);
    if (!remote || inline || !source.path || source.type !== "image" || !placeholder.current) return;
    let disposed = false;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void window.electron?.readAsDataUrl?.(source.path!).then(result => {
        if (!disposed && result.success) setRemoteUrl(safeMediaUrl(result.dataUrl, "image"));
      }).catch(() => {});
    });
    observer.observe(placeholder.current);
    return () => { disposed = true; observer.disconnect(); };
  }, [remote, inline, source.path, source.type]);
  return source.type === "image" && src && !failed
    ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="size-9 shrink-0 rounded-md bg-black/5 object-cover dark:bg-white/5" />
    : <span ref={placeholder} className="flex size-9 shrink-0 items-center justify-center rounded-md bg-black/5 dark:bg-white/5"><FileIcon filename={source.name} className="size-5" /></span>;
}

export function FloatingWorkbenchCard({ todos = [], subagents = [], jobs = [], changes = [], sources = [], isExecuting = false,
  onSelectSubAgent, onKillAgent, onSelectJob, onStopJob, onSelectChange, onSelectSource, onClose, className }: FloatingWorkbenchCardProps) {
  const { t } = useTranslation();
  const active = isExecuting || jobs.some(job => job.status === "running") || subagents.some(agent => agent.status === "running");
  const [open, setOpen] = useState(true);
  const wasActive = useRef(active);
  useEffect(() => { if (active && !wasActive.current) setOpen(true); wasActive.current = active; }, [active]);
  const completed = todos.filter(todo => todo.status === "completed").length;
  const empty = !todos.length && !subagents.length && !jobs.length && !changes.length && !sources.length;
  const status = (value: string) => value === "running" ? t("common.running") : value === "completed" ? t("common.completed") : value === "failed" ? t("common.failed") : t("common.stopped");
  return <aside data-workbench-activity aria-label={t("activity.title")}
    className={cn("w-80 max-w-full overflow-hidden rounded-xl border border-[#dedee2] bg-white text-[#262626] dark:border-[#383838] dark:bg-[#222222] dark:text-[#d4d4d4] font-sans [&_button]:outline-none [&_button]:focus-visible:bg-black/5 dark:[&_button]:focus-visible:bg-white/10", className)}>
    <div className="flex items-center gap-1 px-2 py-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex min-h-9 flex-1 items-center gap-2 rounded-lg px-2 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
        <LayoutList className="size-3.5 text-[#666666] dark:text-[#969696]" /><span className="flex-1 text-left">{t("activity.title")}</span>
        {active && <Loader2 className="size-3 animate-spin text-[#969696]" />}<ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {onClose && <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex size-8 items-center justify-center rounded-lg text-[#666666] hover:bg-black/5 dark:text-[#969696] dark:hover:bg-white/5"><X className="size-3.5" /></button>}
    </div>
    {open && <ScrollArea className="max-h-[min(28rem,calc(100dvh-220px))]" viewportClassName="max-h-[min(28rem,calc(100dvh-220px))]">
      <div className="space-y-1 px-2 pb-2">
        {empty ? <p className="px-2 py-4 text-xs text-[#666666] dark:text-[#969696]">{t("activity.empty")}</p> : <>
          <ActivitySection id="progress" title={t("common.progress")} count={todos.length ? completed + "/" + todos.length : 0} icon={<Check className="size-3.5" />}>
            {todos.map((todo, index) => <div key={todo.id || index} className="flex items-start gap-2 px-2 py-1.5 text-xs leading-relaxed">
              {todo.status === "completed" ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : todo.status === "in_progress" ? <ArrowRight className="mt-0.5 size-3.5 shrink-0" /> : <Circle className="mt-0.5 size-3.5 shrink-0 text-[#969696]" />}
              <span className={cn("min-w-0 break-words", todo.status === "completed" && "text-[#777777] dark:text-[#969696] line-through")}>{todo.content || todo.task || todo.title}</span>
            </div>)}
          </ActivitySection>
          <ActivitySection id="jobs" title={t("activity.jobs")} count={jobs.length} icon={<SquareTerminal className="size-3.5" />}>
            {jobs.map(job => <div key={job.id} className="flex items-center gap-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
              <button type="button" onClick={() => onSelectJob?.(job)} title={job.command} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
                {job.status === "running" ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <SquareTerminal className="size-3.5 shrink-0 text-[#969696]" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-xs">{job.name || job.command}</span><span className="block text-[11px] text-[#666666] dark:text-[#969696]">{status(job.status)}</span></span>
              </button>
              {job.status === "running" && onStopJob && <button type="button" aria-label={t("rightPane.stopTask") + ": " + (job.name || job.command)} onClick={() => onStopJob(job.id)} className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10"><Square className="size-3" /></button>}
            </div>)}
          </ActivitySection>
          <ActivitySection id="agents" title={t("common.agents")} count={subagents.length} icon={<Bot className="size-3.5" />}>
            {subagents.map(agent => <div key={agent.id} className="flex items-center gap-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
              <button type="button" onClick={() => onSelectSubAgent?.(agent)} title={agent.description} className="min-w-0 flex-1 px-2 py-2 text-left"><span className="block truncate text-xs">{agent.description || agent.name}</span><span className="text-[11px] text-[#666666] dark:text-[#969696]">{status(agent.status)}</span></button>
              {agent.status === "running" && onKillAgent && <button type="button" aria-label={t("common.stop") + ": " + agent.description} onClick={() => onKillAgent(agent.id)} className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10"><Square className="size-3" /></button>}
            </div>)}
          </ActivitySection>
          <ActivitySection id="changes" title={t("activity.changes")} count={changes.length} icon={<FileDiff className="size-3.5" />}>
            {changes.map(change => <ChangeRow key={change.filePath || change.targetFile} change={change} select={onSelectChange} />)}
          </ActivitySection>
          <ActivitySection id="sources" title={t("activity.sources")} count={sources.length} icon={<FileText className="size-3.5" />}>
            {sources.map(source => <button type="button" key={source.path || source.id || source.name} onClick={() => onSelectSource?.(source)} title={source.path || source.name} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"><SourceThumbnail source={source} /><span className="min-w-0 flex-1 truncate text-xs">{source.name}</span></button>)}
          </ActivitySection>
        </>}
      </div>
    </ScrollArea>}
  </aside>;
}
