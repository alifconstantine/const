"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { ConstLogoIcon } from "@const/ui";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, signIn } = useRouterAuth();

  const continueParam =
    searchParams.get("continue") ||
    searchParams.get("redirect") ||
    "/dashboard";

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace(
        continueParam.startsWith("/") && !continueParam.startsWith("//")
          ? continueParam
          : "/dashboard",
      );
    } else {
      signIn(continueParam);
    }
  }, [isLoading, isAuthenticated, router, signIn, continueParam]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <ConstLogoIcon
          size="md"
          className="w-8 h-8 text-foreground animate-pulse"
        />
        <p className="text-xs font-mono text-muted-foreground">
          {isAuthenticated
            ? "Redirecting to Dashboard..."
            : "Connecting to Const Accounts..."}
        </p>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <ConstLogoIcon
              size="md"
              className="w-8 h-8 text-foreground animate-pulse"
            />
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
