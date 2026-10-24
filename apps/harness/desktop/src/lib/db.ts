import Dexie, { type EntityTable } from "dexie";
export type { LocalSkill, LocalSkillBundle, SkillCategory, SkillFileEntry, SkillFrontmatter } from "./skills/types";
import type { LocalSkill, LocalSkillBundle } from "./skills/types";
import { loadConversations } from "./conversation-store";

export interface LocalRequestLog {
  id: string;
  requestId: string;
  model: string;
  provider?: string;
  conversationId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: number;
  toolNames?: string[];
  createdAt: number;
}

export const db = new Dexie("ConstHarnessDatabase") as Dexie & {
  skills: EntityTable<LocalSkill, "id">;
  skillBundles: EntityTable<LocalSkillBundle, "id">;
  requestLogs: EntityTable<LocalRequestLog, "id">;
};

db.version(1).stores({
  skills: "id, slug, name, category, isBuiltIn, isEnabled, scope, bundleId, createdAt",
  skillBundles: "id, slug, name, category, isBuiltIn, isEnabled, scope, createdAt",
});

db.version(2).stores({
  skills: "id, slug, name, category, isBuiltIn, isEnabled, scope, bundleId, createdAt",
  skillBundles: "id, slug, name, category, isBuiltIn, isEnabled, scope, createdAt",
  requestLogs: "id, requestId, model, conversationId, createdAt, totalTokens",
});

export const localDb = {
  async toggleSkill(id: string, isEnabled: boolean): Promise<void> {
    await db.skills.update(id, { isEnabled, updatedAt: Date.now() });
  },

  // Request Logs & Token Activity (Local-First Engine)
  async recordRequestLog(data: Omit<LocalRequestLog, "id">): Promise<string> {
    const id = "req_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    await db.requestLogs.add({
      ...data,
      id,
    });
    return id;
  },

  async getRequestLogs(since?: number): Promise<LocalRequestLog[]> {
    try {
      if (typeof since === "number") {
        return await db.requestLogs.where("createdAt").aboveOrEqual(since).reverse().sortBy("createdAt");
      }
      return await db.requestLogs.reverse().sortBy("createdAt");
    } catch {
      return [];
    }
  },

  async syncLogsFromConversations(): Promise<number> {
    try {
      const convos = loadConversations();
      if (!Array.isArray(convos) || convos.length === 0) return 0;
      const count = await db.requestLogs.count();
      if (count > 0) return count;

      const entries: LocalRequestLog[] = [];
      for (const c of convos) {
        const tokens = c.contextUsage?.usedTokens || 0;
        if (tokens > 0) {
          const prompt = c.contextUsage?.messagesTokens || Math.round(tokens * 0.7);
          const completion = tokens - prompt;
          entries.push({
            id: `req_convo_${c.id}`,
            requestId: `req_${c.id}`,
            model: c.model || "agy/gemini-3.8-flash-tiered",
            conversationId: c.id,
            promptTokens: prompt,
            completionTokens: completion,
            totalTokens: tokens,
            durationMs: 1200,
            status: 200,
            createdAt: c.updatedAt || c.createdAt || Date.now(),
          });
        }
      }

      if (entries.length > 0) {
        await db.requestLogs.bulkPut(entries);
      }
      return entries.length;
    } catch {
      return 0;
    }
  },
};
