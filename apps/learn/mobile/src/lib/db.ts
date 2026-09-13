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
  fileUrl?: string;
  isZip?: boolean;
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
  durationMs?: number;
  attachments?: any[];
  createdAt: number;
}

export interface LocalChatSession {
  id: string;
  learnId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
  lastMessageSnippet?: string;
  isPinned?: boolean;
}

export const db = new Dexie("ConstLearnDatabase") as Dexie & {
  learns: EntityTable<LocalLearn, "id">;
  collections: EntityTable<LocalCollection, "id">;
  artifacts: EntityTable<LocalArtifact, "id">;
  messages: EntityTable<LocalMessage, "id">;
  chatSessions: EntityTable<LocalChatSession, "id">;
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

db.version(3).stores({
  learns: "id, title, updatedAt, createdAt, *collectionIds, projectPath",
  collections: "id, name, updatedAt, createdAt",
  artifacts: "id, learnId, title, type, updatedAt, createdAt",
  messages: "id, learnId, sessionId, role, createdAt",
  chatSessions: "id, learnId, updatedAt, createdAt",
}).upgrade(async (tx) => {
  try {
    const allMessages = await tx.table("messages").toArray();
    const messagesByLearn: Record<string, any[]> = {};
    for (const msg of allMessages) {
      const list = messagesByLearn[msg.learnId] ?? [];
      list.push(msg);
      messagesByLearn[msg.learnId] = list;
    }
    for (const [learnId, msgs] of Object.entries(messagesByLearn)) {
      const existingSessions = await tx.table("chatSessions").where("learnId").equals(learnId).count();
      if (existingSessions === 0 && msgs.length > 0) {
        const sessionId = `session_${learnId}_legacy`;
        const firstMsg = msgs[0];
        const lastMsg = msgs[msgs.length - 1];
        await tx.table("chatSessions").add({
          id: sessionId,
          learnId,
          title: firstMsg?.content ? firstMsg.content.slice(0, 30) : "Percakapan",
          createdAt: firstMsg?.createdAt || Date.now(),
          updatedAt: lastMsg?.createdAt || Date.now(),
          messageCount: msgs.length,
          lastMessageSnippet: lastMsg?.content ? lastMsg.content.slice(0, 60) : "",
        });
        for (const msg of msgs) {
          await tx.table("messages").update(msg.id, { sessionId });
        }
      }
    }
  } catch (err) {
    console.error("Dexie v3 migration error:", err);
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
      title: data.title.trim() || "Untitled notebook",
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
    if (data.title !== undefined) updates.title = data.title.trim() || "Untitled notebook";
    if (data.description !== undefined) updates.description = data.description?.trim();
    if (data.emoji !== undefined) updates.emoji = data.emoji;
    if (data.collectionIds !== undefined) updates.collectionIds = data.collectionIds;
    if (data.projectPath !== undefined) updates.projectPath = data.projectPath.trim();

    await db.learns.update(id, updates);
  },

  async deleteLearn(id: string) {
    // Delete associated artifacts, messages, and chat sessions
    await db.artifacts.where("learnId").equals(id).delete();
    await db.messages.where("learnId").equals(id).delete();
    await db.chatSessions.where("learnId").equals(id).delete();
    await db.learns.delete(id);
  },

  async batchDeleteLearns(ids: string[]) {
    for (const id of ids) {
      await db.artifacts.where("learnId").equals(id).delete();
      await db.messages.where("learnId").equals(id).delete();
      await db.chatSessions.where("learnId").equals(id).delete();
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
      name: data.name.trim() || "New Collection",
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
    if (data.name !== undefined) updates.name = data.name.trim() || "New Collection";
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
    fileUrl?: string;
    isZip?: boolean;
  }): Promise<string> {
    const id = "art_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.artifacts.add({
      id,
      learnId: data.learnId,
      title: data.title.trim() || "Untitled Artifact",
      type: data.type,
      content: data.content,
      fileUrl: data.fileUrl,
      isZip: data.isZip,
      updatedAt: now,
      createdAt: now,
    });
    return id;
  },

  async deleteArtifact(id: string) {
    await db.artifacts.delete(id);
  },

  // Chat Sessions
  async createChatSession(learnId: string, title?: string): Promise<string> {
    const id = "session_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.chatSessions.add({
      id,
      learnId,
      title: title?.trim() || "Percakapan Baru",
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    });
    return id;
  },

  async getChatSessions(learnId: string): Promise<LocalChatSession[]> {
    const list = await db.chatSessions.where("learnId").equals(learnId).toArray();
    return list.sort((a, b) => {
      if (Boolean(a.isPinned) && !Boolean(b.isPinned)) return -1;
      if (!Boolean(a.isPinned) && Boolean(b.isPinned)) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  },

  async updateChatSession(
    id: string,
    data: {
      title?: string;
      messageCount?: number;
      lastMessageSnippet?: string;
      updatedAt?: number;
      isPinned?: boolean;
    }
  ) {
    const updates: Partial<LocalChatSession> = {
      updatedAt: data.updatedAt ?? Date.now(),
    };
    if (data.title !== undefined) updates.title = data.title.trim() || "Percakapan Baru";
    if (data.messageCount !== undefined) updates.messageCount = data.messageCount;
    if (data.lastMessageSnippet !== undefined) updates.lastMessageSnippet = data.lastMessageSnippet;
    if (data.isPinned !== undefined) updates.isPinned = data.isPinned;

    await db.chatSessions.update(id, updates);
  },

  async deleteChatSession(sessionId: string) {
    await db.messages.where("sessionId").equals(sessionId).delete();
    await db.chatSessions.delete(sessionId);
  },

  // Messages (Chat History persistence)
  async getMessages(learnId: string): Promise<LocalMessage[]> {
    return await db.messages.where("learnId").equals(learnId).sortBy("createdAt");
  },

  async getSessionMessages(sessionId: string): Promise<LocalMessage[]> {
    return await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
  },

  async saveMessage(data: Omit<LocalMessage, "createdAt"> & { createdAt?: number }): Promise<string> {
    const now = data.createdAt || Date.now();
    await db.messages.put({
      ...data,
      createdAt: now,
    });

    if (data.sessionId) {
      const session = await db.chatSessions.get(data.sessionId);
      if (session) {
        await db.chatSessions.update(data.sessionId, {
          updatedAt: now,
          messageCount: (session.messageCount || 0) + 1,
          lastMessageSnippet: data.content ? data.content.slice(0, 80) : session.lastMessageSnippet,
        });
      }
    }
    return data.id;
  },

  async clearMessages(learnId: string): Promise<void> {
    await db.messages.where("learnId").equals(learnId).delete();
  },

  async clearSessionMessages(sessionId: string): Promise<void> {
    await db.messages.where("sessionId").equals(sessionId).delete();
    await db.chatSessions.update(sessionId, {
      messageCount: 0,
      lastMessageSnippet: "",
      updatedAt: Date.now(),
    });
  },

  async deleteTurn(userMsgId: string, assistantMsgId?: string, sessionId?: string): Promise<void> {
    const toDelete = [userMsgId];
    if (assistantMsgId) toDelete.push(assistantMsgId);
    await db.messages.bulkDelete(toDelete);

    if (sessionId) {
      const remaining = await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
      const last = remaining[remaining.length - 1];
      const snippet = last && typeof last.content === "string" ? last.content.slice(0, 80) : "";
      await db.chatSessions.update(sessionId, {
        lastMessageSnippet: snippet,
        messageCount: remaining.length,
        updatedAt: Date.now(),
      });
    }
  },
};

