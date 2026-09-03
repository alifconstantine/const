"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@const/ui";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-8 w-8 rounded-full border border-border/50 bg-secondary/50 ${
          className ?? ""
        }`}
      />
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`h-8 w-8 rounded-full border-border/70 bg-card hover:bg-secondary text-foreground cursor-pointer transition-colors ${
        className ?? ""
      }`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-foreground transition-all" />
      ) : (
        <Moon className="h-4 w-4 text-foreground transition-all" />
      )}
    </Button>
  );
}
