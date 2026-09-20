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
} from "lucide-react";
import { useI18n, LANGUAGE_OPTIONS } from "../lib/i18n";

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
}: NavbarProps) {
  const { t, language, setLanguage } = useI18n();
  const initials = getUserInitials(user?.name, user?.email);
  const [theme, setTheme] = useTheme();

  return (
    <header className="sticky top-0 w-full h-16 sm:h-20 bg-background/95 backdrop-blur-md px-5 flex items-center justify-between select-none z-40">
      {/* Left: Const Learn Brand Title (Styled like apps/router: Lora Const + pill badge Learn) */}
      <div className="flex items-center gap-2 select-none py-1">
        <span className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Const
        </span>
        <span className="text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
          Learn
        </span>
      </div>

      {/* Middle Spacer */}
      <div className="flex-1" />

      {/* Right: User Account Avatar Dropdown */}
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none p-0.5"
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9 rounded-full border border-border/70 transition-transform active:scale-95">
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

          <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-md mr-1">
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

            {/* App Language (Segmented Control) */}
            <div className="px-2 py-1.5 flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {t("language")}
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-secondary/80 border border-border/50">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setLanguage(opt.code)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      language === opt.code
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{opt.label === "Bahasa Indonesia" ? "Indonesia" : opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* App Theme (Segmented Control) */}
            <div className="px-2 py-1.5 flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                {theme === "dark" ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : theme === "light" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Laptop className="h-3.5 w-3.5" />
                )}
                {t("theme")}
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-secondary/80 border border-border/50">
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "system"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Laptop className="h-3 w-3" />
                  <span>{t("themeSystem")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-3 w-3" />
                  <span>{t("themeLight")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-3 w-3" />
                  <span>{t("themeDark")}</span>
                </button>
              </div>
            </div>

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
            >
              <Settings className="h-4 w-4" />
              <span>{t("settings")}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {onSwitchAccount && (
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-muted-foreground hover:text-foreground"
                onClick={onSwitchAccount}
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>{t("switchAccount")}</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-destructive focus:text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>{t("logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
