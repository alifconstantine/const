"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@const/ui/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`h-9 w-9 rounded-xl border border-border/40 bg-background/50 backdrop-blur-sm ${className ?? ""}`} />
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`h-9 w-9 rounded-xl border-border/50 bg-background/70 hover:bg-muted/80 backdrop-blur-sm transition-all active:scale-95 ${className ?? ""}`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-foreground/80 transition-all hover:text-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-foreground/80 transition-all hover:text-foreground" />
      )}
    </Button>
  );
}
