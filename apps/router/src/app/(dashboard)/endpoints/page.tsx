"use client";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@const/ui";
import { Terminal } from "lucide-react";

export default function EndpointsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
          Endpoints.
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-light">
          Universal OpenAI-compatible API base URLs and client integration guides.
        </p>
      </div>

      <div className="p-8 sm:p-14 rounded-2xl border border-dashed border-border/60 bg-card flex items-center justify-center min-h-[380px]">
        <Empty className="p-0 border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
              <Terminal className="h-6 w-6 stroke-[1.5]" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-medium font-sans text-foreground">
              Endpoints &amp; Integration Guides
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
              Configuration guides for Cursor, Claude Code, Cline, Python, and LangChain will be displayed here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
