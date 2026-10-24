import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { loadInstalledSkills } from "./skills-service";
import type { LocalSkill } from "./types";

export function useResolvedSkills(workspacePath?: string): LocalSkill[] {
  const [snapshot, setSnapshot] = useState<{ workspacePath?: string; skills: LocalSkill[] }>();
  const [revision, setRevision] = useState(0);
  const drafts = useLiveQuery(
    () =>
      db.skills
        .filter(
          (skill) =>
            !skill.path &&
            skill.id !== `skill_${skill.slug}` &&
            (skill.scope !== "workspace" ||
              (!!workspacePath && skill.workspacePath === workspacePath)),
        )
        .toArray(),
    [workspacePath],
    [],
  );
  useEffect(() => {
    let cancelled = false;
    loadInstalledSkills(workspacePath)
      .then((skills) => {
        if (!cancelled) setSnapshot({ workspacePath, skills });
      })
      .catch((error) => {
        if (!cancelled) setSnapshot({ workspacePath, skills: [] });
        console.warn("[Skills] Discovery failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath, revision]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const unsubscribe = window.electron?.marketplace?.onChanged(refresh);
    return unsubscribe;
  }, []);
  return useMemo(() => [...(snapshot?.workspacePath === workspacePath ? snapshot?.skills ?? [] : []), ...drafts], [snapshot, workspacePath, drafts]);
}
