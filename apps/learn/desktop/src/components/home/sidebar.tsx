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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  useTheme,
  cn,
} from "@const/ui";
import {
  PanelLeft,
  BookOpen,
  FileText,
  Folder,
  Layers,
  Settings,
  Plus,
  ChevronsUpDown,
  Sun,
  Moon,
  Laptop,
  Check,
  LogOut,
  ArrowLeftRight,
  FolderPlus,
  PlusCircle,
  Globe,
  Bot,
  Server,
} from "lucide-react";
import { getUserInitials, type UserProfile } from "../navbar";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";

export type HomeNavTab = "learns" | "sources" | "collections" | "artifacts" | "models" | "mcp";

interface SidebarProps {
  activeTab: HomeNavTab;
  onSelectTab: (tab: HomeNavTab) => void;
  onCollapse: () => void;
  onCreateNewLearn: () => void;
  onCreateNewCollection?: () => void;
  onOpenSettings: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  learnsCount?: number;
  sourcesCount?: number;
  collectionsCount?: number;
  artifactsCount?: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  onCollapse,
  onCreateNewLearn,
  onCreateNewCollection,
  onOpenSettings,
  user,
  onSignOut,
  onSwitchAccount,
  learnsCount = 0,
  sourcesCount = 0,
  collectionsCount = 0,
  artifactsCount = 0,
}: SidebarProps) {
  const [theme, setTheme] = useTheme();
  const { language, setLanguage, t } = useI18n();
  const initials = getUserInitials(user?.name, user?.email);

  const navItems: Array<{
    id: HomeNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: "learns", label: t("learns"), icon: BookOpen, count: learnsCount },
    { id: "sources", label: t("sources"), icon: FileText, count: sourcesCount },
    { id: "collections", label: t("collections"), icon: Folder, count: collectionsCount },
    { id: "artifacts", label: t("artifacts"), icon: Layers, count: artifactsCount },
    { id: "models", label: t("models") || "Models", icon: Bot },
    { id: "mcp", label: t("mcpTools") || "MCP Tools", icon: Server },
  ];

  const isMac =
    typeof window !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  return (
    <aside className="w-64 h-full flex flex-col justify-between shrink-0 select-none bg-transparent text-foreground p-3">
      {/* Top Section */}
      <div className="flex flex-col gap-3">
        {/* Brand Header & Sidebar Close Icon */}
        <div className="flex items-center justify-between h-9 px-1">
          {/* Logo & Const Learn text */}
          <div className="flex items-center gap-2">
            <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-base font-normal tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Learn
              </span>
            </div>
          </div>

          {/* Close Sidebar Icon Button */}
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={t("closeSidebarKeyboard")}
            aria-label={t("closeSidebar")}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Action: Create New Notebook Button (Kimi Reference Style) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onCreateNewLearn}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/80 hover:bg-secondary border border-border/60 hover:border-border text-foreground font-medium text-xs transition-all cursor-pointer shadow-2xs group active:scale-[0.99]"
            title={`${t("newLearn")} (${isMac ? "⌘K" : "Ctrl+K"})`}
          >
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors stroke-[1.8]" />
              <span className="font-medium text-foreground/90 group-hover:text-foreground">
                {t("newLearn")}
              </span>
            </div>
            <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground font-sans transition-colors select-none tracking-tight">
              {isMac ? "⌘K" : "Ctrl+K"}
            </span>
          </button>
        </div>

        {/* Navigation Items (Learns, Sources, Collections, Artifact) */}
        <nav className="flex flex-col gap-0.5 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-background text-foreground font-medium shadow-xs"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {typeof item.count === "number" && item.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: User Profile Menu (Zero dividing lines per DESIGN.md) */}
      <div className="pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2.5 p-1.5 rounded-xl hover:bg-muted transition-colors text-left outline-none cursor-pointer group"
              aria-label="Account menu"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-7 w-7 rounded-full border border-border shrink-0">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={user.name || "Avatar"} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-foreground font-sans text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {user?.name || "Const User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {user?.email || "Workspace"}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-52 p-1.5 mb-1 bg-popover border border-border text-popover-foreground rounded-2xl shadow-xl select-none text-xs"
          >
            {/* 1. Settings */}
            <DropdownMenuItem
              onClick={onOpenSettings}
              className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground"
            >
              <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{t("settings")}</span>
            </DropdownMenuItem>

            {/* 2. App theme (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground">
                <Sun className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{t("theme")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[140px] p-1.5 rounded-xl bg-popover border border-border text-popover-foreground shadow-xl text-xs">
                {[
                  { value: "system", label: t("themeSystem"), icon: Laptop },
                  { value: "light", label: t("themeLight"), icon: Sun },
                  { value: "dark", label: t("themeDark"), icon: Moon },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.value}
                      onClick={() => setTheme(item.value as any)}
                      className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-secondary text-popover-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </div>
                      {theme === item.value && (
                        <Check className="w-3.5 h-3.5 text-foreground ml-2 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* 3. Language (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{t("language")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[160px] p-1.5 rounded-xl bg-popover border border-border text-popover-foreground shadow-xl text-xs">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-secondary text-popover-foreground"
                  >
                    <span>{lang.label}</span>
                    {language === lang.code && (
                      <Check className="w-3.5 h-3.5 text-foreground ml-2 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="my-1 bg-border" />

            {/* 4. Switch account */}
            {onSwitchAccount && (
              <DropdownMenuItem
                onClick={onSwitchAccount}
                className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground"
              >
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{t("switchAccount")}</span>
              </DropdownMenuItem>
            )}

            {/* 5. Log out */}
            {onSignOut && (
              <DropdownMenuItem
                onClick={onSignOut}
                className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-red-500/10 dark:hover:bg-red-500/10 focus:bg-red-500/10 text-rose-600 dark:text-rose-400"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{t("logout")}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
