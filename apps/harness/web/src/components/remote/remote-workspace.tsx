"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Menu,
  MoreHorizontal,
  PanelRight,
  X,
  Plus,
  Search,
  CalendarClock,
  Store,
  ChevronDown,
  ArrowUp,
  Square,
  Wifi,
  LogOut,
  Globe,
  Palette,
  ArrowLeftRight,
  BarChart2,
  Settings,
  Unplug,
  Folder,
  ShieldCheck,
} from "lucide-react";
import {
  ConstLogoIcon,
  ScrollArea,
  UserMessageBubble,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@const/ui";
import { remoteCopy, type RemoteCopyKey } from "@const/remote/copy";
import { useI18n } from "@/context/I18nContext";
import { useRemote } from "./use-remote";
import { remoteLogin } from "./auth";
import { MessageText } from "./message-text";
import "./remote.css";

const short = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value || 0);
export function RemoteWorkspace({
  sessionId,
  convexUrl,
}: {
  sessionId: string;
  convexUrl: string;
}) {
  const { locale, setLocale, locales } = useI18n();
  const t = remoteCopy(locale);
  const { theme, setTheme } = useTheme();
  const remote = useRemote(sessionId, convexUrl);
  const [sidebar, setSidebar] = useState(false);
  const [panel, setPanel] = useState(false);
  const [metrics, setMetrics] = useState(false);
  const [settings, setSettings] = useState(false);
  const [section, setSection] = useState<"scheduled" | "marketplace" | null>(
    null,
  );
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [rename, setRename] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const viewport = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const draftInput = useRef<HTMLTextAreaElement>(null);
  const online = remote.online && remote.connection === "ready";
  const running = !!remote.conversation?.isRunning;
  const context =
    remote.live.context || remote.conversation?.contextUsage || {};
  const usage =
    remote.live.usage || (remote.conversation?.telemetry as any) || {};
  const percentage = context.totalTokens
    ? Math.min(
        100,
        Math.round((context.usedTokens / context.totalTokens) * 100),
      )
    : 0;

  useEffect(() => {
    if (stick.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [remote.live.text, remote.conversation?.messages, remote.selected]);
  useEffect(() => {
    const resize = () =>
      document.documentElement.style.setProperty(
        "--remote-height",
        `${window.visualViewport?.height || innerHeight}px`,
      );
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--remote-height");
    };
  }, []);
  const act = async (type: string, payload?: any) => {
    setError(false);
    try {
      return await remote.request(type, payload);
    } catch {
      setError(true);
      return null;
    }
  };
  const openSection = async (name: "scheduled" | "marketplace") => {
    setSidebar(false);
    setSection(name);
    setItems([]);
    const result = await act(`${name}:list`);
    if (result) setItems(result.tasks || result.plugins || []);
  };
  const pick = async (id: string) => {
    setSidebar(false);
    stick.current = true;
    try {
      await remote.select(id);
    } catch {
      setError(true);
    }
  };
  const exit = async (switchAccount = false) => {
    await remote.disconnect();
    sessionStorage.removeItem("const_remote_token");
    if (switchAccount) remoteLogin(true);
    else
      location.assign(
        `${process.env.NEXT_PUBLIC_ACCOUNTS_URL || "https://accounts.const.web.id"}/signout?continue=${encodeURIComponent(location.origin + location.pathname)}`,
      );
  };
  const iconButton = "remote-icon";
  const conversationActions = (
    <DropdownMenuContent align="end" className="remote-popover min-w-44">
      <DropdownMenuItem
        disabled={!remote.selected || running || !online}
        onSelect={() => {
          setNewTitle(remote.conversation?.title || "");
          setRename(true);
        }}
      >
        {t("rename")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!remote.selected || running || !online}
        onSelect={() => {
          void act("conversation:archive", {
            conversationId: remote.selected,
          }).then((result) => {
            if (result) {
              void pick("");
              void remote.refresh();
            }
          });
        }}
      >
        {t("archive")}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
  const gate = !convexUrl
    ? "notConfigured"
    : remote.connection === "ready"
      ? null
      : remote.connection;

  return (
    <main className="remote-shell fixed inset-0 flex flex-col bg-white text-[#262626] dark:bg-[#161616] dark:text-white font-sans">
      <header className="flex shrink-0 items-center gap-1 px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <button
          className={iconButton}
          aria-label={t("menu")}
          onClick={() => setSidebar(true)}
        >
          <Menu size={20} />
        </button>
        <button
          className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-xs tabular-nums text-[#737373] dark:text-[#969696] hover:bg-black/5 dark:hover:bg-white/5"
          aria-label={t("metrics")}
          onClick={() => setMetrics(true)}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${running ? "bg-[#0066ff]" : "bg-current"}`}
          />
          <span>{t(running ? "running" : "idle")}</span>
          <span>{percentage}%</span>
          <span>{short(Number(usage.totalTokens || 0))}</span>
          <ChevronDown size={12} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={iconButton} aria-label={t("more")}>
              <MoreHorizontal size={20} />
            </button>
          </DropdownMenuTrigger>
          {conversationActions}
        </DropdownMenu>
        <button
          className={iconButton}
          aria-label={t("panel")}
          onClick={() => setPanel(true)}
        >
          <PanelRight size={19} />
        </button>
      </header>
      {gate ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <ConstLogoIcon className="h-10 w-10" />
          <h1 className="text-lg font-medium">
            {t(gate === "connecting" ? "connecting" : "connect")}
          </h1>
          <p className="max-w-sm text-sm leading-6 text-[#737373] dark:text-[#969696]">
            {t(
              gate === "connecting"
                ? "encrypted"
                : gate === "login"
                  ? "sameAccount"
                  : gate === "missingKey"
                    ? "missingKey"
                    : gate === "notConfigured"
                      ? "notConfigured"
                      : "error",
            )}
          </p>
          {gate === "login" && (
            <button className="remote-button" onClick={() => remoteLogin()}>
              {t("login")}
            </button>
          )}
          {gate === "error" && (
            <div className="flex gap-2">
              <button className="remote-button" onClick={remote.reconnect}>
                {t("retry")}
              </button>
              <button
                className="remote-button"
                onClick={() => remoteLogin(true)}
              >
                {t("switchAccount")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {!online && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-[#969696]"
            >
              <Wifi size={13} />
              {t("offline")}
              <button className="underline" onClick={remote.reconnect}>
                {t("retry")}
              </button>
            </div>
          )}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={viewport}
            onScroll={(event) => {
              const node = event.currentTarget;
              stick.current =
                node.scrollHeight - node.scrollTop - node.clientHeight < 100;
            }}
          >
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-7 px-5 py-7">
              {!remote.conversation?.messages?.length && !remote.live.text && (
                <div className="my-auto flex min-h-[35dvh] flex-col justify-center gap-3">
                  <ConstLogoIcon className="mb-2 h-8 w-8 text-[#969696]" />
                  <h1 className="text-2xl font-medium tracking-tight">
                    {t("empty")}
                  </h1>
                  <p className="max-w-xs text-sm leading-6 text-[#737373] dark:text-[#969696]">
                    {t("emptyHint")}
                  </p>
                </div>
              )}
              {remote.conversation?.messages
                ?.filter(
                  (message) =>
                    ["user", "assistant"].includes(message.role) &&
                    message.content,
                )
                .map((message, index) =>
                  message.role === "user" ? (
                    <div key={index} className="flex justify-end">
                      <UserMessageBubble className="max-w-[90%]">
                        <MessageText content={message.content} />
                      </UserMessageBubble>
                    </div>
                  ) : (
                    <MessageText key={index} content={message.content} />
                  ),
                )}
              {remote.live.text && (
                <div aria-live="off">
                  <MessageText content={remote.live.text} />
                </div>
              )}
              {running && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-xs text-[#969696]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0066ff]" />
                  {remote.live.tools?.at(-1) || t("running")}
                </p>
              )}
              {remote.live.approval && (
                <div className="rounded-2xl bg-black/5 dark:bg-[#222222] p-4 text-sm">
                  <h2 className="font-medium">{t("approval")}</h2>
                  <p className="my-3 whitespace-pre-wrap break-words text-[#737373] dark:text-[#d4d4d4]">
                    {remote.live.approval.description ||
                      remote.live.approval.command ||
                      remote.live.approval.toolName}
                  </p>
                  <div className="flex gap-2">
                    {(["allow_once", "deny"] as const).map((decision) => (
                      <button
                        key={decision}
                        className="remote-button"
                        disabled={!online}
                        onClick={() =>
                          void act("agent:approval", {
                            conversationId: remote.selected,
                            runId: remote.conversation?.runId,
                            approvalId:
                              remote.live.approval.approvalId ||
                              remote.live.approval.id,
                            decision,
                          }).then((result) => {
                            if (result)
                              remote.setLive((previous: any) => ({
                                ...previous,
                                approval: null,
                              }));
                          })
                        }
                      >
                        {t(decision === "deny" ? "deny" : "allow")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {remote.live.questions && (
                <div className="rounded-2xl bg-black/5 dark:bg-[#222222] p-4 text-sm">
                  <h2>{t("question")}</h2>
                  {remote.live.questions.questions?.map((question: any) => (
                    <label key={question.id} className="mt-3 block">
                      <span>{question.question}</span>
                      <div className="my-2 flex flex-wrap gap-2">
                        {question.options?.map((option: any) => (
                          <button
                            key={option.label}
                            type="button"
                            className="remote-button"
                            onClick={() =>
                              setAnswers((previous) => ({
                                ...previous,
                                [question.id]: option.label,
                              }))
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <input
                        value={answers[question.id] || ""}
                        onChange={(event) =>
                          setAnswers((previous) => ({
                            ...previous,
                            [question.id]: event.target.value,
                          }))
                        }
                        placeholder={t("answer")}
                        className="remote-field mt-2"
                      />
                    </label>
                  ))}
                  <button
                    className="remote-button mt-3"
                    disabled={
                      !online ||
                      remote.live.questions.questions?.some(
                        (question: any) => !answers[question.id]?.trim(),
                      )
                    }
                    onClick={() =>
                      void act("agent:answer-question", {
                        toolCallId: remote.live.questions.toolCallId,
                        runId: remote.conversation?.runId,
                        answer: answers,
                      }).then((result) => {
                        if (result) {
                          setAnswers({});
                          remote.setLive((previous: any) => ({
                            ...previous,
                            questions: null,
                          }));
                        }
                      })
                    }
                  >
                    {t("send")}
                  </button>
                </div>
              )}
            </div>
          </ScrollArea>
          <footer className="mx-auto w-full max-w-3xl shrink-0 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
            {(error || remote.failedSend || remote.runError) && (
              <p role="alert" className="mb-2 px-2 text-xs leading-5">
                {t(
                  remote.failedSend
                    ? "sendError"
                    : remote.runError
                      ? "runError"
                      : "error",
                )}
              </p>
            )}
            <form
              className="rounded-2xl bg-[#f4f4f5] dark:bg-[#2b2b2b] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void remote.send();
              }}
            >
              <textarea
                ref={draftInput}
                rows={2}
                maxLength={32000}
                aria-label={t("placeholder")}
                placeholder={t("placeholder")}
                value={remote.draft}
                onChange={(event) => remote.setDraft(event.target.value)}
                className="block w-full resize-none bg-transparent px-1 py-1 text-base leading-6 outline-none placeholder:text-[#969696]"
              />
              <div className="mt-2 flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="remote-icon !h-8 !w-8"
                      aria-label={t("project")}
                      disabled={!!remote.selected}
                    >
                      <Plus size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="remote-popover max-w-[80vw]">
                    <DropdownMenuItem onSelect={() => remote.setProject("")}>
                      {t("noProject")}
                    </DropdownMenuItem>
                    <ScrollArea className="max-h-64">
                      {remote.bootstrap?.projects.map((project) => (
                        <DropdownMenuItem
                          key={project}
                          onSelect={() => remote.setProject(project)}
                        >
                          {project.replaceAll("\\", "/").split("/").pop()}
                        </DropdownMenuItem>
                      ))}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
                <select
                  className="min-w-0 max-w-[60%] truncate bg-transparent text-xs outline-none"
                  aria-label={t("model")}
                  value={remote.model}
                  onChange={(event) => remote.setModel(event.target.value)}
                  disabled={running}
                >
                  {remote.bootstrap?.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                <span className="ml-auto" />
                {running ? (
                  <button
                    type="button"
                    className="remote-send"
                    aria-label={t("stop")}
                    disabled={!online}
                    onClick={() =>
                      void act("agent:abort", {
                        conversationId: remote.selected,
                        runId: remote.conversation?.runId,
                      })
                    }
                  >
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="remote-send"
                    aria-label={t("send")}
                    disabled={
                      !online ||
                      remote.sending ||
                      remote.loading ||
                      remote.failedSend ||
                      !remote.draft.trim()
                    }
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </form>
          </footer>
        </>
      )}

      <Sheet open={sidebar} onOpenChange={setSidebar}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="remote-surface flex w-[calc(100vw-32px)] max-w-[330px] flex-col gap-0 border-0 p-0 outline-none ring-0"
        >
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <SheetDescription className="sr-only">{t("title")}</SheetDescription>
          <div className="flex items-center gap-3 p-5">
            <ConstLogoIcon className="h-7 w-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">
                {remote.device || t("connect")}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#969696]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-500" : "bg-[#969696]"}`}
                />
                {t(online ? "online" : "offline")}
              </p>
            </div>
            <button
              className={iconButton}
              aria-label={t("close")}
              onClick={() => setSidebar(false)}
            >
              <X size={18} />
            </button>
          </div>
          <nav className="space-y-1 px-3">
            <button className="remote-nav" onClick={() => void pick("")}>
              <Plus size={17} />
              {t("newChat")}
            </button>
            <label className="remote-nav">
              <Search size={17} />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-current"
                placeholder={t("search")}
                aria-label={t("search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              className="remote-nav"
              disabled={!online}
              onClick={() => void openSection("scheduled")}
            >
              <CalendarClock size={17} />
              {t("scheduled")}
            </button>
            <button
              className="remote-nav"
              disabled={!online}
              onClick={() => void openSection("marketplace")}
            >
              <Store size={17} />
              {t("marketplace")}
            </button>
          </nav>
          <ScrollArea className="mt-5 min-h-0 flex-1">
            <div className="px-3 pb-4">
              <h2 className="px-3 pb-2 text-xs text-[#969696]">
                {t("history")}
              </h2>
              {Array.from(
                new Set(
                  remote.bootstrap?.conversations.map(
                    (conversation) => conversation.project,
                  ) || [],
                ),
              ).map((project) => (
                <div key={project} className="mb-4">
                  <p className="flex items-center gap-2 px-3 py-2 text-xs text-[#969696]">
                    <Folder size={13} />
                    {project === "Outside Project"
                      ? t("noProject")
                      : project.replaceAll("\\", "/").split("/").pop()}
                  </p>
                  {remote.bootstrap?.conversations
                    .filter(
                      (conversation) =>
                        conversation.project === project &&
                        conversation.title
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .map((conversation) => (
                      <button
                        key={conversation.id}
                        className={`remote-nav w-full !gap-2 ${remote.selected === conversation.id ? "bg-black/5 dark:bg-white/5" : ""}`}
                        onClick={() => void pick(conversation.id)}
                      >
                        <span className="flex-1 truncate text-left">
                          {conversation.title}
                        </span>
                        {conversation.isRunning && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#0066ff]" />
                        )}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="remote-nav w-full">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-xs dark:bg-white/10">
                    C
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">
                    {remote.profile?.name ||
                      remote.profile?.email ||
                      t("account")}
                  </span>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="remote-popover w-60"
              >
                <DropdownMenuItem
                  onSelect={() => {
                    setSidebar(false);
                    setSettings(true);
                  }}
                >
                  <Settings size={15} />
                  {t("settings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setSidebar(false);
                    setSettings(true);
                  }}
                >
                  <Globe size={15} />
                  {t("language")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setSidebar(false);
                    setSettings(true);
                  }}
                >
                  <Palette size={15} />
                  {t("theme")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setSidebar(false);
                    setMetrics(true);
                  }}
                >
                  <BarChart2 size={15} />
                  {t("usage")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exit(true)}>
                  <ArrowLeftRight size={15} />
                  {t("switchAccount")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void remote.disconnect()}>
                  <Unplug size={15} />
                  {t("disconnect")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exit()}>
                  <LogOut size={15} />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={panel} onOpenChange={setPanel}>
        <SheetContent
          showCloseButton={false}
          className="remote-surface flex w-full sm:max-w-lg flex-col border-0 p-5 outline-none ring-0"
        >
          <div className="flex items-center justify-between">
            <SheetTitle>{t("activity")}</SheetTitle>
            <button
              className={iconButton}
              aria-label={t("close")}
              onClick={() => setPanel(false)}
            >
              <X size={18} />
            </button>
          </div>
          <SheetDescription>
            {remote.conversation?.title || t("newChat")}
          </SheetDescription>
          <ScrollArea className="min-h-0 flex-1 mt-5">
            {remote.live.tools?.length ? (
              remote.live.tools.map((tool: string, index: number) => (
                <p key={index} className="py-3 text-sm">
                  {tool}
                </p>
              ))
            ) : (
              <p className="text-sm text-[#969696]">{t("noActivity")}</p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <Dialog open={metrics} onOpenChange={setMetrics}>
        <DialogContent
          hideClose
          className="remote-surface rounded-2xl border-0 max-w-[calc(100vw-32px)] sm:max-w-md"
        >
          <div className="flex items-center justify-between">
            <DialogTitle>{t("metrics")}</DialogTitle>
            <button
              className={iconButton}
              aria-label={t("close")}
              onClick={() => setMetrics(false)}
            >
              <X size={18} />
            </button>
          </div>
          <DialogDescription>{remote.device}</DialogDescription>
          <dl className="space-y-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt>{t("run")}</dt>
              <dd>{t(running ? "running" : "idle")}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("context")}</dt>
              <dd>
                {short(Number(context.usedTokens))} /{" "}
                {short(Number(context.totalTokens))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("usage")}</dt>
              <dd>{short(Number(usage.totalTokens || 0))}</dd>
            </div>
          </dl>
          <p className="flex items-center gap-2 text-xs text-[#969696]">
            <ShieldCheck size={14} />
            {t("encrypted")}
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent
          hideClose
          className="remote-surface rounded-2xl border-0 max-w-[calc(100vw-32px)] sm:max-w-md"
        >
          <div className="flex justify-between">
            <DialogTitle>{t("settings")}</DialogTitle>
            <button
              className={iconButton}
              aria-label={t("close")}
              onClick={() => setSettings(false)}
            >
              <X size={18} />
            </button>
          </div>
          <DialogDescription>{t("account")}</DialogDescription>
          <label className="flex items-center justify-between gap-4 py-3 text-sm">
            {t("language")}
            <select
              className="remote-field !w-auto"
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value as typeof locale)
              }
            >
              {locales.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 py-3 text-sm">
            {t("theme")}
            <select
              className="remote-field !w-auto"
              value={theme || "system"}
              onChange={(event) => setTheme(event.target.value)}
            >
              {["light", "dark", "system"].map((value) => (
                <option key={value} value={value}>
                  {t(value as RemoteCopyKey)}
                </option>
              ))}
            </select>
          </label>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!section}
        onOpenChange={(open) => {
          if (!open) setSection(null);
        }}
      >
        <DialogContent
          hideClose
          className="remote-surface flex max-h-[80dvh] flex-col rounded-2xl border-0 max-w-[calc(100vw-32px)] sm:max-w-md"
        >
          <div className="flex justify-between">
            <DialogTitle>{t(section || "scheduled")}</DialogTitle>
            <button
              className={iconButton}
              aria-label={t("close")}
              onClick={() => setSection(null)}
            >
              <X size={18} />
            </button>
          </div>
          <DialogDescription>{t("readOnly")}</DialogDescription>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 py-4">
              {items.length ? (
                items.map((item) => (
                  <div key={item.id}>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[#969696]">
                      {item.description ||
                        (item.nextRunAt
                          ? new Date(item.nextRunAt).toLocaleString(locale)
                          : "")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#969696]">{t("emptyList")}</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <Dialog open={rename} onOpenChange={setRename}>
        <DialogContent
          hideClose
          className="remote-surface rounded-2xl border-0 max-w-[calc(100vw-32px)] sm:max-w-md"
        >
          <DialogTitle>{t("rename")}</DialogTitle>
          <DialogDescription>{remote.conversation?.title}</DialogDescription>
          <input
            className="remote-field"
            maxLength={200}
            aria-label={t("rename")}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="remote-button" onClick={() => setRename(false)}>
              {t("close")}
            </button>
            <button
              className="remote-button"
              disabled={!newTitle.trim()}
              onClick={() =>
                void act("conversation:rename", {
                  conversationId: remote.selected,
                  title: newTitle,
                }).then((result) => {
                  if (result) {
                    setRename(false);
                    void remote.refresh();
                  }
                })
              }
            >
              {t("save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
