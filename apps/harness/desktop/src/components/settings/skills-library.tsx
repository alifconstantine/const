import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Switch,
  cn,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@const/ui";
import {
  ArrowUpRight,
  Check,
  Download,
  FolderOpen,
  Globe2,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import {
  searchSkillsSh,
  type SkillsShItem,
} from "../../lib/skills/skills-sh-service";
import type { LocalSkill } from "../../lib/skills/types";

export interface SkillsLibraryProps {
  skills: LocalSkill[];
  query: string;
  onQueryChange: (query: string) => void;
  scope: "user" | "workspace";
  onScopeChange: (scope: "user" | "workspace") => void;
  workspacePath?: string;
  installing: boolean;
  onInstall: (item: SkillsShItem) => void;
  onSelect: (item: SkillsShItem | LocalSkill) => void;
  onToggle: (skill: LocalSkill, enabled: boolean) => void;
  onUninstall: (skill: LocalSkill) => void;
}

export function SkillsLibrary({
  skills,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  workspacePath,
  installing,
  onInstall,
  onSelect,
  onToggle,
  onUninstall,
}: SkillsLibraryProps) {
  const { t, language } = useI18n();
  const [tab, setTab] = useState<"discover" | "installed">("discover");
  const [items, setItems] = useState<SkillsShItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const clean = query.trim();
  useEffect(() => {
    if (tab !== "discover") return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setItems([]);
    const timer = setTimeout(
      () => {
        searchSkillsSh(clean, controller.signal)
          .then((results) => {
            if (!controller.signal.aborted) setItems(results);
          })
          .catch(() => {
            if (!controller.signal.aborted) setFailed(true);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      clean ? 300 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [clean, tab, retry]);

  const filtered = skills.filter((skill) =>
    `${skill.name} ${skill.slug} ${skill.description} ${skill.source ?? ""}`
      .toLowerCase()
      .includes(clean.toLowerCase()),
  );
  const installedFor = (item: SkillsShItem) =>
    skills.find((skill) => skill.sourceId === item.id && skill.scope === scope);
  const noWorkspace = !workspacePath || workspacePath === "Outside Project";
  return (
    <section className="space-y-5">
      <div
        className="flex gap-1 rounded-xl bg-[#222222] p-1 w-fit"
        role="tablist"
        aria-label={t("marketplace.tabSkills")}
      >
        {(["discover", "installed"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              if (value === tab) return;
              onQueryChange("");
              setTab(value);
            }}
            className={cn(
              "rounded-lg px-4 py-2 text-sm transition-colors",
              tab === value
                ? "bg-[#383838] text-white"
                : "text-[#969696] hover:text-white",
            )}
          >
            {t(
              value === "discover"
                ? "marketplace.discover"
                : "marketplace.installedSection",
            )}
            {value === "installed" && (
              <span className="ml-2 text-[#969696] tabular-nums">
                {skills.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#969696] pointer-events-none" />
        <Input
          aria-label={t("marketplace.searchByName")}
          placeholder={t("marketplace.searchByName")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-12 w-full pl-11 pr-4 rounded-xl bg-[#2b2b2b] border-0 text-sm text-white placeholder:text-[#969696] shadow-none"
        />
      </div>
      {tab === "discover" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#969696]">
            {clean
              ? t("marketplace.searchResults")
              : t("marketplace.popularSkills")}
          </p>
          <div className="flex items-center gap-3">
            <span
              id="skill-install-scope-label"
              className="text-xs text-[#969696]"
            >
              {t("marketplace.installTo")}
            </span>
            <Select
              value={scope}
              onValueChange={(value) =>
                onScopeChange(value as "user" | "workspace")
              }
              disabled={installing}
            >
              <SelectTrigger
                aria-labelledby="skill-install-scope-label"
                className="h-9 w-auto min-w-44 gap-3 rounded-xl border-0 bg-[#2b2b2b] px-3 text-xs text-white shadow-none hover:bg-[#383838] focus:ring-0 focus-visible:outline-none"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {scope === "user" ? (
                    <Globe2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-[#969696]"
                    />
                  ) : (
                    <FolderOpen
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-[#969696]"
                    />
                  )}
                  <SelectValue>
                    {t(
                      scope === "user"
                        ? "marketplace.scopeAllProjects"
                        : "marketplace.scopeThisProject",
                    )}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent
                align="end"
                sideOffset={6}
                className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-0 bg-[#222222] p-1 text-white shadow-xl"
              >
                <SelectItem
                  value="user"
                  textValue={t("marketplace.scopeAllProjects")}
                  className="cursor-pointer rounded-xl py-3 pl-3 pr-9 focus:bg-[#383838] focus:text-white"
                >
                  <span className="flex items-start gap-3">
                    <Globe2
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#969696]"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-xs font-medium">
                        {t("marketplace.scopeAllProjects")}
                      </span>
                      <span className="text-xs leading-relaxed text-[#969696]">
                        {t("marketplace.scopeAllProjectsHint")}
                      </span>
                    </span>
                  </span>
                </SelectItem>
                <SelectItem
                  value="workspace"
                  textValue={t("marketplace.scopeThisProject")}
                  disabled={noWorkspace}
                  className="cursor-pointer rounded-xl py-3 pl-3 pr-9 focus:bg-[#383838] focus:text-white"
                >
                  <span className="flex items-start gap-3">
                    <FolderOpen
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#969696]"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-xs font-medium">
                        {t("marketplace.scopeThisProject")}
                      </span>
                      <span className="text-xs leading-relaxed text-[#969696]">
                        {t(
                          noWorkspace
                            ? "marketplace.scopeChooseProjectHint"
                            : "marketplace.scopeThisProjectHint",
                        )}
                      </span>
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {tab === "discover" &&
        (loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 py-16 text-sm text-[#969696]"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("marketplace.searchingSkills")}
          </div>
        ) : failed ? (
          <div role="alert" className="rounded-2xl bg-[#222222] p-8 space-y-3">
            <p className="text-sm text-white">
              {t("marketplace.catalogUnavailable")}
            </p>
            <p className="text-xs text-[#969696]">
              {t("marketplace.catalogRetryHint")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("marketplace.retry")}
            </Button>
          </div>
        ) : !items.length ? (
          <div className="py-14 text-center space-y-2">
            <p className="text-sm text-white">
              {t("marketplace.noAvailableTitle")}
            </p>
            <p className="text-xs text-[#969696]">
              {t(
                clean.length === 1
                  ? "marketplace.minimumQuery"
                  : "marketplace.noAvailableDesc",
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {items.map((item) => {
              const installed = installedFor(item);
              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-[#222222] p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelect(installed ?? item)}
                        className="text-left text-sm font-medium text-white hover:underline underline-offset-4 break-words"
                      >
                        {item.name}
                      </button>
                      <p className="mt-1 text-xs text-[#969696] break-all">
                        {item.source}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={installed ? "secondary" : "default"}
                      disabled={
                        installing || (scope === "workspace" && noWorkspace)
                      }
                      onClick={() =>
                        installed ? onSelect(installed) : onInstall(item)
                      }
                      className="shrink-0 h-8 text-xs gap-1.5 rounded-lg"
                    >
                      {installed ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {t(
                        installed
                          ? "marketplace.installedSection"
                          : "marketplace.install",
                      )}
                    </Button>
                  </div>
                  {item.description && (
                    <p className="text-xs leading-relaxed text-[#d4d4d4] line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 text-xs text-[#969696]">
                    <span>
                      {t("marketplace.installCount", {
                        count: item.installs.toLocaleString(language),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelect(installed ?? item)}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      {t("marketplace.viewInstructions")}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      {tab === "installed" &&
        (filtered.length ? (
          <div className="space-y-2">
            {filtered.map((skill) => (
              <article
                key={skill.id}
                className="flex items-center gap-4 rounded-xl bg-[#222222] p-4"
              >
                <button
                  type="button"
                  onClick={() => onSelect(skill)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="text-sm font-medium text-white">
                    {skill.name}
                  </span>
                  <span className="ml-2 text-xs text-[#969696]">
                    /{skill.slug}
                  </span>
                  <p className="mt-1 text-xs text-[#969696] truncate">
                    {skill.source ?? skill.description}
                  </p>
                  <span className="mt-2 inline-block text-xs text-[#969696]">
                    {t(
                      skill.scope === "workspace"
                        ? "marketplace.workspaceScope"
                        : "marketplace.globalScope",
                    )}
                  </span>
                </button>
                <Switch
                  aria-label={t("marketplace.enableSkill", {
                    name: skill.name,
                  })}
                  checked={skill.isEnabled}
                  onCheckedChange={(value) => onToggle(skill, value)}
                />
                <button
                  type="button"
                  aria-label={t("marketplace.uninstall") + " " + skill.name}
                  onClick={() => onUninstall(skill)}
                  className="p-2 rounded-lg text-[#969696] hover:text-white hover:bg-[#383838]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center space-y-2">
            <p className="text-sm text-white">
              {t(
                clean
                  ? "marketplace.noAvailableTitle"
                  : "marketplace.noInstalledTitle",
              )}
            </p>
            <p className="text-xs text-[#969696]">
              {t(
                clean
                  ? "marketplace.noAvailableDesc"
                  : "marketplace.discoverHint",
              )}
            </p>
          </div>
        ))}
    </section>
  );
}
