"use client";

import * as React from "react";
import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
} from "@const/ui";
import { ArrowRight, UserPlus, LogOut, Loader2, CheckCircle2 } from "lucide-react";

export interface AccountChooserProps {
  user?: {
    _id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  } | null;
  targetAppName: string;
  onContinue: () => void;
  onUseAnotherAccount: () => void;
  isContinuing?: boolean;
  isSigningOut?: boolean;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letterParts = parts.filter((p) => /[a-zA-Z]/.test(p));
    const candidateParts = letterParts.length > 0 ? letterParts : parts;
    const first = candidateParts[0];
    const last = candidateParts.length > 1 ? candidateParts[candidateParts.length - 1] : undefined;
    if (first) {
      const firstLetter = first.match(/[a-zA-Z]/)?.[0] || first[0] || "";
      if (last) {
        const lastLetter = last.match(/[a-zA-Z]/)?.[0] || last[0] || "";
        return (firstLetter + lastLetter).toUpperCase();
      }
      return first.substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const parts = email.trim().split("@");
    const username = parts[0];
    if (username && username.length > 0) {
      const letters = username.replace(/[^a-zA-Z]/g, "");
      if (letters.length >= 2) return letters.substring(0, 2).toUpperCase();
      return username.substring(0, 2).toUpperCase();
    }
  }
  return "U";
}

export function AccountChooser({
  user,
  targetAppName,
  onContinue,
  onUseAnotherAccount,
  isContinuing = false,
  isSigningOut = false,
}: AccountChooserProps) {
  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name || user?.email || "User";
  const firstName = user?.name ? user.name.split(/\s+/)[0] : user?.email;

  const isBusy = isContinuing || isSigningOut;

  return (
    <div className="relative z-10 w-full max-w-[440px] sm:max-w-[460px] rounded-[32px] bg-card/90 dark:bg-[#141414]/90 backdrop-blur-xl border border-border/70 p-8 sm:p-10 shadow-none my-auto text-card-foreground transition-all animate-in fade-in duration-500 select-none">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-5 inline-flex items-center justify-center transition-transform duration-300 hover:scale-105">
          <ConstLogoIcon size="xl" className="w-12 h-12 text-foreground" />
        </div>

        <h1 className="text-3xl sm:text-[34px] font-serif font-normal tracking-tight text-foreground leading-tight">
          Sign in to {targetAppName}.
        </h1>
        <p className="mt-2.5 text-sm text-muted-foreground font-sans font-light max-w-xs">
          Choose an account or sign in with another identity to continue.
        </p>
      </div>

      {/* Active Account Tile */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-muted/30 p-4 flex items-center justify-between transition-all hover:bg-muted/50">
        <div className="flex items-center gap-3.5 min-w-0 pr-2">
          <Avatar className="h-11 w-11 rounded-full border border-border/70 shrink-0">
            {user?.image ? (
              <AvatarImage
                src={user.image}
                alt={displayName}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="bg-secondary text-secondary-foreground font-sans text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                {displayName}
              </span>
              {user?.role && (
                <span className="rounded-full bg-foreground/10 text-foreground px-2 py-0.5 text-[9px] uppercase font-semibold tracking-wider shrink-0">
                  {user.role}
                </span>
              )}
            </div>
            {user?.email && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px] font-sans">
                {user.email}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium shrink-0">
          <CheckCircle2 className="h-3 w-3" />
          <span>Active</span>
        </div>
      </div>

      {/* Primary & Secondary Action Buttons */}
      <div className="space-y-3 font-sans">
        <Button
          type="button"
          onClick={onContinue}
          disabled={isBusy}
          className="w-full h-12 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {isContinuing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Continuing...</span>
            </>
          ) : (
            <>
              <span>Continue as {firstName}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onUseAnotherAccount}
          disabled={isBusy}
          className="w-full h-12 rounded-full border-border/70 font-medium text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer text-muted-foreground hover:text-foreground"
        >
          {isSigningOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Switching account...</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 stroke-[1.8]" />
              <span>Use another account</span>
            </>
          )}
        </Button>
      </div>

      {/* Footer Legal & Info */}
      <div className="mt-8 pt-4 border-t border-border/40 text-center text-xs text-muted-foreground leading-relaxed font-sans">
        <p className="text-[11px] text-muted-foreground/70">
          Secured by Const Central Identity Provider · Single Sign-On
        </p>
      </div>
    </div>
  );
}
