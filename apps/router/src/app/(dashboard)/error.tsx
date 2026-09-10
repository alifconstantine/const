"use client";

import { useEffect } from "react";
import { Button } from "@const/ui";
import { RotateCcw, LogIn, AlertCircle } from "lucide-react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { signIn } = useRouterAuth();

  useEffect(() => {
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-card border border-border space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-destructive border border-destructive/30">
              Dashboard Telemetry Error
            </span>
            <h2 className="text-xl font-serif text-foreground pt-1">
              Unable to load dashboard data
            </h2>
            <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">
              We encountered an issue communicating with the AI gateway backend. You can retry loading or refresh your authentication session.
            </p>
          </div>
        </div>

        {error?.message && (
          <div className="p-3 rounded-xl bg-secondary border border-border text-left">
            <p className="text-[11px] font-mono text-muted-foreground break-all line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="rounded-full h-10 px-6 gap-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => signIn("/dashboard")}
            className="rounded-full h-10 px-6 gap-2 text-xs font-medium border-border bg-secondary text-foreground hover:bg-muted cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Re-authenticate</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
