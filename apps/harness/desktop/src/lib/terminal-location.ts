import type { RightPaneTab } from "../components/right-pane/types";

export function terminalFolderTitle(cwd: string | undefined, project: string | undefined): string {
  const leaf = (value: string | undefined) => value?.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  const folder = leaf(cwd);
  return folder && folder !== "project" ? folder : leaf(project === "Outside Project" ? undefined : project) || folder || "";
}

export function resolvedTerminalTitle(tab: RightPaneTab, cwd: string): string {
  const folder = terminalFolderTitle(cwd, tab.project);
  return folder ? folder + (tab.title.match(/ \(\d+\)$/)?.[0] || "") : tab.title;
}

/** A late create/resolve reply can update only the tab and conversation that requested it. */
export function updateTerminalLocation(tabs: RightPaneTab[], id: string, owner: string, cwd: string): RightPaneTab[] {
  let changed = false;
  const next = tabs.map(tab => {
    if (tab.id !== id || tab.conversationId !== owner || tab.type !== "terminal") return tab;
    const title = resolvedTerminalTitle(tab, cwd);
    if (tab.cwd === cwd && tab.title === title) return tab;
    changed = true;
    return { ...tab, cwd, title };
  });
  return changed ? next : tabs;
}
