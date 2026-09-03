"use client";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@const/ui";
import { ScrollText } from "lucide-react";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
          Request Logs.
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-light">
          Real-time request audit trails, fallback hops, and SSE telemetry traces.
        </p>
      </div>

      <div className="p-8 sm:p-14 rounded-2xl border border-dashed border-border/60 bg-card flex items-center justify-center min-h-[380px]">
        <Empty className="p-0 border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
              <ScrollText className="h-6 w-6 stroke-[1.5]" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-medium font-sans text-foreground">
              No Request Logs Available
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
              Live audit logs showing Request IDs, status codes, latencies, and fallback paths will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
