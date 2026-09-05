"use client";

import { useState } from "react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  cn,
  toast,
} from "@const/ui";
import Link from "next/link";
import {
  ChevronsUpDown,
  LogOut,
  Users,
  Settings,
  Key,
  ExternalLink,
  Copy,
  Check,
  Zap,
} from "lucide-react";

export function AccountMenu({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const [copied, setCopied] = useState(false);

  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?._id) return;
    navigator.clipboard.writeText(user._id);
    setCopied(true);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <div
        className={cn(
          "flex items-center p-2 rounded-2xl bg-[#222222]/50 animate-pulse",
          isCollapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="h-8 w-8 rounded-full bg-[#383838] shrink-0" />
        {!isCollapsed && (
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-[#383838]" />
            <div className="h-2.5 w-28 rounded bg-[#383838]" />
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
            "w-full flex items-center p-2 rounded-2xl hover:bg-[#333333] data-[state=open]:bg-[#333333] transition-all cursor-pointer group outline-none",
            isCollapsed ? "justify-center" : "justify-between"
          )}
          title={displayName}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="h-8 w-8 rounded-full border-none shrink-0">
                {user?.image ? (
                  <AvatarImage src={user.image} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-[#1e1e1e] text-[#d4d4d4] text-xs font-serif font-medium">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#2b2b2b]" />
            </div>
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
            <ChevronsUpDown className="h-4 w-4 text-[#969696] group-hover:text-white shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 ml-1" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={isCollapsed ? "right" : "top"}
        align={isCollapsed ? "end" : "start"}
        sideOffset={10}
        className="w-72 sm:w-80 rounded-2xl p-2.5 border-none bg-[#1e1e1e] text-[#d4d4d4] shadow-2xl shadow-black/90 select-none z-50 animate-in fade-in-50 zoom-in-95"
      >
        {/* User Identity Card */}
        <div className="p-3 rounded-xl bg-[#282828] mb-2 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 rounded-full border-none shrink-0 ring-1 ring-white/10">
                {user?.image ? (
                  <AvatarImage src={user.image} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-[#1b1b1b] text-white text-sm font-serif font-medium">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#282828]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium text-white truncate">
                  {displayName}
                </p>
                {user?.role === "admin" ? (
                  <span className="rounded-full bg-white text-[#161616] px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-wider shrink-0">
                    Admin
                  </span>
                ) : (
                  <span className="rounded-full bg-[#383838] text-[#d4d4d4] px-1.5 py-0.5 text-[9px] uppercase font-mono tracking-wider shrink-0">
                    Member
                  </span>
                )}
              </div>
              <p className="text-xs text-[#969696] font-sans truncate mt-0.5">
                {displayEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded-full bg-[#1b1b1b] text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Const SSO Active
            </span>
          </div>

          {user?._id && (
            <button
              type="button"
              onClick={handleCopyId}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#333333] text-[#8e8e8e] hover:text-[#d4d4d4] text-[11px] font-mono transition-colors cursor-pointer group"
              title="Click to copy User ID"
            >
              <span className="truncate">ID: {user._id}</span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400 shrink-0 ml-1.5" />
              ) : (
                <Copy className="h-3 w-3 text-[#717171] group-hover:text-white shrink-0 ml-1.5 transition-colors" />
              )}
            </button>
          )}
        </div>

        {/* Quota Snapshot Card */}
        <div className="p-2.5 rounded-xl bg-[#242424] mb-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#d4d4d4] flex items-center gap-1.5 font-medium">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Free Quota
            </span>
            <span className="font-mono text-[11px] text-[#969696]">
              {quota
                ? `${(quota.remainingTokens / 1_000_000).toFixed(1)}M / 7M left`
                : "7.0M / 7M left"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#181818] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                (quota?.percentRemaining ?? 100) > 30
                  ? "bg-emerald-400"
                  : (quota?.percentRemaining ?? 100) > 10
                  ? "bg-amber-400"
                  : "bg-rose-500"
              )}
              style={{ width: `${quota?.percentRemaining ?? 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#717171] font-mono">
            <span>
              {quota ? `${quota.percentRemaining.toFixed(0)}% available` : "100% available"}
            </span>
            <span>
              {quota?.resetsInText ? `Resets in ${quota.resetsInText}` : "Resets weekly"}
            </span>
          </div>
        </div>

        {/* Action Menu Items */}
        <div className="space-y-0.5">
          <DropdownMenuItem
            asChild
            className="rounded-xl cursor-pointer p-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] focus:text-white transition-colors"
          >
            <Link href="/settings" className="flex items-center gap-2.5 w-full">
              <div className="p-1.5 rounded-lg bg-[#282828] text-[#d4d4d4]">
                <Settings className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-xs">Settings</p>
                <p className="text-[10px] text-[#8e8e8e] truncate">
                  Gateway preferences & configuration
                </p>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="rounded-xl cursor-pointer p-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] focus:text-white transition-colors"
          >
            <Link href="/keys" className="flex items-center gap-2.5 w-full">
              <div className="p-1.5 rounded-lg bg-[#282828] text-[#d4d4d4]">
                <Key className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-xs">API Keys</p>
                <p className="text-[10px] text-[#8e8e8e] truncate">
                  Create & manage bearer tokens
                </p>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="rounded-xl cursor-pointer p-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] focus:text-white transition-colors"
          >
            <a
              href="https://accounts.const.web.id"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 w-full"
            >
              <div className="p-1.5 rounded-lg bg-[#282828] text-[#d4d4d4]">
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-medium text-white text-xs">Const Accounts</p>
                  <ExternalLink className="h-2.5 w-2.5 text-[#8e8e8e]" />
                </div>
                <p className="text-[10px] text-[#8e8e8e] truncate">
                  Manage SSO profile, security & 2FA
                </p>
              </div>
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => signIn("/dashboard", { switchAccount: true })}
            className="rounded-xl cursor-pointer p-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] focus:text-white transition-colors"
          >
            <div className="flex items-center gap-2.5 w-full">
              <div className="p-1.5 rounded-lg bg-[#282828] text-[#d4d4d4]">
                <Users className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-xs">Switch Account</p>
                <p className="text-[10px] text-[#8e8e8e] truncate">
                  Sign in with another identity
                </p>
              </div>
            </div>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="bg-[#2b2b2b] my-1.5" />

        <DropdownMenuItem
          onClick={() => signOut("/")}
          className="rounded-xl cursor-pointer p-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 transition-colors"
        >
          <div className="flex items-center gap-2.5 w-full">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-rose-400 text-xs">Sign Out</p>
              <p className="text-[10px] text-rose-400/70 truncate">
                End active session on this device
              </p>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
