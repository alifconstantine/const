import Dexie, { type EntityTable } from "dexie";

export interface LocalLearn {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  collectionIds: string[];
  sourcesCount: number;
  projectPath?: string;
  updatedAt: number;
  createdAt: number;
  isArchived?: boolean;
}

export interface LocalCollection {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  color?: string;
  updatedAt: number;
  createdAt: number;
}

export interface LocalArtifact {
  id: string;
  learnId?: string;
  title: string;
  type: string;
  content?: string;
  updatedAt: number;
  createdAt: number;
}

export interface LocalMessage {
  id: string;
  learnId: string;
  sessionId?: string;
  role: "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  toolCalls?: any[];
  createdAt: number;
}

export interface LocalChatSession {
  id: string;
  learnId: string;
  title: string;
  lastMessageSnippet?: string;
  messageCount: number;
  updatedAt: number;
  createdAt: number;
}

export const db = new Dexie("ConstLearnDatabase") as Dexie & {
  learns: EntityTable<LocalLearn, "id">;
  collections: EntityTable<LocalCollection, "id">;
  artifacts: EntityTable<LocalArtifact, "id">;
  messages: EntityTable<LocalMessage, "id">;
  sessions: EntityTable<LocalChatSession, "id">;
};

db.version(1).stores({
  learns: "id, title, updatedAt, createdAt, *collectionIds",
  collections: "id, name, updatedAt, createdAt",
  artifacts: "id, learnId, title, type, updatedAt, createdAt",
});

db.version(2).stores({
  learns: "id, title, updatedAt, createdAt, *collectionIds, projectPath",
  collections: "id, name, updatedAt, createdAt",
  artifacts: "id, learnId, title, type, updatedAt, createdAt",
  messages: "id, learnId, role, createdAt",
});

db.version(3)
  .stores({
    learns: "id, title, updatedAt, createdAt, *collectionIds, projectPath",
    collections: "id, name, updatedAt, createdAt",
    artifacts: "id, learnId, title, type, updatedAt, createdAt",
    messages: "id, learnId, sessionId, role, createdAt",
    sessions: "id, learnId, title, updatedAt, createdAt",
  })
  .upgrade(async (tx) => {
    // Migration: Any existing messages without sessionId are grouped into an initial session
    const messages = await tx.table("messages").toArray();
    const learnMap = new Map<string, typeof messages>();
    for (const m of messages) {
      if (!m.sessionId && m.learnId) {
        const list = learnMap.get(m.learnId) || [];
        list.push(m);
        learnMap.set(m.learnId, list);
      }
    }
    for (const [learnId, msgs] of learnMap.entries()) {
      const sessionId =
        "session_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      const firstMsg = msgs[0]?.content || "Sesi Utama";
      const snippet = msgs[msgs.length - 1]?.content?.slice(0, 80) || "";
      const createdAt = msgs[0]?.createdAt || Date.now();
      const updatedAt = msgs[msgs.length - 1]?.createdAt || Date.now();
      await tx.table("sessions").add({
        id: sessionId,
        learnId,
        title: typeof firstMsg === "string" ? firstMsg.slice(0, 35) : "Sesi Utama",
        lastMessageSnippet: typeof snippet === "string" ? snippet : "",
        messageCount: msgs.length,
        createdAt,
        updatedAt,
      });
      for (const m of msgs) {
        await tx.table("messages").update(m.id, { sessionId });
      }
    }
  });

