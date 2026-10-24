"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { DEFAULT_SETTINGS } from "@const/backend/router/preferences";
import { BUILTIN_MODELS } from "@/lib/model-specs";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, Switch, Input, toast } from "@const/ui";
type Preferences = typeof DEFAULT_SETTINGS;
function Settings() {
  const { isAuthenticated, signIn, signOut } = useRouterAuth();
  const settings = useQuery(
    api.router.settings.getSettings,
    isAuthenticated ? {} : "skip",
  );
  const combos = useQuery(
    api.router.combos.listCombos,
    isAuthenticated ? {} : "skip",
  );
  const save = useMutation(api.router.settings.saveSettings);
  const [draft, setDraft] = useState<Preferences>(DEFAULT_SETTINGS),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (settings) {
      setDraft(settings);
      setDirty(false);
    }
  }, [settings]);
  const change = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };
  async function persist(value = draft) {
    setSaving(true);
    try {
      await save(value);
      setDraft(value);
      setDirty(false);
      toast.success("Settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save settings",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            Settings & data
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Defaults and privacy settings applied to your account across
            clients.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={saving || !settings}
            onClick={() => persist(DEFAULT_SETTINGS)}
          >
            Reset defaults
          </Button>
          <Button
            disabled={saving || !settings || !dirty}
            onClick={() => persist()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>
      <section className="rounded-2xl bg-card p-6 space-y-5">
        <h2 className="font-medium">Gateway defaults</h2>
        <p className="text-xs text-muted-foreground">
          Applied when an API request omits the corresponding parameter. The
          Playground uses the model and controls you select.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <label className="text-sm space-y-2 block">
            <span>Default model</span>
            <select
              disabled={!settings}
              className="block w-full rounded-xl bg-secondary p-3 text-xs font-mono"
              value={draft.defaultModel}
              onChange={(e) => change("defaultModel", e.target.value)}
            >
              {(["free", "paid"] as const).map((tier) => (
                <optgroup
                  label={tier === "free" ? "Free models" : "Paid models"}
                  key={tier}
                >
                  {BUILTIN_MODELS.filter(
                    (m) => m.category === "llm" && m.tier === tier,
                  ).map((m) => (
                    <option key={m.id} value={m.modelId}>
                      {m.name} · {m.modelId}
                    </option>
                  ))}
                </optgroup>
              ))}
              {combos?.some((c) => c.status === "active") && (
                <optgroup label="Your combos">
                  {combos
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <option key={c._id} value={"combo/" + c.slug}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="text-sm space-y-2 block">
            <span>Temperature</span>
            <Input
              disabled={!settings}
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={draft.defaultTemperature}
              onChange={(e) =>
                change("defaultTemperature", Number(e.target.value))
              }
            />
          </label>
        </div>
        <SettingToggle
          title="Stream chat responses by default"
          description="Used when stream is omitted. Combos always stream."
          checked={draft.enableStreaming}
          disabled={!settings}
          change={(value) => change("enableStreaming", value)}
        />
      </section>
      <section className="rounded-2xl bg-card p-6 space-y-5">
        <h2 className="font-medium">Privacy & request history</h2>
        <SettingToggle
          title="Save prompt excerpts in usage logs"
          description="Keep up to 4,000 characters of user prompt text. Usage counts and costs are always recorded. Playground chat history is saved separately."
          checked={draft.logPayloads}
          disabled={!settings}
          change={(value) => change("logPayloads", value)}
        />
        <SettingToggle
          title="Anonymize client metadata"
          description="Omit IP addresses and user agents from new usage logs. Existing records are unchanged."
          checked={draft.anonymizeTelemetry}
          disabled={!settings}
          change={(value) => change("anonymizeTelemetry", value)}
        />
        <p className="text-xs text-muted-foreground">
          Manage individual saved conversations in Playground history. Disabling
          prompt retention applies to future requests.
        </p>
      </section>
      <section className="rounded-2xl bg-card p-6 space-y-5">
        <h2 className="font-medium">Notifications</h2>
        <SettingToggle
          title="Low free-quota warning"
          description="Show a sidebar warning when less than 15% of your weekly free token allowance remains."
          checked={draft.notifyLowQuota}
          disabled={!settings}
          change={(value) => change("notifyLowQuota", value)}
        />
      </section>
      <section className="rounded-2xl bg-card p-6 space-y-5">
        <h2 className="font-medium">Account</h2>
        <p className="text-sm text-muted-foreground">
          Authentication is managed by Const Accounts.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => signIn("/settings", { switchAccount: true })}
          >
            Switch account
          </Button>
          <Button variant="outline" onClick={() => signOut("/")}>
            Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
function SettingToggle({
  title,
  description,
  checked,
  change,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  change: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-6 rounded-xl bg-secondary/30 p-4 cursor-pointer">
      <span>
        <span className="block text-sm">{title}</span>
        <span className="block text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
          {description}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={change} disabled={disabled} />
    </label>
  );
}
export default function SettingsPage() {
  return (
    <QueryBoundary name="Settings">
      <Settings />
    </QueryBoundary>
  );
}
