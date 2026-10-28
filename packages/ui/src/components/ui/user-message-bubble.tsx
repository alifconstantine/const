"use client";
import * as React from "react";
import { cn } from "../../lib/utils";

/** Shared desktop/mobile user message surface; behavior is supplied by each client. */
export function UserMessageBubble({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "relative w-fit rounded-2xl rounded-tr-[2px] bg-[#f0f0f0] dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] px-4 py-2 text-[13.5px] text-[#262626] dark:text-[#ececec] select-text leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] overflow-hidden",
        className,
      )}
    />
  );
}
