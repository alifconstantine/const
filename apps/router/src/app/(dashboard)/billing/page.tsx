"use client";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@const/ui";
import { CreditCard } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
          Billing &amp; Plans.
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-light">
          Subscription tiers, token allowances, pay-as-you-go settings, and invoices.
        </p>
      </div>

      <div className="p-8 sm:p-14 rounded-2xl border border-dashed border-border/60 bg-card flex items-center justify-center min-h-[380px]">
        <Empty className="p-0 border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
              <CreditCard className="h-6 w-6 stroke-[1.5]" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-medium font-sans text-foreground">
              Free Tier Active
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
              Your account currently has active Free Tier access (500,000 daily tokens) plus unlimited direct BYOK inference.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
