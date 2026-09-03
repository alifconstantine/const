import React from "react";
import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@const/ui";
import { Settings, LogOut, User as UserIcon, ArrowLeftRight } from "lucide-react";

export interface UserProfile {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

interface NavbarProps {
  user?: UserProfile | null;
  onSignOut: () => void;
  onSwitchAccount?: () => void;
}

export function getUserInitials(name?: string | null, email?: string | null): string {
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
    const username = parts[0];
    if (username && username.length > 0) {
      return username.substring(0, 2).toUpperCase();
    }
  }
  return "U";
}

export function Navbar({ user, onSignOut, onSwitchAccount }: NavbarProps) {
  const initials = getUserInitials(user?.name, user?.email);

  return (
    <header className="w-full h-14 border-b border-border/70 bg-background/95 backdrop-blur-md px-4 flex items-center justify-between select-none z-40">
      {/* Left: Const Logo & Product Badge */}
      <div className="flex items-center gap-2">
        <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="font-serif text-base font-normal tracking-tight text-foreground">
            Const
          </span>
          <span className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
            Learn
          </span>
        </div>
      </div>

      {/* Middle: Empty as requested */}
      <div className="flex-1" />

      {/* Right: User Account Avatar & Dropdown Menu */}
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none p-1"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8 rounded-full border border-border/70 transition-transform active:scale-95">
                {user?.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={user.name || "Avatar"}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="bg-secondary text-secondary-foreground font-sans text-xs font-medium">
                  {user === undefined ? (
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                  ) : (
                    initials
                  )}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-md mr-1">
            {(user?.name || user?.email) && (
              <>
                <div className="px-2 py-1.5">
                  {user.name && (
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user.name}
                    </p>
                  )}
                  {user.email && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Settings placeholder: intentionally does nothing
              }}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {onSwitchAccount && (
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-muted-foreground hover:text-foreground"
                onClick={onSwitchAccount}
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>Switch account</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-destructive focus:text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
