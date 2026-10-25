/** Best-effort public skills.sh catalog adapter. Kept separate from installation. */
export interface SkillsShItem {
  id: string;
  source: string;
  skillId: string;
  name: string;
  installs: number;
  isOfficial?: boolean;
  description?: string;
}

export async function fetchSkillsCatalog(
  query = "",
  signal?: AbortSignal,
): Promise<SkillsShItem[]> {
  const clean = query.trim();
  if (clean.length === 1) return [];
  // These are the public website endpoints; the authenticated v1 API has a
  // different schema. Keep all compatibility handling within this adapter.
  const url =
    clean.length >= 2
      ? "https://skills.sh/api/search?q=" +
        encodeURIComponent(clean) +
        "&limit=40"
      : "https://skills.sh/api/skills/all-time/0";
  const response = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("catalogUnavailable");
  const data = (await response.json()) as { skills?: unknown[] };
  if (!Array.isArray(data.skills)) throw new Error("catalogUnavailable");
  const seen = new Set<string>();
  return data.skills
    .flatMap((raw): SkillsShItem[] => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      if (
        typeof item.source !== "string" ||
        !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(item.source) ||
        typeof item.skillId !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.skillId)
      )
        return [];
      const id = (item.source + "/" + item.skillId).toLowerCase();
      if (seen.has(id)) return [];
      seen.add(id);
      return [
        {
          id,
          source: item.source,
          skillId: item.skillId,
          name: typeof item.name === "string" ? item.name : item.skillId,
          installs: typeof item.installs === "number" ? item.installs : 0,
          description:
            typeof item.description === "string" ? item.description : undefined,
          isOfficial: item.isOfficial === true,
        },
      ];
    })
    .slice(0, 40);
}

export function searchSkillsSh(
  query: string,
  signal?: AbortSignal,
): Promise<SkillsShItem[]> {
  if (window.electron?.marketplace?.searchSkills)
    return window.electron.marketplace.searchSkills(query);
  return fetchSkillsCatalog(query, signal);
}
