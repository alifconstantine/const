import { useState, type FormEvent } from "react";
import {
  Cable,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from "@const/ui";
import { useTranslation } from "../../lib/i18n";
import { useMcpConnections } from "../../lib/mcp/use-mcp";
import type {
  McpAuth,
  McpConnectionView,
  McpSaveInput,
} from "../../lib/mcp/types";
import {
  ConnectionTime,
  connectionAccountLabel,
} from "./plugin-connection-info";
import { PluginIcon } from "./plugin-icon";

function mcpErrorKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("setup")) return "mcp.errorSetup";
  if (message.includes("storage")) return "mcp.errorStorage";
  if (message.includes("busy")) return "mcp.errorBusy";
  if (message.includes("auth")) return "mcp.errorAuth";
  if (message.includes("connection")) return "mcp.errorConnection";
  return "mcp.errorInvalid";
}
function ConnectionForm({
  connection,
  workspacePath,
  onClose,
  onSaved,
}: {
  connection?: McpConnectionView;
  workspacePath?: string;
  onClose(): void;
  onSaved(): void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<McpSaveInput>(() => ({
    name: "",
    scope: "user",
    transport: "http",
    auth: "none",
    ...connection,
  }));
  const [apiKey, setApiKey] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [headers, setHeaders] = useState("");
  const [env, setEnv] = useState("");
  const [args, setArgs] = useState(JSON.stringify(connection?.args ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (patch: Partial<McpSaveInput>) =>
    setForm((current) => ({ ...current, ...patch }));
  const chooseAuth = (auth: McpAuth) => {
    const url = auth === "oauth" ? connection?.oauthUrl : connection?.apiKeyUrl;
    update({ auth, ...(url ? { url } : {}) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    let parsedArgs: string[] = [];
    let parsedHeaders: Record<string, string> | undefined;
    let parsedEnv: Record<string, string> | undefined;
    try {
      parsedArgs = JSON.parse(args);
      if (
        !Array.isArray(parsedArgs) ||
        parsedArgs.some((arg) => typeof arg !== "string")
      )
        throw new Error();
      for (const [value, assign] of [
        [
          headers,
          (value: Record<string, string>) => {
            parsedHeaders = value;
          },
        ],
        [
          env,
          (value: Record<string, string>) => {
            parsedEnv = value;
          },
        ],
      ] as const) {
        if (!value.trim()) continue;
        const parsed: unknown = JSON.parse(value);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed) ||
          Object.values(parsed).some((item) => typeof item !== "string")
        )
          throw new Error();
        assign(parsed as Record<string, string>);
      }
    } catch {
      setError(t("mcp.invalidJson"));
      return;
    }
    setBusy(true);
    try {
      const bridge = window.electron?.mcp;
      if (!bridge) throw new Error("connection");
      await bridge.save({
        ...form,
        workspacePath: form.scope === "workspace" ? workspacePath : undefined,
        url: form.transport === "http" ? form.url : undefined,
        command: form.transport === "stdio" ? form.command : undefined,
        args: form.transport === "stdio" ? parsedArgs : undefined,
        cwd: form.transport === "stdio" ? form.cwd || undefined : undefined,
        ...(apiKey ? { apiKey } : {}),
        ...(clientSecret ? { clientSecret } : {}),
        headers: parsedHeaders,
        env: parsedEnv,
      });
      setApiKey("");
      setClientSecret("");
      setHeaders("");
      setEnv("");
      toast.success(t("mcp.saved"));
      onSaved();
      onClose();
    } catch (failure) {
      setError(t(mcpErrorKey(failure)));
    } finally {
      setBusy(false);
    }
  };
  const field = "space-y-2 block text-sm text-[#d4d4d4]";
  const input =
    "bg-[#2b2b2b] border-[#383838] text-white placeholder:text-[#969696] rounded-xl";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        hideClose
        className="flex max-h-[90vh] w-[calc(100%-32px)] max-w-xl flex-col gap-5 rounded-2xl border-0 bg-[#222222] p-6 text-white shadow-none outline-none ring-0"
      >
        <div className="flex items-center justify-between gap-4">
          <DialogTitle>{t(connection ? "mcp.edit" : "mcp.add")}</DialogTitle>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-2 hover:bg-[#383838]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <DialogDescription className="text-sm text-[#969696]">
          {t("mcp.intro")}
        </DialogDescription>
        <form onSubmit={submit} className="min-h-0 flex flex-col gap-5">
          <ScrollArea
            className="h-[min(58vh,620px)] pr-3"
            thumbClassName="bg-white/20 hover:bg-white/30"
          >
            <fieldset disabled={busy} className="space-y-5 pb-2">
              <label className={field}>
                {t("mcp.name")}
                <Input
                  autoFocus
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => update({ name: event.target.value })}
                  className={input}
                />
              </label>
              <div className={field}>
                <span>{t("mcp.scope")}</span>
                <Select
                  value={form.scope}
                  disabled={!!connection}
                  onValueChange={(scope: "user" | "workspace") =>
                    update({ scope })
                  }
                >
                  <SelectTrigger aria-label={t("mcp.scope")} className={input}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t("mcp.global")}</SelectItem>
                    <SelectItem value="workspace" disabled={!workspacePath}>
                      {t("mcp.workspace")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={field}>
                <span>{t("mcp.connection")}</span>
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label={t("mcp.connection")}
                >
                  {(["http", "stdio"] as const).map((transport) => (
                    <button
                      key={transport}
                      type="button"
                      disabled={!!connection?.pluginId}
                      aria-pressed={form.transport === transport}
                      onClick={() =>
                        update({
                          transport,
                          auth: transport === "stdio" ? "none" : form.auth,
                        })
                      }
                      className={`rounded-lg px-3 py-2 text-sm ${form.transport === transport ? "bg-[#383838] text-white" : "text-[#969696] hover:text-white"}`}
                    >
                      {t(transport === "http" ? "mcp.remote" : "mcp.local")}
                    </button>
                  ))}
                </div>
              </div>
              {form.transport === "http" ? (
                <label className={field}>
                  {t("mcp.url")}
                  <Input
                    required
                    type="url"
                    placeholder={t("mcp.urlPlaceholder")}
                    value={form.url ?? ""}
                    onChange={(event) => update({ url: event.target.value })}
                    className={input}
                  />
                </label>
              ) : (
                <>
                  <label className={field}>
                    {t("mcp.command")}
                    <Input
                      required
                      value={form.command ?? ""}
                      onChange={(event) =>
                        update({ command: event.target.value })
                      }
                      className={input}
                    />
                  </label>
                  <label className={field}>
                    {t("mcp.args")}
                    <Input
                      value={args}
                      onChange={(event) => setArgs(event.target.value)}
                      className={input}
                    />
                  </label>
                  <label className={field}>
                    {t("mcp.cwd")}
                    <Input
                      value={form.cwd ?? ""}
                      onChange={(event) => update({ cwd: event.target.value })}
                      className={input}
                    />
                  </label>
                  <p className="text-xs text-[#969696]">
                    {t("mcp.localHint")} {t("mcp.localEnvHint")}
                  </p>
                </>
              )}
              <div className={field}>
                <span>{t("mcp.auth")}</span>
                <Select
                  value={form.auth}
                  onValueChange={(auth: McpAuth) => chooseAuth(auth)}
                >
                  <SelectTrigger aria-label={t("mcp.auth")} className={input}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      connection?.authOptions ??
                      (["none", "oauth", "api-key"] as McpAuth[])
                    )
                      .filter(
                        (auth) => form.transport !== "stdio" || auth === "none",
                      )
                      .map((auth) => (
                        <SelectItem key={auth} value={auth}>
                          {t(`mcp.${auth}`)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {form.auth === "api-key" && (
                <label className={field}>
                  {t("mcp.key")}
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={apiKey}
                    placeholder={
                      connection?.hasCredentials
                        ? t("mcp.savedSecret")
                        : undefined
                    }
                    onChange={(event) => setApiKey(event.target.value)}
                    className={input}
                  />
                </label>
              )}
              {form.auth === "oauth" && (
                <p className="text-xs leading-relaxed text-[#969696]">
                  {t("mcp.oauthHint")}
                </p>
              )}
              <details className="rounded-xl bg-[#2b2b2b] p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
                  <ChevronDown className="h-4 w-4" />
                  {t("mcp.advanced")}
                </summary>
                <div className="space-y-4 pt-4">
                  {form.auth === "oauth" && (
                    <>
                      <label className={field}>
                        {t("mcp.clientId")}
                        <Input
                          value={form.clientId ?? ""}
                          onChange={(event) =>
                            update({
                              clientId: event.target.value || undefined,
                            })
                          }
                          className={input}
                        />
                      </label>
                      <label className={field}>
                        {t("mcp.clientSecret")}
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={clientSecret}
                          onChange={(event) =>
                            setClientSecret(event.target.value)
                          }
                          className={input}
                        />
                      </label>
                      <label className={field}>
                        {t("mcp.scopes")}
                        <Input
                          value={form.scopes ?? ""}
                          onChange={(event) =>
                            update({ scopes: event.target.value || undefined })
                          }
                          className={input}
                        />
                      </label>
                    </>
                  )}
                  <label className={field}>
                    {t(form.transport === "http" ? "mcp.headers" : "mcp.env")}
                    <textarea
                      rows={3}
                      value={form.transport === "http" ? headers : env}
                      onChange={(event) =>
                        form.transport === "http"
                          ? setHeaders(event.target.value)
                          : setEnv(event.target.value)
                      }
                      className={`${input} w-full resize-y p-3 outline-none`}
                    />
                    <span className="text-xs text-[#969696]">
                      {t("mcp.savedFields", {
                        names:
                          (form.transport === "http"
                            ? connection?.headerNames
                            : connection?.envNames
                          )?.join(", ") || "—",
                      })}
                    </span>
                  </label>
                  <label className={field}>
                    {t("mcp.timeout")}
                    <Input
                      type="number"
                      min={1}
                      max={300}
                      value={(form.timeoutMs ?? 30_000) / 1000}
                      onChange={(event) =>
                        update({ timeoutMs: Number(event.target.value) * 1000 })
                      }
                      className={input}
                    />
                  </label>
                </div>
              </details>
            </fieldset>
          </ScrollArea>
          {error && (
            <p role="alert" className="text-sm text-white">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-white text-black hover:bg-[#d4d4d4]"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("mcp.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function McpSettings({
  workspacePath: rawWorkspace,
  pluginId,
  compact = false,
}: {
  workspacePath?: string;
  pluginId?: string;
  compact?: boolean;
}) {
  const workspacePath =
    rawWorkspace && rawWorkspace !== "Outside Project"
      ? rawWorkspace
      : undefined;
  const { t, language } = useTranslation();
  const { connections, error, loading, refresh } =
    useMcpConnections(workspacePath);
  const [scope, setScope] = useState("all");
  const [editor, setEditor] = useState<McpConnectionView | "new" | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const bridge = window.electron?.mcp;
  const run = async (id: string, operation: () => Promise<unknown>) => {
    setPending(id);
    try {
      await operation();
    } catch (failure) {
      toast.error(t(mcpErrorKey(failure)));
    } finally {
      setPending(null);
      refresh();
    }
  };
  const visible = connections.filter(
    (connection) =>
      (!pluginId || connection.pluginId === pluginId) &&
      (scope === "all" || connection.scope === scope),
  );
  return (
    <div className="space-y-5">
      {!compact && (
        <>
          <p className="text-sm leading-relaxed text-[#969696]">
            {t("mcp.intro")}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger
                aria-label={t("mcp.scope")}
                className="w-52 rounded-xl bg-[#2b2b2b]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mcp.all")}</SelectItem>
                <SelectItem value="user">{t("mcp.global")}</SelectItem>
                <SelectItem value="workspace" disabled={!workspacePath}>
                  {t("mcp.workspace")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setEditor("new")}
              className="rounded-xl bg-white text-black hover:bg-[#d4d4d4]"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("mcp.add")}
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#d4d4d4]">
          {t("mcp.errorConnection")}
        </p>
      )}
      {loading && (
        <Loader2
          aria-label={t("mcp.connecting")}
          className="h-4 w-4 animate-spin"
        />
      )}
      {!loading && !error && visible.length === 0 && (
        <p className="py-5 text-sm text-[#969696]">{t("mcp.empty")}</p>
      )}
      {visible.map((connection) => (
        <section
          key={connection.id}
          className={`space-y-4 rounded-2xl p-5 ${compact ? "bg-[#2b2b2b]" : "bg-[#222222]"}`}
        >
          <div className="flex items-center gap-3">
            {connection.pluginId ? (
              <PluginIcon
                name={connection.key
                  .replace(/^plugin-/, "")
                  .replace(/-[^-]+$/, "")}
              />
            ) : (
              <Cable className="h-6 w-6 text-[#d4d4d4]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-white">
                {connection.name}
              </p>
              <p className="text-xs text-[#969696]">
                {t(
                  connection.scope === "workspace"
                    ? "mcp.workspace"
                    : "mcp.global",
                )}
                {connection.pluginName
                  ? ` · ${t("mcp.managed", { name: connection.pluginName })}`
                  : ""}
              </p>
            </div>
            <Switch
              aria-label={connection.name}
              disabled={!!pending}
              checked={connection.enabled}
              onCheckedChange={(enabled) =>
                bridge &&
                void run(connection.id, () =>
                  bridge.save({ ...connection, enabled }),
                )
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#969696]">
            <span>
              {connection.isEffective
                ? t(`mcp.${connection.status}`)
                : t("mcp.overridden")}
            </span>
            <span className="min-w-0 break-all">
              {connection.transport === "http"
                ? connection.url
                : connection.command}
            </span>
          </div>
          <div className="space-y-1 text-xs text-[#969696]">
            <p>{t(connectionAccountLabel(connection))}</p>
            <ConnectionTime at={connection.lastConnectedAt} />
            {connection.managedOAuth === "github" && (
              <p>{t("mcp.githubAccessHint")}</p>
            )}
            {connection.auth === "oauth" &&
              connection.oauthClientRequired &&
              !connection.clientId && <p>{t("mcp.clientRequired")}</p>}
            {connection.setupUrl && (
              <button
                type="button"
                className="underline underline-offset-4 hover:text-white"
                onClick={() =>
                  void window.electron?.openExternal(connection.setupUrl!)
                }
              >
                {t(
                  connection.managedOAuth === "github"
                    ? "mcp.githubRepositories"
                    : "mcp.setupGuide",
                )}
              </button>
            )}
          </div>
          {connection.error && (
            <p role="alert" className="text-xs text-[#d4d4d4]">
              {t(mcpErrorKey(new Error(connection.error)))}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!!pending}
              onClick={() => setEditor(connection)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("common.edit")}
            </Button>
            {connection.enabled && connection.isEffective && (
              <>
                {(connection.auth === "none" || connection.hasCredentials) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!pending}
                    onClick={() =>
                      bridge &&
                      void run(connection.id, () =>
                        bridge.connect(connection.id, workspacePath),
                      )
                    }
                  >
                    {t("mcp.connect")}
                  </Button>
                )}
                {connection.auth === "oauth" && (
                  <Button
                    size="sm"
                    variant={connection.hasCredentials ? "ghost" : "default"}
                    disabled={
                      !!pending ||
                      !!(connection.oauthClientRequired && !connection.clientId)
                    }
                    onClick={() =>
                      bridge &&
                      void run(connection.id, () =>
                        bridge.authenticate(
                          connection.id,
                          workspacePath,
                          language,
                        ),
                      )
                    }
                  >
                    {t(
                      connection.hasCredentials
                        ? "mcp.reconnectAccount"
                        : "mcp.authenticate",
                    )}
                  </Button>
                )}
                {(connection.status === "connected" ||
                  connection.hasCredentials ||
                  connection.status === "connecting") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!pending && pending !== connection.id}
                    onClick={() =>
                      bridge &&
                      void run(connection.id, () =>
                        bridge.disconnect(connection.id, workspacePath),
                      )
                    }
                  >
                    {t(
                      pending === connection.id
                        ? "common.cancel"
                        : "mcp.disconnect",
                    )}
                  </Button>
                )}
              </>
            )}
            {!compact &&
              connection.scope === "user" &&
              workspacePath &&
              connection.isEffective && (
                <Button
                  size="sm"
                  variant="ghost"
                  title={t("mcp.overrideHint")}
                  disabled={!!pending}
                  onClick={() =>
                    bridge &&
                    void run(connection.id, () =>
                      bridge.override(connection.id, workspacePath),
                    )
                  }
                >
                  {t("mcp.override")}
                </Button>
              )}
            {!connection.pluginId && (
              <Button
                size="sm"
                variant="ghost"
                disabled={!!pending}
                onClick={() => setRemoveId(connection.id)}
                aria-label={t("common.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {pending === connection.id && (
              <Loader2
                aria-label={t("mcp.connecting")}
                className="h-4 w-4 animate-spin"
              />
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-[#969696]">
              {t("mcp.tools", { count: connection.tools.length })}
            </summary>
            <div className="space-y-3 pt-3">
              {connection.tools.length === 0 ? (
                <p className="text-xs text-[#969696]">{t("mcp.noTools")}</p>
              ) : (
                connection.tools.map((tool) => (
                  <div key={tool.name}>
                    <p className="break-words text-sm text-white">
                      {tool.name}
                    </p>
                    <p className="break-words text-xs leading-relaxed text-[#969696]">
                      {tool.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </details>
          {removeId === connection.id && (
            <div className="space-y-3 rounded-xl bg-[#2b2b2b] p-4">
              <p className="text-sm">{t("mcp.removeConfirm")}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!!pending}
                  onClick={() =>
                    bridge &&
                    void run(connection.id, async () => {
                      await bridge.remove(connection.id, workspacePath);
                      setRemoveId(null);
                    })
                  }
                >
                  {t("common.delete")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoveId(null)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </section>
      ))}
      {editor && (
        <ConnectionForm
          key={typeof editor === "string" ? editor : editor.id}
          connection={editor === "new" ? undefined : editor}
          workspacePath={workspacePath}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
