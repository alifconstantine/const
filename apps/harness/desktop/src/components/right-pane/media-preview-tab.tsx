import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { ScrollArea } from "@const/ui";
import type { AttachedFile } from "../workbench/chat-card";
import { useTranslation } from "../../lib/i18n";
import { useRemoteRuntime } from "../../lib/remote-runtime";
import { localMediaUrl, safeMediaUrl, type MediaKind } from "../../lib/workbench-activity";

export function MediaPreviewTab({ name, filePath, kind, source, workspacePath }: {
  name: string; filePath?: string; kind: MediaKind; source?: AttachedFile; workspacePath?: string;
}) {
  const { t } = useTranslation();
  const remote = useRemoteRuntime();
  const isRemote = !!remote;
  const [pdfText, setPdfText] = useState(!!remote?.mobile && !!source?.textContent);
  useEffect(() => { if (remote?.mobile && source?.textContent) setPdfText(true); }, [remote?.mobile, source?.textContent]);
  const showText = kind === "document" || (kind === "pdf" && pdfText);
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setUrl(undefined);
    setFailed(false);
    if (showText) return;
    const inline = safeMediaUrl(source?.base64, kind) || safeMediaUrl(source?.url, kind);
    const path = filePath && !/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(filePath) && workspacePath
      ? `${workspacePath.replace(/[\\/]$/, "")}/${filePath}` : filePath;
    if (inline) { setUrl(inline); return; }
    if (path && !isRemote) { setUrl(localMediaUrl(path)); return; }
    if (!path || !window.electron?.readAsDataUrl) { setFailed(true); return; }
    void window.electron.readAsDataUrl(path).then(result => {
      if (disposed) return;
      const safe = result.success ? safeMediaUrl(result.dataUrl, kind) : undefined;
      if (safe) setUrl(safe);
      else setFailed(true);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [filePath, workspacePath, source?.base64, source?.url, kind, showText, isRemote, attempt]);

  return <section data-media-preview={kind} className="flex h-full min-h-0 flex-col bg-white text-[#262626] dark:bg-[#161616] dark:text-white [&_button]:outline-none [&_button]:focus-visible:bg-black/5 dark:[&_button]:focus-visible:bg-white/10">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-medium shrink-0">
      <span className="min-w-0 break-all">{name}</span>
      {kind === "pdf" && source?.textContent && <div className="flex gap-1 text-xs">
        <button type="button" aria-pressed={!pdfText} onClick={() => setPdfText(false)} className="min-h-11 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5 aria-pressed:bg-black/5 dark:aria-pressed:bg-white/10">{t("common.preview")}</button>
        <button type="button" aria-pressed={pdfText} onClick={() => setPdfText(true)} className="min-h-11 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5 aria-pressed:bg-black/5 dark:aria-pressed:bg-white/10">{t("activity.text")}</button>
      </div>}
    </div>
    {showText ? source?.textContent
      ? <ScrollArea className="flex-1 min-h-0"><pre className="whitespace-pre-wrap break-words px-4 pb-4 text-sm leading-relaxed font-sans">{source.textContent}</pre></ScrollArea>
      : <div className="flex-1 grid place-content-center gap-3 px-6 text-center text-sm text-[#666666] dark:text-[#969696]"><FileText className="mx-auto size-8" />{t("activity.documentUnavailable")}</div>
    : failed ? <div role="status" className="flex-1 grid place-content-center gap-4 px-6 text-center text-sm text-[#666666] dark:text-[#969696]">
        <p>{t("activity.previewUnavailable")}</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-xl bg-black/5 px-4 py-2 dark:bg-white/10">{t("common.retry")}</button>
      </div>
    : !url ? <div role="status" aria-label={t("common.loading")} className="flex-1 grid place-items-center"><Loader2 className="size-5 animate-spin text-[#969696]" /></div>
    : <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden p-4">
        {kind === "image" && <img src={url} alt={name} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />}
        {kind === "video" && <video src={url} controls preload="metadata" onError={() => setFailed(true)} className="max-h-full max-w-full" aria-label={name} />}
        {kind === "audio" && <audio src={url} controls preload="metadata" onError={() => setFailed(true)} className="w-full" aria-label={name} />}
        {kind === "pdf" && <embed src={url} type="application/pdf" title={name} onError={() => setFailed(true)} className="h-full w-full rounded-xl border-0 bg-white" />}
      </div>}
  </section>;
}
