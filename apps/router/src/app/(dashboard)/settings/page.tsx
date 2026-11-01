"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useQuery, useMutation } from "convex/react";
import { ArrowUpRight, Check, KeyRound, LogOut } from "lucide-react";
import { api } from "@const/backend/_generated/api";
import { DEFAULT_SETTINGS } from "@const/backend/router/preferences";
import { BUILTIN_MODELS } from "@/lib/model-specs";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, Switch, Input, cn, toast } from "@const/ui";

type Preferences = typeof DEFAULT_SETTINGS;

function Settings() {
  const { isAuthenticated, isSigningOut, signIn, signOut } = useRouterAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const settings = useQuery(
    api.router.settings.getSettings,
    isAuthenticated ? {} : "skip",
  );
  const combos = useQuery(
    api.router.combos.listCombos,
    isAuthenticated ? {} : "skip",
  );
  const save = useMutation(api.router.settings.saveSettings);
  const [draft, setDraft] = useState<Preferences>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => setMounted(true), []);
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
    setDraft((previous) => ({ ...previous, [key]: value }));
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

  const disabled = !settings || saving;
  const selectClass =
    "block h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mx-auto w-full max-w-6xl pb-12">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Settings
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your gateway defaults, privacy, and account.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => persist(DEFAULT_SETTINGS)}
            className="h-10 rounded-lg text-xs"
          >
            Reset defaults
          </Button>
          <Button
            disabled={disabled || !dirty}
            onClick={() => persist()}
            className="h-10 gap-2 rounded-lg text-xs"
          >
            {!saving && <Check className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      <SettingsSection
        title="Gateway defaults"
        description="Used when an API request leaves out a parameter. Playground controls apply to your current session."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Default model</span>
            <select
              disabled={disabled}
              className={selectClass}
              value={draft.defaultModel}
              onChange={(event) => change("defaultModel", event.target.value)}
            >
              {(["free", "paid"] as const).map((tier) => (
                <optgroup
                  label={tier === "free" ? "Free models" : "Paid models"}
                  key={tier}
                >
                  {BUILTIN_MODELS.filter(
                    (model) => model.category === "llm" && model.tier === tier,
                  ).map((model) => (
                    <option key={model.id} value={model.modelId}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              {combos?.some((combo) => combo.status === "active") && (
                <optgroup label="Your combos">
                  {combos
                    .filter((combo) => combo.status === "active")
                    .map((combo) => (
                      <option key={combo._id} value={"combo/" + combo.slug}>
                        {combo.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Temperature</span>
            <Input
              disabled={disabled}
              type="number"
              min={0}
              max={2}
              step={0.05}
              className="h-11 rounded-lg border-border bg-background text-sm tabular-nums"
              value={draft.defaultTemperature}
              onChange={(event) =>
                change(
                  "defaultTemperature",
                  Math.min(2, Math.max(0, Number(event.target.value))),
                )
              }
            />
            <span className="block text-xs text-muted-foreground">
              0 is precise. 2 is more varied.
            </span>
          </label>
        </div>
        <SettingToggle
          title="Stream responses"
          description="Return responses as they generate when stream is omitted. Combos always stream."
          checked={draft.enableStreaming}
          disabled={disabled}
          change={(value) => change("enableStreaming", value)}
        />
      </SettingsSection>

      <SettingsSection
        title="Privacy & data"
        description="Choose what future usage logs retain. Request counts and costs are always recorded."
      >
        <SettingToggle
          title="Save prompt excerpts"
          description="Include up to 4,000 characters of user prompt text in usage logs. Playground conversations are not saved as chat history."
          checked={draft.logPayloads}
          disabled={disabled}
          change={(value) => change("logPayloads", value)}
        />
        <SettingToggle
          title="Anonymize client metadata"
          description="Omit IP addresses and user agents from new usage logs. Existing records are unchanged."
          checked={draft.anonymizeTelemetry}
          disabled={disabled}
          change={(value) => change("anonymizeTelemetry", value)}
        />
        <Link
          href="/logs"
          className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View usage logs
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Stay aware of your available free quota."
      >
        <SettingToggle
          title="Low quota warning"
          description="Show a sidebar warning when less than 15% of your weekly free token allowance remains."
          checked={draft.notifyLowQuota}
          disabled={disabled}
          change={(value) => change("notifyLowQuota", value)}
        />
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        description="Choose how Router looks on this browser. This preference saves automatically."
      >
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Color theme"
        >
          {[
            { id: "light", label: "Light" },
            { id: "dark", label: "Dark" },
            { id: "system", label: "System" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={!mounted}
              aria-pressed={mounted && theme === option.id}
              onClick={() => setTheme(option.id)}
              className={cn(
                "flex h-11 min-w-24 items-center justify-center gap-2 rounded-lg border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                mounted && theme === option.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {mounted && theme === option.id && (
                <Check className="h-3.5 w-3.5" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Account & access"
        description="Authentication and sessions are managed by Const Accounts."
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">API keys</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Create and revoke gateway access.
              </p>
            </div>
          </div>
          <Link
            href="/keys"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Manage keys
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            <h3 className="text-sm font-medium">Current session</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isAuthenticated
                ? "Signed in through Const Accounts."
                : "Sign in to manage account preferences."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={isSigningOut}
              onClick={() => signIn("/settings", { switchAccount: true })}
              className="h-10 rounded-lg text-xs"
            >
              Switch account
            </Button>
            <Button
              variant="ghost"
              disabled={!isAuthenticated || isSigningOut}
              onClick={() => signOut("/")}
              className="h-10 gap-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </SettingsSection>
      <p
        role="status"
        aria-live="polite"
        className="pt-5 text-xs text-muted-foreground"
      >
        {!settings
          ? "Loading account preferences…"
          : dirty
            ? "You have unsaved changes."
            : "Gateway preferences are up to date."}
      </p>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-b border-border py-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
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
    <label
      className={cn(
        "flex items-start justify-between gap-5",
        disabled ? "cursor-default" : "cursor-pointer",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block max-w-xl text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={change}
        disabled={disabled}
        className="mt-0.5 shrink-0"
      />
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
