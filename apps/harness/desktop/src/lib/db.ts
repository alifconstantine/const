import type { ModelRequest } from "./chat-telemetry";
import Dexie, { type EntityTable } from "dexie";
export type { LocalSkill, LocalSkillBundle, SkillCategory, SkillFileEntry, SkillFrontmatter } from "./skills/types";
import type { LocalSkill, LocalSkillBundle } from "./skills/types";
import { loadConversations } from "./conversation-store";
import { modelRequestToLog, type LocalRequestLog } from "./usage-logs";
export type { LocalRequestLog } from "./usage-logs";

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

  async recordModelRequest(conversationId: string, request: ModelRequest): Promise<void> {
    const log = modelRequestToLog(conversationId, request);
    if (log) await db.requestLogs.put(log);
  },

  async getRequestLogs(since?: number): Promise<LocalRequestLog[]> {
    try {
      if (typeof since === "number") {
        return (await db.requestLogs.where("createdAt").aboveOrEqual(since).reverse().sortBy("createdAt")).filter(isModelRequestLog);
      }
      return (await db.requestLogs.reverse().sortBy("createdAt")).filter(isModelRequestLog);
    } catch {
      return [];
    }
  },

  async syncLogsFromConversations(): Promise<number> {
    try {
      const convos = loadConversations();
      if (!Array.isArray(convos) || convos.length === 0) return 0;
      let count = 0;
      for (const conversation of convos) {
        for (const request of Object.values(conversation.telemetry?.requests ?? {})) {
          if (request.totalTokens === undefined) continue;
          await localDb.recordModelRequest(conversation.id, request);
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  },
};

/** Historical tool estimates and context-derived backfills are not provider usage. */
export function isModelRequestLog(log: LocalRequestLog): boolean {
  return !log.requestId.startsWith("tool_") && !log.id.startsWith("req_convo_") &&
    !(log.toolNames && log.toolNames.length > 0);
}
