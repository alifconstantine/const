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
  PanelLeftClose,
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
  ChevronDown,
  Globe,
} from "lucide-react";
import { getUserInitials, type UserProfile } from "../navbar";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";

export type HomeNavTab = "learns" | "sources" | "collections" | "artifacts";

interface SidebarProps {
  activeTab: HomeNavTab;
  onSelectTab: (tab: HomeNavTab) => void;
  onCollapse: () => void;
  onCreateNewLearn: () => void;
  onCreateNewCollection: () => void;
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
  ];

  return (
    <aside className="w-56 h-full flex flex-col justify-between shrink-0 select-none bg-[#ececee] dark:bg-[#2b2b2b] text-[#262626] dark:text-[#d4d4d4] p-3">
      {/* Top Section */}
      <div className="flex flex-col gap-3">
        {/* Brand Header & Sidebar Close Icon */}
        <div
          className="flex items-center justify-between h-9 px-1"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* Logo & Const Learn text */}
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <ConstLogoIcon size="sm" className="w-5 h-5 text-[#262626] dark:text-white shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-base font-normal tracking-tight text-[#262626] dark:text-white">
                Const
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#dedee2] dark:bg-[#383838] text-[#5d5d5d] dark:text-[#969696]">
                Learn
              </span>
            </div>
          </div>

          {/* Close Sidebar Icon Button */}
          <button
            type="button"
            onClick={onCollapse}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="p-1.5 rounded-lg hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
            title={t("closeSidebarKeyboard")}
            aria-label={t("closeSidebar")}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action: Create New Dropdown */}
        <div className="pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#262626] dark:bg-white text-white dark:text-black font-medium text-xs hover:bg-black dark:hover:bg-zinc-200 transition-all cursor-pointer shadow-none"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{t("createNew")}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="w-48 p-1.5 bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] rounded-xl shadow-xl z-50 text-xs"
            >
              <DropdownMenuItem
                onClick={onCreateNewLearn}
                className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e]"
              >
                <BookOpen className="w-4 h-4 text-[#0066ff]" />
                <span>{t("newLearn")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onCreateNewCollection}
                className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e]"
              >
                <FolderPlus className="w-4 h-4 text-[#0066ff]" />
                <span>{t("newCollection")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                    ? "bg-[#dedee2] dark:bg-[#383838] text-[#111111] dark:text-white font-medium"
                    : "text-[#262626] dark:text-[#d4d4d4] hover:bg-[#dedee2]/60 dark:hover:bg-[#383838]/60 hover:text-black dark:hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive
                        ? "text-[#111111] dark:text-white"
                        : "text-[#737373] dark:text-[#969696]"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {typeof item.count === "number" && item.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                      isActive
                        ? "bg-white/40 dark:bg-black/40 text-black dark:text-white"
                        : "text-[#8a8a8a] dark:text-[#777777]"
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
              className="w-full flex items-center justify-between gap-2.5 p-1.5 rounded-xl hover:bg-[#dedee2] dark:hover:bg-[#383838] transition-colors text-left outline-none cursor-pointer group"
              aria-label="Account menu"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-7 w-7 rounded-full border border-[#d5d5d9] dark:border-[#383838] shrink-0">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={user.name || "Avatar"} />
                  ) : null}
                  <AvatarFallback className="bg-[#dedee2] dark:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] font-sans text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#262626] dark:text-[#d4d4d4] truncate">
                    {user?.name || "Const User"}
                  </p>
                  <p className="text-[10px] text-[#8a8a8a] dark:text-[#969696] truncate">
                    {user?.email || "Workspace"}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-[#8a8a8a] dark:text-[#969696] group-hover:text-black dark:group-hover:text-white shrink-0" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-52 p-1.5 mb-1 bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] rounded-2xl shadow-xl select-none text-xs"
          >
            {/* 1. Settings */}
            <DropdownMenuItem
              onClick={onOpenSettings}
              className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white"
            >
              <Settings className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
              <span>{t("settings")}</span>
            </DropdownMenuItem>

            {/* 2. App theme (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white">
                <Sun className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
                <span>{t("theme")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[140px] p-1.5 rounded-xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] shadow-xl text-xs">
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
                      className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] text-[#262626] dark:text-[#d4d4d4]"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </div>
                      {theme === item.value && (
                        <Check className="w-3.5 h-3.5 text-[#111111] dark:text-white ml-2 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* 3. Language (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white">
                <Globe className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
                <span>{t("language")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[160px] p-1.5 rounded-xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] shadow-xl text-xs">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] text-[#262626] dark:text-[#d4d4d4]"
                  >
                    <span>{lang.label}</span>
                    {language === lang.code && (
                      <Check className="w-3.5 h-3.5 text-[#111111] dark:text-white ml-2 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="my-1 bg-[#dedee2] dark:bg-[#333333]" />

            {/* 4. Switch account */}
            {onSwitchAccount && (
              <DropdownMenuItem
                onClick={onSwitchAccount}
                className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white"
              >
                <ArrowLeftRight className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
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
