"use client";

import { useState } from "react";
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
  ShieldCheck,
} from "lucide-react";

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
    if (first) {
      if (last && last[0]) {
        return (first[0] + last[0]).toUpperCase();
      }
      return first.substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const parts = email.trim().split("@");
    if (parts[0] && parts[0].length > 0) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  }
  return "U";
}

export function AccountMenu({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const [copiedId, setCopiedId] = useState(false);

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <div
        className={cn(
          "flex items-center p-2 rounded-2xl bg-[#222222]/60 animate-pulse border border-[#333333]/50",
          isCollapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="h-8 w-8 rounded-full bg-[#2e2e2e] shrink-0" />
        {!isCollapsed && (
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-[#2e2e2e]" />
            <div className="h-2.5 w-28 rounded bg-[#2a2a2a]" />
          </div>
        )}
      </div>
    );
  }

  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name || user?.email?.split("@")[0] || "Developer";
  const displayEmail = user?.email || "No email";

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?._id) return;
    navigator.clipboard.writeText(user._id);
    setCopiedId(true);
    toast.success("Copied User ID", {
      description: "User ID copied to clipboard.",
    });
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center p-2 rounded-2xl border border-transparent hover:border-[#383838] hover:bg-[#333333]/80 data-[state=open]:bg-[#383838] data-[state=open]:border-[#4a4a4a] transition-all cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-white/20",
            isCollapsed ? "justify-center" : "justify-between"
          )}
          title={displayName}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 rounded-full border border-[#444444] bg-[#141414] shrink-0">
              {user?.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-[#141414] text-[#d4d4d4] text-[11px] font-mono font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-[#d4d4d4] group-hover:text-white group-data-[state=open]:text-white truncate">
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
            <ChevronsUpDown className="h-4 w-4 text-[#888888] group-hover:text-white group-data-[state=open]:text-white group-data-[state=open]:rotate-180 shrink-0 transition-transform duration-200 ml-1" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={isCollapsed ? "right" : "top"}
        align={isCollapsed ? "end" : "start"}
        sideOffset={10}
        className="w-72 rounded-2xl p-2 border border-[#383838] bg-[#1e1e1e] text-[#d4d4d4] shadow-2xl shadow-black/80 space-y-1.5"
      >
        {/* Top Profile Inset Card */}
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="p-3 rounded-xl bg-[#141414] border border-[#2b2b2b] space-y-2.5">
            {/* User Info Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-9 w-9 rounded-full border border-[#383838] bg-[#1b1b1b] shrink-0">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-[#1b1b1b] text-white text-xs font-mono font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-[#969696] font-mono truncate">
                    {displayEmail}
                  </p>
                </div>
              </div>

              {/* Plan / Role Badge */}
              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#cccccc] font-medium tracking-wide shrink-0">
                {user?.role === "admin" ? "Admin" : "Developer"}
              </span>
            </div>

            {/* User ID & SSO Connected Strip */}
            <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-1.5 text-[#888888] truncate max-w-[170px]">
                <span>ID:</span>
                <span className="text-[#b0b0b0] truncate select-all">
                  {user?._id ? `${user._id.slice(0, 14)}...` : "—"}
                </span>
              </div>
              {user?._id && (
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 rounded hover:bg-[#2a2a2a] text-[#888888] hover:text-white transition-colors cursor-pointer"
                  title="Copy User ID"
                  aria-label="Copy User ID"
                >
                  {copiedId ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            {/* Central SSO Status */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#888888]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">Connected to Const Accounts Hub</span>
            </div>
          </div>
        </DropdownMenuLabel>

        <div className="px-1 pt-1 space-y-0.5">
          {/* Central Accounts Link */}
          <DropdownMenuItem
            asChild
            className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] transition-colors"
          >
            <a
              href="https://accounts.const.web.id"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full group/link"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#969696] group-hover/link:text-white" />
                <span>Manage Const Account</span>
              </div>
              <ExternalLink className="h-3 w-3 text-[#666666] group-hover/link:text-[#aaaaaa]" />
            </a>
          </DropdownMenuItem>

          {/* Router API Keys Link */}
          <DropdownMenuItem
            asChild
            className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] transition-colors"
          >
            <Link href="/keys" className="flex items-center gap-2.5 w-full">
              <Key className="h-4 w-4 text-[#969696]" />
              <span>API Keys & Credentials</span>
            </Link>
          </DropdownMenuItem>

          {/* Router Settings Link */}
          <DropdownMenuItem
            asChild
            className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] transition-colors"
          >
            <Link href="/settings" className="flex items-center gap-2.5 w-full">
              <Settings className="h-4 w-4 text-[#969696]" />
              <span>Gateway Settings</span>
            </Link>
          </DropdownMenuItem>

          {/* Switch Account */}
          <DropdownMenuItem
            onClick={() => signIn("/dashboard", { switchAccount: true })}
            className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] transition-colors"
          >
            <div className="flex items-center gap-2.5 w-full">
              <Users className="h-4 w-4 text-[#969696]" />
              <span>Switch Account</span>
            </div>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="bg-[#2e2e2e] my-1" />

        {/* Sign Out */}
        <div className="px-1">
          <DropdownMenuItem
            onClick={() => signOut("/")}
            className="rounded-xl cursor-pointer py-2 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <div className="flex items-center gap-2.5 w-full font-medium">
              <LogOut className="h-4 w-4" />
              <span>Sign Out of Const</span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
