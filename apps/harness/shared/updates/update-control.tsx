import { useEffect, useId, useRef, useState } from "react";
import { Download, Check, Loader2, ArrowUpToLine, X } from "lucide-react";
import { ScrollArea, Switch, Popover, PopoverContent, PopoverTrigger, Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@const/ui";
import { compareVersions, type UpdateClient, type UpdateState } from "./releases";
import type { UpdateStrings } from "./strings";

/** Release text stays untrusted plain text; only structural Markdown is rendered. */
export function ReleaseNotes({ text, empty }: { text: string; empty: string }) {
  if (!text.trim()) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div data-update-notes className="space-y-2 text-sm leading-relaxed text-foreground dark:text-white select-text">
    {text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
      const heading = /^#{1,6}\s+(.+)$/.exec(line);
      if (heading) return <h3 key={index} className="pt-3 first:pt-0 font-semibold">{heading[1]}</h3>;
      const item = /^\s*(?:[-*+] |\d+\. )(.+)$/.exec(line);
      return item ? <p key={index} className="flex gap-2"><span aria-hidden="true">•</span><span className="min-w-0 break-words">{item[1]}</span></p> : <p key={index} className="break-words">{line}</p>;
    })}
  </div>;
}

export function UpdateControl({ client, labels: t, language, mobile = false, settings = false }: {
  client: UpdateClient; labels: UpdateStrings; language: string; mobile?: boolean; settings?: boolean;
}) {
  const [state, setState] = useState<UpdateState>();
  const [open, setOpen] = useState(false);
  const id = useId();
  const mounted = useRef(false);
  const isNew = Boolean(state?.release && compareVersions(state.release.version, state.installed) > 0);
  useEffect(() => { if (!isNew) setOpen(false); }, [isNew]);
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    const unsubscribe = client.subscribe(value => { if (alive) setState(value); });
    void client.getState().then(value => { if (alive) setState(value); }).catch(() => {});
    return () => { alive = false; mounted.current = false; unsubscribe(); };
  }, [client]);
  if (!state) return null;
  // Checking/current/error alone is never evidence that an update exists.
  if (!isNew) return null;
  const working = ["checking", "downloading", "installing"].includes(state.status);
  const status = state.status === "error" ? t[state.error === "network" ? "error" : state.error === "download" ? "downloadError" : state.error || "error"] : state.status === "idle" ? t.check : t[state.status];
  const run = (action: () => Promise<UpdateState>) => { void action().then(value => { if (mounted.current) setState(value); }).catch(() => { if (mounted.current) setState(previous => previous && ({ ...previous, status: "error", error: "network" })); }); };
  const installable = state.status === "ready" || (state.status === "error" && ["busy", "permission", "installation"].includes(state.error || ""));
  const action = installable ? () => client.install() : isNew && state.release?.asset ? () => client.download() : () => client.check();
  const actionLabel = installable ? mobile ? t.installAndroid : t.installWindows : isNew && state.release?.asset ? t.download : t.check;
  const trigger = <button type="button" data-app-update-trigger aria-label={t.title} title={status}
    className={settings ? "inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground" : `relative inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-[#969696] ${mobile ? "size-11" : "size-7"}`}>
    {working ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : state.status === "ready" ? <ArrowUpToLine aria-hidden="true" className="size-4" /> : <Download aria-hidden="true" className="size-4" />}
    {settings && t.title}{isNew && !working && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-current" />}
  </button>;
  const body = <div data-app-update-panel className="flex min-h-0 flex-col gap-4">
    <div className="pr-6">
      <h2 className="text-sm font-semibold text-foreground">{t.title}{isNew && state.release ? ` · v${state.release.version}` : ""}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t.installed}: {state.installed}</p>
      {state.release?.date && Number.isFinite(Date.parse(state.release.date)) && <p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(state.release.date))}</p>}
    </div>
    <p role="status" className="text-sm text-foreground">{state.status === "current" && <Check aria-hidden="true" className="mr-1 inline size-3.5" />}{status}</p>
    {state.status === "downloading" && <div className="space-y-1"><div role="progressbar" aria-label={t.downloading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress || 0)} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, state.progress || 0))}%` }} /></div><p className="text-xs text-muted-foreground">{Math.round(state.progress || 0)}%</p></div>}
    {state.release && <div className="min-h-0"><p className="mb-2 text-xs text-muted-foreground">{t.releaseNotes} · {t.notesLanguage}</p><ScrollArea className={mobile ? "h-[min(38vh,300px)] min-h-0" : "h-60 min-h-0"} thumbClassName="bg-foreground/20"><div className="pr-3"><ReleaseNotes text={state.release.notes} empty={t.noNotes} /></div></ScrollArea></div>}
    {isNew && !state.release?.asset && <p className="text-xs text-muted-foreground">{t.unsupported}</p>}
    {isNew && state.release?.asset && (!state.canInstall || !state.release.asset.sha256) && <p className="text-xs text-muted-foreground">{t.manual}</p>}
    <div className="space-y-2 text-xs text-muted-foreground">
      <label htmlFor={`${id}-check`} className={`flex items-center justify-between gap-3 ${mobile ? "min-h-11" : "min-h-7"}`}>{t.autoCheck}<Switch id={`${id}-check`} checked={state.preferences.autoCheck} onCheckedChange={autoCheck => run(() => client.setPreferences({ ...state.preferences, autoCheck }))} /></label>
      {state.canInstall && <label htmlFor={`${id}-download`} className={`flex items-center justify-between gap-3 ${mobile ? "min-h-11" : "min-h-7"}`}>{t.autoDownload}<Switch id={`${id}-download`} checked={state.preferences.autoDownload} onCheckedChange={autoDownload => run(() => client.setPreferences({ ...state.preferences, autoDownload }))} /></label>}
    </div>
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center px-2 text-xs text-muted-foreground hover:text-foreground">{t.later}</button>
      <button type="button" disabled={working} onClick={() => run(action)} className="min-h-10 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50">{working ? status : actionLabel}</button>
    </div>
  </div>;
  return mobile ? <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent hideClose className="fixed !top-auto !bottom-0 !left-0 !translate-x-0 !translate-y-0 !w-full !max-w-none rounded-t-2xl rounded-b-none p-5 pb-[max(20px,env(safe-area-inset-bottom))] bg-background outline-none ring-0"><DialogTitle className="sr-only">{t.title}</DialogTitle><DialogDescription className="sr-only">{t.releaseNotes}</DialogDescription><button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="absolute right-3 top-3 grid size-11 place-items-center text-muted-foreground"><X className="size-4" /></button><ScrollArea className="max-h-[calc(100dvh-80px)]">{body}</ScrollArea></DialogContent></Dialog> : <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align="start" side="bottom" sideOffset={8} className="w-[360px] max-w-[calc(100vw-24px)] rounded-2xl bg-popover p-4 outline-none ring-0">{body}</PopoverContent></Popover>;
}
