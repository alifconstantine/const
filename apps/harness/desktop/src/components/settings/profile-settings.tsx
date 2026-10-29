import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Avatar, AvatarImage, AvatarFallback, toast } from "@const/ui";
import {
  Check,
  Copy,
  Pencil,
  Upload,
  X,
  ArrowLeftRight,
  LogOut,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useTranslation } from "../../lib/i18n";
import type { UserProfile } from "../sidebar";
import { getUserInitials } from "../sidebar";
import { WeeklyQuotaCard, type WeeklyQuota } from "./weekly-quota-card";
import { AvatarCropEditor, type AvatarSource } from "./avatar-crop-editor";
import {
  SettingsRow,
  SettingsSection,
  settingsButton,
  settingsInput,
} from "./settings-controls";

export interface ProfileSettingsProps {
  user?: UserProfile | null;
  quota?: WeeklyQuota | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

export function ProfileSettings({
  user,
  quota,
  onSignOut,
  onSwitchAccount,
}: ProfileSettingsProps) {
  const { t } = useTranslation();
  const updateProfile = useMutation(api.users.updateProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user?.name || "");
  const [override, setOverride] = useState<{ name?: string; image?: string }>(
    {},
  );
  const [source, setSource] = useState<AvatarSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const wasCropping = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const name = override.name ?? user?.name ?? t("settings.defaultUserName");
  const image = override.image ?? user?.image;

  useEffect(() => {
    if (source) wasCropping.current = true;
    else if (wasCropping.current) {
      uploadButton.current?.focus();
      wasCropping.current = false;
    }
  }, [source]);
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);
  useEffect(
    () => () => {
      uploadVersion.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );

  // Keep the local profile usable offline; the account sync is best effort.
  const persist = async (patch: { name?: string; image?: string }) => {
    const raw = localStorage.getItem("const_custom_user_profile");
    const stored = raw ? JSON.parse(raw) : {};
    const next = { ...stored, ...patch };
    localStorage.setItem("const_custom_user_profile", JSON.stringify(next));
    setOverride((previous) => ({ ...previous, ...patch }));
    window.dispatchEvent(
      new CustomEvent("const:user-profile-updated", { detail: next }),
    );
    try {
      await updateProfile(patch);
    } catch {
      /* Local changes remain available offline. */
    }
  };

  const saveName = async () => {
    if (busy) return;
    const value = draft.trim();
    if (!value) {
      toast.error(t("settings.usernameRequired"));
      return;
    }
    setBusy(true);
    try {
      await persist({ name: value });
      setEditing(false);
      toast.success(t("settings.profileSaved"));
    } catch {
      toast.error(t("settings.profileSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      toast.error(t("settings.avatarInvalidType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("settings.avatarTooLarge"));
      return;
    }
    const version = ++uploadVersion.current;
    const url = URL.createObjectURL(file);
    setReading(true);
    try {
      const decoded = new Image();
      decoded.src = url;
      await decoded.decode();
      if (
        !decoded.naturalWidth ||
        !decoded.naturalHeight ||
        decoded.naturalWidth * decoded.naturalHeight > 40_000_000
      )
        throw new Error("Invalid dimensions");
      if (version !== uploadVersion.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setSource({
        url,
        width: decoded.naturalWidth,
        height: decoded.naturalHeight,
      });
    } catch {
      URL.revokeObjectURL(url);
      if (version === uploadVersion.current)
        toast.error(t("settings.avatarReadFailed"));
    } finally {
      if (version === uploadVersion.current) setReading(false);
    }
  };

  const saveAvatar = async (value: string) => {
    setBusy(true);
    try {
      await persist({ image: value });
      setSource(null);
      toast.success(t("settings.profileSaved"));
    } catch {
      toast.error(t("settings.avatarSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-6">
      <div className="flex flex-wrap items-center gap-4 py-1">
        <Avatar className="size-16 shrink-0 bg-neutral-100 dark:bg-[#2b2b2b]">
          {image && (
            <AvatarImage src={image} alt={name} className="object-cover" />
          )}
          <AvatarFallback className="bg-neutral-100 text-xl font-medium text-neutral-700 dark:bg-[#2b2b2b] dark:text-[#d4d4d4]">
            {getUserInitials(name, user?.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2">
          <p className="truncate text-base font-medium text-neutral-900 dark:text-white">
            {name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              aria-label={t("settings.uploadCustomImage")}
              onChange={(event) => void upload(event)}
            />
            <button
              ref={uploadButton}
              type="button"
              className={settingsButton}
              disabled={busy || reading}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-3.5" />
              {t(reading ? "common.loading" : "settings.changeAvatar")}
            </button>
            {image && (
              <button
                type="button"
                disabled={busy}
                className="min-h-8 rounded-[8px] px-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-[#969696] dark:hover:text-white disabled:opacity-40"
                onClick={() => void saveAvatar("")}
              >
                {t("settings.removeAvatar")}
              </button>
            )}
          </div>
        </div>
      </div>
      {source && (
        <AvatarCropEditor
          key={source.url}
          source={source}
          busy={busy}
          onSave={saveAvatar}
          onCancel={() => setSource(null)}
        />
      )}
      <SettingsSection>
        <SettingsRow
          label={t("settings.displayName")}
          htmlFor={editing ? "profile-name" : undefined}
        >
          {editing ? (
            <form
              className="flex max-w-full items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void saveName();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setEditing(false);
                }
              }}
            >
              <input
                id="profile-name"
                autoFocus
                maxLength={80}
                disabled={busy}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={`${settingsInput} min-w-0 max-w-48`}
                placeholder={t("settings.enterUsername")}
              />
              <button
                type="submit"
                disabled={busy}
                className={settingsButton}
                aria-label={t("settings.saveUsername")}
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                className={settingsButton}
                onClick={() => setEditing(false)}
                aria-label={t("common.cancel")}
              >
                <X className="size-4" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={`${settingsButton} max-w-full`}
              onClick={() => setEditing(true)}
              aria-label={t("settings.editUsername")}
            >
              <span className="max-w-48 truncate">{name}</span>
              <Pencil className="size-3.5 shrink-0" />
            </button>
          )}
        </SettingsRow>
        <SettingsRow label={t("settings.emailAddress")}>
          <span className="block max-w-64 truncate text-[13px] text-neutral-500 dark:text-[#969696] select-text">
            {user?.email || t("settings.noEmailLinked")}
          </span>
        </SettingsRow>
        <SettingsRow label={t("settings.accountIdentifier")}>
          <button
            type="button"
            className={`${settingsButton} max-w-full`}
            title={t("settings.copyId")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  user?.id || user?.email || "local-user-session",
                );
                toast.success(t("settings.accountIdCopied"));
              } catch {
                toast.error(t("common.failedToCopy"));
              }
            }}
          >
            <span className="max-w-44 truncate font-normal">
              {user?.id || t("settings.offlineMode")}
            </span>
            <Copy className="size-3.5 shrink-0" />
          </button>
        </SettingsRow>
      </SettingsSection>
      <WeeklyQuotaCard quota={quota} />
      {(onSwitchAccount || onSignOut) && (
        <div className="flex flex-wrap gap-2">
          {onSwitchAccount && (
            <button
              type="button"
              className={settingsButton}
              onClick={onSwitchAccount}
            >
              <ArrowLeftRight className="size-3.5" />
              {t("sidebar.switchAccount")}
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              className={settingsButton}
              onClick={onSignOut}
            >
              <LogOut className="size-3.5" />
              {t("sidebar.signOut")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
