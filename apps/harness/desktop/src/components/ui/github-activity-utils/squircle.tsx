import * as React from "react";
import { cn } from "@/lib/utils";

export interface SquircleProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Squircle({ className, ...props }: SquircleProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 -z-10 rounded-[28px] overflow-hidden pointer-events-none shadow-sm transition-colors",
        className
      )}
      {...props}
    />
  );
}

export default Squircle;
