import React, { useState } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useTheme,
  cn,
} from "@const/ui";
import {
  Settings,
  LogOut,
  User as UserIcon,
  ArrowLeftRight,
  Sun,
  Moon,
  Laptop,
  Globe,
  ChevronRight,
  Check,
  ArrowDownCircle,
} from "lucide-react";
import { useI18n, LANGUAGE_OPTIONS } from "../lib/i18n";
import { useAppUpdate } from "../lib/app-update";

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
  onOpenSettings?: () => void;
  onOpenUpdate?: () => void;
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

export function Navbar({
  user,
  onSignOut,
  onSwitchAccount,
  onOpenSettings,
  onOpenUpdate,
}: NavbarProps) {
  const { t, language, setLanguage } = useI18n();
  const { isUpdateAvailable, latestRelease } = useAppUpdate();
  const initials = getUserInitials(user?.name, user?.email);
  const [theme, setTheme] = useTheme();

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsMenuOpen(open);
    if (!open) {
      setIsThemeOpen(false);
      setIsLanguageOpen(false);
    }
  };

  return (
    <header className="sticky top-0 w-full h-16 sm:h-20 bg-background/95 backdrop-blur-md px-5 flex items-center justify-between select-none z-40">
      {/* Left: Const Learn Brand Title */}
      <div className="flex items-center gap-2 select-none py-1">
        <span className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Const
        </span>
        <span className="text-[11px] font-sans font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
          Learn
        </span>
      </div>

      {/* Middle Spacer */}
      <div className="flex-1" />

      {/* Right: User Account Avatar & Popover Menu */}
      <div className="flex items-center">
        <DropdownMenu open={isMenuOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none p-0.5 active:scale-95"
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9 rounded-full border border-border/70 transition-transform">
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
              {/* Notification dot if update is available */}
              {isUpdateAvailable && (
                <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-background" />
                </span>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-56 p-1.5 bg-popover/95 border border-border text-popover-foreground rounded-2xl shadow-xl select-none text-xs font-sans backdrop-blur-md z-50 mr-1 animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {/* User Profile Header */}
            {(user?.name || user?.email) && (
              <>
                <div className="px-2.5 py-1.5">
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
                <DropdownMenuSeparator className="my-1 bg-border/60" />
              </>
            )}

            {/* 0. Update Available (Shown only if update is available) */}
            {isUpdateAvailable && (
              <DropdownMenuItem
                onClick={() => {
                  setIsMenuOpen(false);
                  if (onOpenUpdate) onOpenUpdate();
                }}
                className="cursor-pointer flex items-center justify-between py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 focus:bg-emerald-500/20 focus:text-emerald-300 transition-colors border border-emerald-500/25 mb-1"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                  <span className="font-medium text-emerald-300">{t("updateAvailable")}</span>
                </div>
                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                  {latestRelease?.version}
                </span>
              </DropdownMenuItem>
            )}

            {/* 1. Settings */}
            <DropdownMenuItem
              onClick={() => {
                if (onOpenSettings) onOpenSettings();
              }}
              className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-foreground transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{t("settings")}</span>
            </DropdownMenuItem>

            {/* 2. Theme (Menu Ke Bawah / Collapsible Downwards) */}
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsThemeOpen((prev) => !prev);
                }}
                className="w-full cursor-pointer flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-foreground transition-colors outline-none text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{t("theme")}</span>
                </div>
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                    isThemeOpen && "rotate-90 text-foreground"
                  )}
                />
              </button>

              {isThemeOpen && (
                <div className="my-1 ml-3 pl-2.5 border-l border-border/70 flex flex-col gap-0.5 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                  {[
                    { value: "system", label: t("themeSystem"), icon: Laptop },
                    { value: "light", label: t("themeLight"), icon: Sun },
                    { value: "dark", label: t("themeDark"), icon: Moon },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = theme === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTheme(item.value as any);
                        }}
                        className={cn(
                          "flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-colors cursor-pointer text-left",
                          isSelected
                            ? "bg-secondary text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{item.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-foreground ml-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Language (Menu Ke Bawah / Collapsible Downwards) */}
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsLanguageOpen((prev) => !prev);
                }}
                className="w-full cursor-pointer flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-foreground transition-colors outline-none text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{t("language")}</span>
                </div>
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                    isLanguageOpen && "rotate-90 text-foreground"
                  )}
                />
              </button>

              {isLanguageOpen && (
                <div className="my-1 ml-3 pl-2.5 border-l border-border/70 flex flex-col gap-0.5 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const isSelected = language === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLanguage(opt.code);
                        }}
                        className={cn(
                          "flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-colors cursor-pointer text-left",
                          isSelected
                            ? "bg-secondary text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                        )}
                      >
                        <span>{opt.label === "Bahasa Indonesia" ? "Indonesia" : opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-foreground ml-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <DropdownMenuSeparator className="my-1 bg-border/60" />

            {/* 4. Switch account */}
            {onSwitchAccount && (
              <DropdownMenuItem
                onClick={onSwitchAccount}
                className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-foreground transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{t("switchAccount")}</span>
              </DropdownMenuItem>
            )}

            {/* 5. Log out */}
            <DropdownMenuItem
              onClick={onSignOut}
              className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-rose-500/10 focus:bg-rose-500/10 text-rose-500 focus:text-rose-500 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t("logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