// Helper functions for CRUD operations
export const localDb = {
  // Learns
  async createLearn(data: {
    title: string;
    description?: string;
    emoji?: string;
    collectionId?: string;
    projectPath?: string;
  }): Promise<string> {
    const id = "learn_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.learns.add({
      id,
      title: data.title.trim() || "Untitled learn",
      description: data.description?.trim(),
      emoji: data.emoji || "📘",
      collectionIds: data.collectionId ? [data.collectionId] : [],
      sourcesCount: 0,
      projectPath: data.projectPath?.trim(),
      updatedAt: now,
      createdAt: now,
      isArchived: false,
    });
    return id;
  },

  async updateLearn(
    id: string,
    data: {
      title?: string;
      description?: string;
      emoji?: string;
      collectionIds?: string[];
      projectPath?: string;
    }
  ) {
    const updates: Partial<LocalLearn> = {
      updatedAt: Date.now(),
    };
    if (data.title !== undefined) updates.title = data.title.trim() || "Untitled learn";
    if (data.description !== undefined) updates.description = data.description?.trim();
    if (data.emoji !== undefined) updates.emoji = data.emoji;
    if (data.collectionIds !== undefined) updates.collectionIds = data.collectionIds;
    if (data.projectPath !== undefined) updates.projectPath = data.projectPath.trim();

    await db.learns.update(id, updates);
  },

  async deleteLearn(id: string) {
    // Delete associated artifacts and messages
    await db.artifacts.where("learnId").equals(id).delete();
    await db.messages.where("learnId").equals(id).delete();
    await db.learns.delete(id);
  },

  async batchDeleteLearns(ids: string[]) {
    for (const id of ids) {
      await db.artifacts.where("learnId").equals(id).delete();
      await db.messages.where("learnId").equals(id).delete();
    }
    await db.learns.bulkDelete(ids);
  },

  async toggleCollection(learnId: string, collectionId: string) {
    const learn = await db.learns.get(learnId);
    if (!learn) return;
    const current = learn.collectionIds || [];
    const next = current.includes(collectionId)
      ? current.filter((cid) => cid !== collectionId)
      : [...current, collectionId];
    await db.learns.update(learnId, {
      collectionIds: next,
      updatedAt: Date.now(),
    });
  },

  // Collections
  async createCollection(data: {
    name: string;
    description?: string;
    emoji?: string;
    color?: string;
  }): Promise<string> {
    const id = "col_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.collections.add({
      id,
      name: data.name.trim() || "Koleksi Baru",
      description: data.description?.trim(),
      emoji: data.emoji || "📁",
      color: data.color || "#0066ff",
      updatedAt: now,
      createdAt: now,
    });
    return id;
  },

  async updateCollection(
    id: string,
    data: {
      name?: string;
      description?: string;
      emoji?: string;
      color?: string;
    }
  ) {
    const updates: Partial<LocalCollection> = {
      updatedAt: Date.now(),
    };
    if (data.name !== undefined) updates.name = data.name.trim() || "Koleksi Baru";
    if (data.description !== undefined) updates.description = data.description?.trim();
    if (data.emoji !== undefined) updates.emoji = data.emoji;
    if (data.color !== undefined) updates.color = data.color;

    await db.collections.update(id, updates);
  },

  async deleteCollection(id: string) {
    // Remove collection reference from any learns
    const allLearns = await db.learns.toArray();
    for (const l of allLearns) {
      if (l.collectionIds?.includes(id)) {
        await db.learns.update(l.id, {
          collectionIds: l.collectionIds.filter((cid) => cid !== id),
          updatedAt: Date.now(),
        });
      }
    }
    await db.collections.delete(id);
  },

  // Artifacts
  async createArtifact(data: {
    learnId?: string;
    title: string;
    type: string;
    content?: string;
  }): Promise<string> {
    const id = "art_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.artifacts.add({
      id,
      learnId: data.learnId,
      title: data.title.trim() || "Untitled Artifact",
      type: data.type,
      content: data.content,
      updatedAt: now,
      createdAt: now,
    });
    return id;
  },

  async deleteArtifact(id: string) {
    await db.artifacts.delete(id);
  },

  // Sessions (Multi-Session Chat Threads)
  async createSession(learnId: string, initialTitle?: string): Promise<string> {
    const id = "session_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.sessions.add({
      id,
      learnId,
      title: initialTitle?.trim() || "Percakapan Baru",
      lastMessageSnippet: "",
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async getSessions(learnId: string): Promise<LocalChatSession[]> {
    return await db.sessions.where("learnId").equals(learnId).reverse().sortBy("updatedAt");
  },

  async getSession(sessionId: string): Promise<LocalChatSession | null> {
    return (await db.sessions.get(sessionId)) || null;
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await db.sessions.update(sessionId, {
      title: title.trim(),
      updatedAt: Date.now(),
    });
  },

  async deleteSession(sessionId: string): Promise<void> {
    await db.messages.where("sessionId").equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  },

  // Messages (Chat History persistence)
  async getMessages(learnId: string, sessionId?: string): Promise<LocalMessage[]> {
    if (sessionId) {
      return await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
    }
    return await db.messages.where("learnId").equals(learnId).sortBy("createdAt");
  },

  async saveMessage(data: Omit<LocalMessage, "createdAt"> & { createdAt?: number }): Promise<string> {
    const now = data.createdAt || Date.now();
    await db.messages.put({
      ...data,
      createdAt: now,
    });

    // If message is linked to a session, update session snippet, count, and updatedAt
    if (data.sessionId) {
      const session = await db.sessions.get(data.sessionId);
      if (session) {
        const snippet = typeof data.content === "string" ? data.content.slice(0, 100) : "";
        await db.sessions.update(data.sessionId, {
          lastMessageSnippet: snippet,
          messageCount: (session.messageCount || 0) + 1,
          updatedAt: now,
        });
      }
    }

    return data.id;
  },

  async clearMessages(learnId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await db.messages.where("sessionId").equals(sessionId).delete();
      await db.sessions.update(sessionId, {
        lastMessageSnippet: "",
        messageCount: 0,
        updatedAt: Date.now(),
      });
    } else {
      await db.messages.where("learnId").equals(learnId).delete();
    }
  },
};

