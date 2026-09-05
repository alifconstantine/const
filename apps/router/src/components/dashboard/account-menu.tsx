"use client";

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
  cn,
} from "@const/ui";
import Link from "next/link";
import {
  ChevronsUpDown,
  LogOut,
  Users,
  Settings,
} from "lucide-react";

export function AccountMenu({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <div className={cn(
        "flex items-center p-2 rounded-2xl bg-secondary/30 animate-pulse",
        isCollapsed ? "justify-center" : "gap-3"
      )}>
        <div className="h-8 w-8 rounded-full bg-secondary shrink-0" />
        {!isCollapsed && (
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-secondary" />
            <div className="h-2.5 w-28 rounded bg-secondary" />
          </div>
        )}
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
          className={cn(
            "w-full flex items-center p-1.5 rounded-2xl hover:bg-[#383838]/70 transition-colors cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isCollapsed ? "justify-center" : "justify-between"
          )}
          title={displayName}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 rounded-full border border-[#383838] shrink-0">
              {user?.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-[#1b1b1b] text-[#d4d4d4] text-xs font-serif font-medium">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-[#d4d4d4] group-hover:text-white truncate">
                    {displayName}
                  </p>
                  {user?.role === "admin" && (
                    <span className="rounded-full bg-white text-[#161616] px-1.5 py-0.2 text-[9px] uppercase font-mono font-semibold tracking-wider shrink-0">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#969696] truncate font-sans">
                  {displayEmail}
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <ChevronsUpDown className="h-4 w-4 text-[#969696] group-hover:text-white shrink-0 transition-colors ml-1" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={isCollapsed ? "right" : "top"}
        align={isCollapsed ? "end" : "start"}
        sideOffset={8}
        className="w-64 rounded-2xl p-1.5 border border-[#383838] bg-[#222222] text-[#d4d4d4] shadow-none"
      >
        <DropdownMenuLabel className="p-2.5 font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium leading-none text-[#d4d4d4]">
                {displayName}
              </p>
              {user?.role && (
                <span className="text-[10px] font-mono uppercase text-[#969696]">
                  ({user.role})
                </span>
              )}
            </div>
            <p className="text-[11px] leading-none text-[#969696] font-mono truncate pt-0.5">
              {displayEmail}
            </p>
            {user?._id && (
              <p className="text-[10px] leading-none text-[#5d5d5d] font-mono truncate pt-1">
                ID: {user._id}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-[#383838]" />

        <DropdownMenuItem
          asChild
          className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#383838] transition-colors"
        >
          <Link href="/settings" className="flex items-center w-full">
            <Settings className="h-3.5 w-3.5 mr-2" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => signIn("/dashboard", { switchAccount: true })}
          className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#383838] transition-colors"
        >
          <Users className="h-3.5 w-3.5 mr-2" />
          <span>Switch Account</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-[#383838]" />

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
