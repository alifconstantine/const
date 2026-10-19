import Dexie, { type EntityTable } from "dexie";
export type { LocalSkill, LocalSkillBundle, SkillCategory, SkillFileEntry, SkillFrontmatter } from "./skills/types";
import type { LocalSkill, LocalSkillBundle, SkillCategory } from "./skills/types";
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
  // Skills
  async getSkills(): Promise<LocalSkill[]> {
    return await db.skills.toArray();
  },

  async getActiveSkills(): Promise<LocalSkill[]> {
    return await db.skills.filter((s) => s.isEnabled).toArray();
  },

  async getSkill(id: string): Promise<LocalSkill | undefined> {
    return await db.skills.get(id);
  },

  async getSkillBySlug(slug: string): Promise<LocalSkill | undefined> {
    return await db.skills.where("slug").equals(slug).first();
  },

  async createSkill(data: {
    slug: string;
    name: string;
    description: string;
    content: string;
    icon?: string;
    category?: SkillCategory;
    isBuiltIn?: boolean;
    isEnabled?: boolean;
    scope?: "user" | "workspace";
    author?: string;
    version?: string;
    bundleId?: string;
    bundleName?: string;
    overview?: string;
    files?: Record<string, string>;
  }): Promise<string> {
    const id = "skill_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.skills.add({
      id,
      slug: data.slug.trim().toLowerCase(),
      name: data.name.trim(),
      description: data.description.trim(),
      content: data.content,
      icon: data.icon,
      category: data.category || "custom",
      isBuiltIn: Boolean(data.isBuiltIn),
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
      scope: data.scope || "user",
      author: data.author || "User",
      version: data.version || "1.0.0",
      bundleId: data.bundleId,
      bundleName: data.bundleName,
      overview: data.overview,
      files: data.files,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async updateSkill(
    id: string,
    data: Partial<Omit<LocalSkill, "id" | "createdAt">>
  ): Promise<void> {
    await db.skills.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },

  async toggleSkill(id: string, isEnabled: boolean): Promise<void> {
    await db.skills.update(id, {
      isEnabled,
      updatedAt: Date.now(),
    });
  },

  async deleteSkill(id: string): Promise<void> {
    await db.skills.delete(id);
  },

  // Skill Bundles
  async getSkillBundles(): Promise<LocalSkillBundle[]> {
    return await db.skillBundles.toArray();
  },

  async getSkillBundle(id: string): Promise<LocalSkillBundle | undefined> {
    return await db.skillBundles.get(id);
  },

  async createSkillBundle(data: {
    slug: string;
    name: string;
    description: string;
    author: string;
    version: string;
    category?: SkillCategory;
    isBuiltIn?: boolean;
    isEnabled?: boolean;
    scope?: "user" | "workspace";
    overview?: string;
    files?: Record<string, string>;
    skillIds?: string[];
  }): Promise<string> {
    const id = "bundle_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.skillBundles.add({
      id,
      slug: data.slug.trim().toLowerCase(),
      name: data.name.trim(),
      description: data.description.trim(),
      author: data.author,
      version: data.version || "1.0.0",
      category: data.category || "custom",
      isBuiltIn: Boolean(data.isBuiltIn),
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
      scope: data.scope || "user",
      overview: data.overview,
      files: data.files,
      skillIds: data.skillIds || [],
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async toggleSkillBundle(id: string, isEnabled: boolean): Promise<void> {
    await db.transaction("rw", [db.skillBundles, db.skills], async () => {
      const bundle = await db.skillBundles.get(id);
      if (!bundle) return;
      await db.skillBundles.update(id, {
        isEnabled,
        updatedAt: Date.now(),
      });
      // Also sync all skills belonging to this bundle
      if (bundle.skillIds && bundle.skillIds.length > 0) {
        for (const sid of bundle.skillIds) {
          await db.skills.update(sid, {
            isEnabled,
            updatedAt: Date.now(),
          });
        }
      }
    });
  },

  async deleteSkillBundle(id: string): Promise<void> {
    await db.transaction("rw", [db.skillBundles, db.skills], async () => {
      const bundle = await db.skillBundles.get(id);
      if (bundle && bundle.skillIds) {
        await db.skills.bulkDelete(bundle.skillIds);
      }
      await db.skillBundles.delete(id);
    });
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
