import * as React from "react";

import { cn } from "@const/ui/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-border/70 bg-muted/60 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 hover:border-foreground/30 focus-visible:outline-none focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
