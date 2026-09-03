"use client";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@const/ui";
import { TrendingUp } from "lucide-react";

export default function UsagePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
          Usage &amp; Telemetry.
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-light">
          Historical token consumption, BYOK savings breakdowns, and latency analytics.
        </p>
      </div>

      <div className="p-8 sm:p-14 rounded-2xl border border-dashed border-border/60 bg-card flex items-center justify-center min-h-[380px]">
        <Empty className="p-0 border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
              <TrendingUp className="h-6 w-6 stroke-[1.5]" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-medium font-sans text-foreground">
              No Usage Data Recorded
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
              Token consumption graphs and cost analytics will populate as requests are served.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
