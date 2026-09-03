"use client";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@const/ui";
import { Ticket } from "lucide-react";

export default function TicketingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
          Support Ticketing.
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-light">
          Submit technical support tickets, bug reports, and provider request inquiries.
        </p>
      </div>

      <div className="p-8 sm:p-14 rounded-2xl border border-dashed border-border/60 bg-card flex items-center justify-center min-h-[380px]">
        <Empty className="p-0 border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
              <Ticket className="h-6 w-6 stroke-[1.5]" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-medium font-sans text-foreground">
              No Open Tickets
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
              Need assistance with your gateway connection or provider setups? Open a support ticket here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
