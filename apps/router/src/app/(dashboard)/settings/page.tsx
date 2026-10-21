"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { getAppUrl } from "@/lib/auth-constants";
import { calculateQuotaMetrics } from "@/lib/quota";
import {
  Button,
  Badge,
  Switch,
  Slider,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
  toast,
} from "@const/ui";
import {
  Settings,
  Cpu,
  Shield,
  Key,
  Database,
  Check,
  Copy,
  ExternalLink,
  RotateCcw,
  Save,
  LogOut,
  Users,
  Terminal,
  Activity,
  Zap,
} from "lucide-react";

export default function SettingsPage() {
  const { isAuthenticated, signIn, signOut } = useRouterAuth();
  const [appUrl, setAppUrl] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Gateway preferences state (persisted locally)
  const [defaultModel, setDefaultModel] = useState("gemini-3.8-flash");
  const [defaultTemperature, setDefaultTemperature] = useState(0.7);
  const [enableStreaming, setEnableStreaming] = useState(true);
  const [logPayloads, setLogPayloads] = useState(true);
  const [anonymizeTelemetry, setAnonymizeTelemetry] = useState(false);
  const [notifyLowQuota, setNotifyLowQuota] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAppUrl(getAppUrl());
    // Load local settings if previously stored
    try {
      const saved = localStorage.getItem("const_router_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.defaultModel) setDefaultModel(parsed.defaultModel);
        if (typeof parsed.defaultTemperature === "number") setDefaultTemperature(parsed.defaultTemperature);
        if (typeof parsed.enableStreaming === "boolean") setEnableStreaming(parsed.enableStreaming);
        if (typeof parsed.logPayloads === "boolean") setLogPayloads(parsed.logPayloads);
        if (typeof parsed.anonymizeTelemetry === "boolean") setAnonymizeTelemetry(parsed.anonymizeTelemetry);
        if (typeof parsed.notifyLowQuota === "boolean") setNotifyLowQuota(parsed.notifyLowQuota);
      }
    } catch {
      // Ignore local storage parse errors
    }
  }, []);

  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const combos = useQuery(
    api.router.combos.listCombos,
    isAuthenticated ? {} : "skip"
  );

  const apiKeys = useQuery(
    api.router.keys.listKeys,
    isAuthenticated ? {} : "skip"
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    try {
      const payload = {
        defaultModel,
        defaultTemperature,
        enableStreaming,
        logPayloads,
        anonymizeTelemetry,
        notifyLowQuota,
      };
      localStorage.setItem("const_router_settings", JSON.stringify(payload));
      toast.success("Settings saved", {
        description: "Your gateway routing preferences have been updated.",
      });
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  const handleResetDefaults = () => {
    setDefaultModel("gemini-3.8-flash");
    setDefaultTemperature(0.7);
    setEnableStreaming(true);
    setLogPayloads(true);
    setAnonymizeTelemetry(false);
    setNotifyLowQuota(true);
    localStorage.removeItem("const_router_settings");
    toast.info("Reset to defaults");
  };

  const metrics = calculateQuotaMetrics(quota);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
            Settings.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Manage gateway routing defaults, quota policies, telemetry, and account credentials.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="h-8 rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs font-medium px-4 cursor-pointer gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? "Saving..." : "Save changes"}</span>
          </Button>
        </div>
      </div>

      {/* 1. Gateway Defaults Card */}
      <div className="p-6 rounded-2xl bg-card space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            <h2 className="text-sm font-medium text-foreground">
              Gateway Routing Preferences
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-light">
            Default behaviors applied when clients do not specify granular query parameters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
          {/* Default Model Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Default Fallback Model
            </label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger className="h-9 w-full rounded-xl bg-secondary text-xs text-foreground border-none">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-card border-none text-foreground">
                <SelectItem value="gemini-3.8-flash">gemini-3.8-flash (Recommended)</SelectItem>
                <SelectItem value="glm-5.3-flash">glm-5.3-flash</SelectItem>
                <SelectItem value="deepseek-v4.1-flash">deepseek-v4.1-flash</SelectItem>
                <SelectItem value="qwen-3.8-omni-flash">qwen-3.8-omni-flash</SelectItem>
                <SelectItem value="gpt-6-luna">gpt-6-luna</SelectItem>
                {combos && combos.map((c) => (
                  <SelectItem key={c._id} value={`combo/${c.slug}`}>
                    combo/{c.slug} ({c.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground font-light">
              Used when a client omits the <code>model</code> parameter.
            </p>
          </div>

          {/* Default Temperature Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Default Temperature
              </label>
              <span className="text-xs font-mono font-medium text-foreground">
                {defaultTemperature.toFixed(2)}
              </span>
            </div>
            <div className="pt-2">
              <Slider
                value={[defaultTemperature]}
                min={0}
                max={1.5}
                step={0.05}
                onValueChange={(val) => {
                  const first = val[0];
                  if (typeof first === "number") setDefaultTemperature(first);
                }}
                className="cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-muted-foreground font-light">
              Controls randomness: 0.0 for deterministic code, 0.7 for conversational tasks.
            </p>
          </div>
        </div>

        {/* Streaming Switch */}
        <div className="pt-2 flex items-center justify-between p-3.5 rounded-xl bg-secondary/40">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">
              Server-Sent Events (SSE) Streaming
            </p>
            <p className="text-[11px] text-muted-foreground font-light">
              Stream incremental tokens in real-time by default for compatible endpoints.
            </p>
          </div>
          <Switch
            checked={enableStreaming}
            onCheckedChange={setEnableStreaming}
            className="data-[state=checked]:bg-foreground"
          />
        </div>
      </div>

      {/* 2. Token & Image Quota Card */}
      <div className="p-6 rounded-2xl bg-card space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            <h2 className="text-sm font-medium text-foreground">
              Pay-As-You-Go Quota &amp; Metering Status
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-light">
            Metered 7,000,000 tokens and 20 image generations/edits included per 7-day rolling cycle on Pay-As-You-Go.
          </p>
        </div>

        {/* Tokens Balance */}
        <div className="p-4 rounded-xl bg-secondary/40 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono uppercase text-[10px]">
              Tokens Balance
            </span>
            <span className="font-mono font-bold text-foreground">
              {metrics.formattedRemaining} / {metrics.formattedLimit} tokens left
            </span>
          </div>

          {/* Simple Clean Progress Fill */}
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500 rounded-full", metrics.barColor)}
              style={{ width: `${metrics.percentRemaining}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{metrics.percentRemaining.toFixed(0)}% remaining</span>
            <span>
              {metrics.resetsInText ? `Resets in ${metrics.resetsInText}` : "Resets weekly"}
            </span>
          </div>
        </div>

        {/* Images Balance */}
        <div className="p-4 rounded-xl bg-secondary/40 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono uppercase text-[10px]">
              Images Balance (Generations &amp; Edits)
            </span>
            <span className="font-mono font-bold text-foreground">
              {metrics.remainingImages} / {metrics.limitImages} images left
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                metrics.isImageCapped
                  ? "bg-rose-500"
                  : metrics.percentImagesRemaining <= 25
                  ? "bg-amber-400"
                  : "bg-foreground"
              )}
              style={{ width: `${metrics.percentImagesRemaining}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{metrics.percentImagesRemaining.toFixed(0)}% remaining</span>
            <span>20 generations / edits per week</span>
          </div>
        </div>

        {/* Low Quota Notification Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">
              Quota Depletion Warnings
            </p>
            <p className="text-[11px] text-muted-foreground font-light">
              Display prominent indicators in the sidebar when quota balance falls below 15%.
            </p>
          </div>
          <Switch
            checked={notifyLowQuota}
            onCheckedChange={setNotifyLowQuota}
            className="data-[state=checked]:bg-foreground"
          />
        </div>
      </div>

      {/* 3. Privacy & Telemetry Card */}
      <div className="p-6 rounded-2xl bg-card space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            <h2 className="text-sm font-medium text-foreground">
              Audit Logs &amp; Telemetry
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-light">
            Control what metadata and tokens are preserved in your private request logs.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                Request &amp; Response Logging
              </p>
              <p className="text-[11px] text-muted-foreground font-light">
                Save latency, token counts, and error messages to your <Link href="/logs" className="underline text-foreground">Request logs</Link>.
              </p>
            </div>
            <Switch
              checked={logPayloads}
              onCheckedChange={setLogPayloads}
              className="data-[state=checked]:bg-foreground"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">
                Anonymize IP &amp; User Agent
              </p>
              <p className="text-[11px] text-muted-foreground font-light">
                Redact client IP addresses and user agents from gateway telemetry records.
              </p>
            </div>
            <Switch
              checked={anonymizeTelemetry}
              onCheckedChange={setAnonymizeTelemetry}
              className="data-[state=checked]:bg-foreground"
            />
          </div>
        </div>
      </div>

      {/* 4. Account & Environment Card */}
      <div className="p-6 rounded-2xl bg-card space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            <h2 className="text-sm font-medium text-foreground">
              Account &amp; Environment
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-light">
            Your authenticated session and active connected services.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-secondary/40 space-y-1 text-xs">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">User Name</span>
            <p className="font-medium text-foreground">{user?.name || "Developer"}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/40 space-y-1 text-xs">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Email</span>
            <p className="font-medium text-foreground truncate">{user?.email || "developer@const.dev"}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/40 space-y-1 text-xs sm:col-span-2 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 flex-1 pr-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">User ID</span>
              <p className="font-mono text-foreground truncate text-[11px]">{user?._id || "Loading..."}</p>
            </div>
            {user?._id && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(user._id, "user-id")}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                {copiedId === "user-id" ? (
                  <Check className="h-3 w-3 text-foreground" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Quick Resource Summary */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-base font-serif font-bold text-foreground">
              {apiKeys ? apiKeys.length : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">API Keys</p>
          </div>

          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-base font-serif font-bold text-foreground">
              {combos ? combos.length : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">Combos</p>
          </div>

          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-base font-serif font-bold text-foreground">
              v1
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">Router</p>
          </div>
        </div>

        {/* Account Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => signIn("/dashboard", { switchAccount: true })}
            className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Switch Account</span>
          </Button>

          <Button
            variant="ghost"
            onClick={() => signOut("/")}
            className="h-8 rounded-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
