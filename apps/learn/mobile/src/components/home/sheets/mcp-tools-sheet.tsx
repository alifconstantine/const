import React, { useState } from "react";
import {
  X,
  Cable,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Play,
  Loader2,
  Sparkles,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import { testSandboxConnection } from "../../../lib/composio";

interface McpToolsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function McpToolsSheet({ open, onClose }: McpToolsSheetProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    durationMs: number;
    stdout?: string;
  } | null>(null);

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSandboxConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || String(err),
        durationMs: 0,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200",
          open ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] bg-card text-card-foreground border-t border-border rounded-t-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none transition-transform duration-300 ease-out safe-area-bottom",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="MCP Tools Status"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <Cable className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  MCP Tools
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-medium border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isIndo ? "Terkoneksi" : "Connected"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Composio Remote Cloud Sandbox & Execution
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
          {/* Runtime Info Card */}
          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border space-y-2 select-none">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{isIndo ? "Protokol Alat" : "Tool Protocol"}</span>
              <span className="font-mono font-medium text-foreground">Composio MCP REST v3.1</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{isIndo ? "Lingkungan Sandbox" : "Sandbox Engine"}</span>
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Cpu className="w-3 h-3 text-muted-foreground" />
                E2B Linux Cloud (x86_64)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{isIndo ? "Status Otorisasi" : "Auth Status"}</span>
              <span className="text-emerald-500 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isIndo ? "Zero Auth (Siap Pakai)" : "Zero Auth (Ready)"}
              </span>
            </div>
          </div>

          {/* Active Tool: Code Interpreter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {isIndo ? "Alat Aktif" : "Active Tool"}
              </h3>
              <span className="text-[10px] text-emerald-500 font-medium">1 Toolkit Active</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/20 border border-border flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 shadow-xs">
                  <Terminal className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        Code Interpreter
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-secondary text-muted-foreground border border-border/60">
                        Python 3.11
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-medium border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                    {isIndo
                      ? "Eksekusi kode Python, perhitungan matematis kalkulus/aljabar, analisis data, dan manipulasi komputasi secara aman di sandbox cloud terisolasi."
                      : "Executes Python code, mathematical computations, data analysis, and scripts safely in an isolated cloud sandbox."}
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border/50">
                  ⚡ Auto-Invoked by Ask AI
                </span>
                <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border/50">
                  🔒 Isolated Container
                </span>
                <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border/50">
                  📊 NumPy / SymPy / Math
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Sandbox Test Runner */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isIndo ? "Uji Koneksi Sandbox" : "Test Sandbox Live"}</span>
              </div>
              <button
                type="button"
                onClick={handleRunTest}
                disabled={isTesting}
                className="px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{isIndo ? "Mengeksekusi..." : "Running..."}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isIndo ? "Jalankan Tes" : "Run Test"}</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isIndo
                ? "Jalankan pengujian langsung ke Composio Sandbox untuk memverifikasi kesiapan container Python sebelum digunakan di chat."
                : "Run a direct test against Composio Sandbox to verify Python container readiness."}
            </p>

            {testResult && (
              <div
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-mono space-y-1 select-text transition-all",
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-sans font-medium">
                  <span className="flex items-center gap-1">
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                    {testResult.success
                      ? isIndo
                        ? "Sandbox Berhasil Terhubung!"
                        : "Sandbox Connected Successfully!"
                      : isIndo
                        ? "Gagal Terhubung ke Sandbox"
                        : "Sandbox Connection Failed"}
                  </span>
                  {testResult.durationMs > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {testResult.durationMs}ms
                    </span>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-black/40 text-[11px] text-foreground whitespace-pre-wrap break-all leading-tight">
                  {testResult.stdout || testResult.message}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Integrations */}
          <div className="space-y-2 pt-1">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {isIndo ? "Integrasi Lainnya" : "More Integrations"}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-secondary/10 border border-border/60 flex flex-col justify-between">
                <span className="text-xs font-medium text-foreground">GitHub</span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {isIndo ? "Repo & Issues (Segera)" : "Repo & Issues (Soon)"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/10 border border-border/60 flex flex-col justify-between">
                <span className="text-xs font-medium text-foreground">Notion</span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {isIndo ? "Workspace Notes (Segera)" : "Workspace Notes (Soon)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {isIndo ? "Code Interpreter siap digunakan" : "Code Interpreter ready"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            {isIndo ? "Tutup" : "Close"}
          </button>
        </div>
      </div>
    </>
  );
}
