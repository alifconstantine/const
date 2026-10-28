import React, { useState, useRef, useEffect } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  toast,
  cn,
} from "@const/ui";
import {
  Camera,
  Pencil,
  Check,
  X,
  Copy,
  Mail,
  ShieldCheck,
  Upload,
  Trash2,
  Sparkles,
  ArrowLeftRight,
  LogOut,
  Laptop,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useTranslation } from "../../lib/i18n";
import type { UserProfile } from "../sidebar";
import { getUserInitials } from "../sidebar";
import { WeeklyQuotaCard, type WeeklyQuota } from "./weekly-quota-card";

export interface ProfileSettingsProps {
  user?: UserProfile | null;
  quota?: WeeklyQuota | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

export const AVATAR_PRESETS = [
  {
    id: "cosmic",
    name: "Cosmic Indigo",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%23a855f7"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g1)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "emerald",
    name: "Emerald Spark",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23059669"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g2)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "solar",
    name: "Solar Sunset",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f97316"/><stop offset="100%" stop-color="%23ec4899"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g3)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "cyber",
    name: "Neon Cyber",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2306b6d4"/><stop offset="100%" stop-color="%233b82f6"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g4)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "amber",
    name: "Mystic Pulse",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23ef4444"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g5)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "obsidian",
    name: "Obsidian Core",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g6)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
];

export function ProfileSettings({
  user,
  quota,
  onSignOut,
  onSwitchAccount,
}: ProfileSettingsProps) {
  const { t } = useTranslation();
  const updateProfileMutation = useMutation(api.users.updateProfile);

  // Username Editing State
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState<string>(
    user?.name || "Const User"
  );

  // Avatar Picker State
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Copied State Feedback
  const [isCopied, setIsCopied] = useState(false);

  // Sync draft when user.name updates outside
  useEffect(() => {
    if (!isEditingUsername && user?.name) {
      setUsernameDraft(user.name);
    }
  }, [user?.name, isEditingUsername]);

  const initials = getUserInitials(user?.name, user?.email);

  const handleSaveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (!trimmed) {
      toast.error("Username cannot be empty");
      return;
    }
    try {
      const existingRaw = localStorage.getItem("const_custom_user_profile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const updated = { ...existing, name: trimmed };
      localStorage.setItem("const_custom_user_profile", JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent("const:user-profile-updated", { detail: updated })
      );

      try {
        await updateProfileMutation({ name: trimmed });
      } catch {
        // Fallback for offline / local-only mode
      }

      setIsEditingUsername(false);
      toast.success("Username updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update username");
    }
  };

  const handleSelectAvatarPreset = async (avatarUrl: string) => {
    try {
      const existingRaw = localStorage.getItem("const_custom_user_profile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const updated = { ...existing, image: avatarUrl };
      localStorage.setItem("const_custom_user_profile", JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent("const:user-profile-updated", { detail: updated })
      );

      try {
        await updateProfileMutation({ image: avatarUrl });
      } catch {
        // Fallback for offline / local-only mode
      }

      setIsAvatarPickerOpen(false);
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update avatar");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await handleSelectAvatarPreset(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      const existingRaw = localStorage.getItem("const_custom_user_profile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      delete existing.image;
      if (Object.keys(existing).length > 0) {
        localStorage.setItem("const_custom_user_profile", JSON.stringify(existing));
      } else {
        localStorage.removeItem("const_custom_user_profile");
      }
      window.dispatchEvent(
        new CustomEvent("const:user-profile-updated", { detail: existing })
      );

      try {
        await updateProfileMutation({ image: "" });
      } catch {
        // Fallback
      }

      setIsAvatarPickerOpen(false);
      toast.success("Avatar removed (initials restored)");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove avatar");
    }
  };

  const handleCopyId = () => {
    const textToCopy = user?.id || user?.email || "local-user-session";
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success(t("settings.accountIdCopied"));
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl pb-6">
      {/* 1. Primary Identity Card */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1a1a] p-5 sm:p-6 flex flex-col gap-6 shadow-xs transition-colors">
        {/* Top Profile Header: Avatar + Identity Info + Change Avatar Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            {/* Interactive Avatar */}
            <div className="relative group shrink-0">
              <Avatar className="h-[68px] w-[68px] rounded-full bg-neutral-100 dark:bg-[#252525] ring-2 ring-neutral-200 dark:ring-[#333333] shadow-xs overflow-hidden transition-transform group-hover:scale-[1.02]">
                {user?.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={user?.name || "User"}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <AvatarFallback className="text-lg font-semibold text-neutral-800 dark:text-white bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-[#333333] dark:to-[#222222]">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Hover Camera Overlay Button */}
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen((v) => !v)}
                className="absolute inset-0 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-[1px] outline-none"
                title={t("settings.changeAvatar")}
              >
                <Camera className="w-5 h-5 text-white" />
                <span className="text-[11px] font-medium mt-0.5 tracking-tight">
                  {t("settings.editAvatar")}
                </span>
              </button>
            </div>

            {/* User Meta Information */}
            <div className="min-w-0 flex flex-col gap-1">
              {/* Display or Edit Username */}
              <div className="flex items-center gap-2">
                {isEditingUsername ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveUsername();
                        if (e.key === "Escape") {
                          setUsernameDraft(user?.name || "Const User");
                          setIsEditingUsername(false);
                        }
                      }}
                      autoFocus
                      placeholder={t("settings.enterUsername")}
                      className="px-3 py-1 text-sm font-semibold rounded-lg border border-blue-500 bg-white dark:bg-[#141414] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44 sm:w-56 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleSaveUsername}
                      className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer shadow-xs"
                      title={t("settings.saveUsername")}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsernameDraft(user?.name || "Const User");
                        setIsEditingUsername(false);
                      }}
                      className="p-1.5 rounded-lg bg-neutral-100 dark:bg-[#282828] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[#333333] transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/name">
                    <span className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight truncate">
                      {user?.name || "Const User"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUsernameDraft(user?.name || "Const User");
                        setIsEditingUsername(true);
                      }}
                      className="opacity-50 hover:opacity-100 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#282828] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer"
                      title={t("settings.editUsername")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Email & Status Badge */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                  <span className="truncate max-w-[220px]">
                    {user?.email || t("settings.noEmailLinked")}
                  </span>
                </div>

                {user?.email ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-[#262626] text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-[#333333]">
                    <Laptop className="w-3 h-3" />
                    {t("settings.offlineMode")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Change Avatar Button */}
          <button
            type="button"
            onClick={() => setIsAvatarPickerOpen((v) => !v)}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-neutral-200/80 dark:border-[#333333] bg-neutral-50 dark:bg-[#222222] hover:bg-neutral-100 dark:hover:bg-[#2a2a2a] text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer flex items-center gap-2 self-start sm:self-auto outline-none"
          >
            <Camera className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span>{t("settings.changeAvatar")}</span>
          </button>
        </div>

        {/* Expandable Avatar Picker Drawer */}
        {isAvatarPickerOpen && (
          <div className="p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-[#2e2e2e] bg-neutral-50/70 dark:bg-[#141414] flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                {t("settings.chooseAvatarOrUpload")}
              </span>
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                title="Close avatar picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar Presets Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t("settings.avatarPresets")}
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectAvatarPreset(preset.svg)}
                    className="group/preset relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-neutral-200/70 dark:border-[#282828] hover:border-blue-500/60 bg-white dark:bg-[#1e1e1e] hover:bg-neutral-50 dark:hover:bg-[#252525] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                  >
                    <img
                      src={preset.svg}
                      alt={preset.name}
                      className="w-10 h-10 rounded-full border border-black/5 dark:border-white/10 group-hover/preset:scale-105 transition-transform"
                    />
                    <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-full text-center">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Upload and Remove Row */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-200/70 dark:border-[#282828]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-neutral-200/80 dark:border-[#333333] bg-white dark:bg-[#222222] hover:bg-neutral-50 dark:hover:bg-[#2a2a2a] text-neutral-900 dark:text-white transition-colors cursor-pointer flex items-center gap-2 shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                <span>{t("settings.uploadCustomImage")}</span>
              </button>

              {user?.image && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t("settings.removeAvatar")}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Account Metadata Row: Account ID with One-Click Copy */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-[#151515] border border-neutral-200/60 dark:border-[#262626]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {t("settings.accountIdentifier")}
            </span>
            <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200 truncate select-all">
              {user?.id || user?.email || "local-user-session"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyId}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-[#333333] bg-white dark:bg-[#222222] hover:bg-neutral-50 dark:hover:bg-[#2a2a2a] text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t("settings.copyId")}</span>
              </>
            )}
          </button>
        </div>

        {/* Account Switching & Sign Out Actions */}
        {(onSwitchAccount || onSignOut) && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-200/60 dark:border-[#262626]">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Session & Account Security
            </span>

            <div className="flex items-center gap-2.5">
              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-neutral-200/80 dark:border-[#333333] bg-white dark:bg-[#222222] hover:bg-neutral-50 dark:hover:bg-[#2a2a2a] text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer flex items-center gap-2 shadow-2xs outline-none"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{t("sidebar.switchAccount")}</span>
                </button>
              )}

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-2 outline-none"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t("sidebar.signOut")}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Weekly Quota & Compute Allocation Card */}
      <WeeklyQuotaCard quota={quota} />
    </div>
  );
}
