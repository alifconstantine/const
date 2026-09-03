"use client";

import Image from "next/image";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@const/ui";
import {
  ChevronsUpDown,
  LogOut,
  Users,
} from "lucide-react";

export function AccountMenu() {
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-2xl bg-secondary/30 animate-pulse">
        <div className="h-9 w-9 rounded-full bg-secondary" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-20 rounded bg-secondary" />
          <div className="h-2.5 w-28 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  const userInitial = user?.name
    ? user.name[0]?.toUpperCase()
    : user?.email
    ? user.email[0]?.toUpperCase()
    : "U";

  const displayName = user?.name || user?.email?.split("@")[0] || "Developer";
  const displayEmail = user?.email || "No email";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-secondary/60 transition-colors text-left cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 rounded-full border border-border/60 shrink-0">
              {user?.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-secondary text-foreground text-xs font-serif font-medium">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground truncate">
                  {displayName}
                </p>
                {user?.role === "admin" && (
                  <span className="rounded-full bg-foreground text-background px-1.5 py-0.2 text-[9px] uppercase font-mono font-semibold tracking-wider shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate font-sans">
                {displayEmail}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors ml-1" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-64 rounded-2xl p-1.5 border border-border/70 bg-card text-card-foreground shadow-none"
      >
        <DropdownMenuLabel className="p-2.5 font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium leading-none text-foreground">
                {displayName}
              </p>
              {user?.role && (
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  ({user.role})
                </span>
              )}
            </div>
            <p className="text-[11px] leading-none text-muted-foreground font-mono truncate pt-0.5">
              {displayEmail}
            </p>
            {user?._id && (
              <p className="text-[10px] leading-none text-muted-foreground/80 font-mono truncate pt-1">
                ID: {user._id}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border/60" />

        <DropdownMenuItem
          onClick={() => signIn("/dashboard", { switchAccount: true })}
          className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Users className="h-3.5 w-3.5 mr-2" />
          <span>Switch Account</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border/60" />

        <DropdownMenuItem
          onClick={() => signOut("/")}
          className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 mr-2" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
