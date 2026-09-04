import * as React from "react";

import { cn } from "@const/ui/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:outline-none focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
