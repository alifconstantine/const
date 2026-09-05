"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  Globe,
  BookOpen,
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
  const router = useRouter();
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const [selectedLang, setSelectedLang] = useState("en");

  // Global shortcut Ctrl+, or Cmd+, to navigate to Settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

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
        sideOffset={8}
        className="w-60 rounded-2xl p-1.5 border border-[#333333] bg-[#1a1a1a] text-[#d4d4d4] shadow-2xl shadow-black/80 space-y-0.5"
      >
        {/* 1. Settings */}
        <DropdownMenuItem
          asChild
          className="rounded-xl py-2 px-3 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#282828] focus:bg-[#282828] focus:text-white cursor-pointer transition-colors outline-none"
        >
          <Link href="/settings" className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-[#969696]" />
              <span className="font-medium text-white">Settings</span>
            </div>
            <span className="text-[11px] font-mono text-[#777777]">Ctrl+,</span>
          </Link>
        </DropdownMenuItem>

        {/* 2. Language */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="rounded-xl py-2 px-3 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#282828] focus:bg-[#282828] focus:text-white data-[state=open]:bg-[#282828] cursor-pointer transition-colors outline-none">
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-[#969696]" />
              <span className="font-medium text-white">Language</span>
            </div>
            <span className="ml-auto text-xs text-[#888888] font-normal mr-1">
              {selectedLang === "id" ? "Indonesia" : "English"}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="rounded-xl border border-[#333333] bg-[#1a1a1a] text-white p-1 shadow-2xl min-w-[150px]">
            <DropdownMenuRadioGroup value={selectedLang} onValueChange={setSelectedLang}>
              <DropdownMenuRadioItem
                value="en"
                className="rounded-lg text-xs py-1.5 px-2.5 cursor-pointer hover:bg-[#282828] focus:bg-[#282828]"
              >
                English
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="id"
                className="rounded-lg text-xs py-1.5 px-2.5 cursor-pointer hover:bg-[#282828] focus:bg-[#282828]"
              >
                Bahasa Indonesia
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 3. Docs */}
        <DropdownMenuItem
          asChild
          className="rounded-xl py-2 px-3 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#282828] focus:bg-[#282828] focus:text-white cursor-pointer transition-colors outline-none"
        >
          <Link href="/docs" className="flex items-center gap-2.5 w-full">
            <BookOpen className="h-4 w-4 text-[#969696]" />
            <span className="font-medium text-white">Docs</span>
          </Link>
        </DropdownMenuItem>

        {/* 4. Switch Account */}
        <DropdownMenuItem
          onClick={() => signIn("/dashboard", { switchAccount: true })}
          className="rounded-xl py-2 px-3 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#282828] focus:bg-[#282828] focus:text-white cursor-pointer transition-colors outline-none"
        >
          <div className="flex items-center gap-2.5 w-full">
            <Users className="h-4 w-4 text-[#969696]" />
            <span className="font-medium text-white">Switch Account</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-[#2e2e2e] my-1" />

        {/* 5. Logout */}
        <DropdownMenuItem
          onClick={() => signOut("/")}
          className="rounded-xl py-2 px-3 text-xs text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-400 cursor-pointer transition-colors outline-none font-medium"
        >
          <div className="flex items-center gap-2.5 w-full">
            <LogOut className="h-4 w-4 text-rose-500" />
            <span>Log out</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
