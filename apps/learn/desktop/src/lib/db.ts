import Dexie, { type EntityTable } from "dexie";
import type { FileMutationRecord } from "@const/agent";

export interface LocalLearn {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  collectionIds: string[];
  sourcesCount: number;
  projectPath?: string;
  permissionMode?: "ask_before_changes" | "full_access";
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
  lastOpenedAt?: number;
}

export interface QuizOption {
  id: string; // "A" | "B" | "C" | "D"
  text: string;
  explanation?: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  hint?: string;
}

export interface QuizData {
  title: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  sourceCount: number;
  sourceTitles?: string[];
  questions: QuizQuestion[];
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  hint?: string;
}

export interface FlashcardData {
  title: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  sourceCount: number;
  sourceTitles?: string[];
  cards: FlashcardItem[];
}

export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  children?: MindMapNode[];
}

export interface MindMapData {
  id?: string;
  learnId?: string;
  title: string;
  topic?: string;
  root: MindMapNode;
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  sourceNames?: string[];
  prompt?: string;
  feedback?: "good" | "bad";
  createdAt?: number;
  updatedAt?: number;
}

export interface SlideNumberItem {
  value: string;
  label: string;
  note?: string;
}

export interface SlideItem {
  id: string;
  slideNumber: number;
  title: string;
  html?: string;
  rawHtml?: string;
  layout?:
    | "hero"
    | "agenda"
    | "bullets"
    | "split"
    | "quote"
    | "numbers"
    | "big-stat"
    | "bento-grid"
    | "comparison"
    | "timeline"
    | "takeaway"
    | string;
  subtitle?: string;
  kicker?: string;
  bullets?: string[];
  leftColumn?: { title?: string; items: string[] };
  rightColumn?: { title?: string; items: string[] };
  quote?: { text: string; author?: string; context?: string };
  numbers?: SlideNumberItem[];
  statHighlight?: { value: string; label: string; context?: string };
  bentoCards?: Array<{ badge?: string; title: string; desc: string }>;
  comparisonDetails?: {
    leftTitle: string;
    leftItems: string[];
    rightTitle: string;
    rightItems: string[];
    winner?: "left" | "right";
  };
  timelineSteps?: Array<{ step: string; title: string; desc: string }>;
  speakerNotes?: string;
  accentTag?: string;
}

export interface SlideDeckData {
  id?: string;
  learnId?: string;
  title: string;
  topic?: string;
  provider?: "native" | "canva" | "slides";
  lengthMode: "short" | "medium" | "long" | "auto";
  slideCount?: number;
  language: "id" | "en";
  themeId?: "bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime" | string;
  customCss?: string;
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  // Native slide deck properties
  htmlContent?: string;
  htmlPath?: string;
  pdfPath?: string;
  pdfUrl?: string;
  slides: SlideItem[];
  // Canva properties
  canvaJobId?: string;
  canvaDesignId?: string;
  canvaEditUrl?: string;
  canvaViewUrl?: string;
  canvaThumbnails?: Array<{ url: string }>;
  // Google Slides properties
  googleSlidesId?: string;
  googleSlidesUrl?: string;
  googleSlidesEmbedUrl?: string;
  // Status & error handling
  renderingStatus?: "generating" | "rendering" | "completed" | "error";
  renderingError?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AudioSummaryData {
  title: string;
  script: string;
  audioUrl?: string;
  audioBase64?: string;
  duration?: number;
  voiceModel?: string;
  voiceId?: string;
  language?: string;
  lengthMode?: "short" | "long" | "auto";
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  createdAt?: number;
  audioError?: string;
}

export interface VideoSummaryScene {
  id: string;
  sceneNumber: number;
  title: string;
  narrationText: string;
  audioUrl?: string;
  audioBase64?: string;
  audioFilename?: string;
  durationSeconds: number;
  archetype?: "hero" | "flow_diagram" | "comparison" | "metrics" | "cards" | "takeaway" | string;
  layout?: "hero" | "split" | "bullets" | "stat" | "comparison" | "quote" | "takeaway" | "concept" | string;
  subtitle?: string;
  bullets?: string[];
  keypoints?: string[];
  visualNote?: string;
  visualData?: {
    steps?: Array<{ label: string; desc: string; tag?: string }>;
    cards?: Array<{ title: string; desc: string; metric?: string; highlight?: boolean }>;
    metrics?: Array<{ value: string; label: string; desc?: string; badge?: string }>;
    comparison?: { leftTitle: string; leftItems: string[]; rightTitle: string; rightItems: string[] };
    takeaways?: string[];
  };
  statHighlight?: { value: string; label: string; context?: string };
  comparison?: { leftTitle: string; leftItems: string[]; rightTitle: string; rightItems: string[] };
  quote?: { text: string; author?: string };
}

export interface VideoSummaryTheme {
  archetype?: "minimal_editorial" | "bold_tech" | "warm_academic" | "dark_luminous" | "vibrant_creative" | string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  fontHeading?: string;
  fontBody?: string;
}

export interface VideoSummaryData {
  id?: string;
  learnId?: string;
  title: string;
  topic?: string;
  coverageMode: "short" | "long" | "auto";
  language: "id" | "en" | string;
  voiceProviderId?: string;
  voiceModel?: string;
  voiceId?: string;
  voiceName?: string;
  totalDurationSeconds: number;
  combinedAudioUrl?: string;
  combinedAudioBase64?: string;
  masterAudioRelative?: string;
  projectPath?: string;
  mp4Path?: string;
  mp4Url?: string;
  renderingStatus?: "idle" | "rendering" | "completed" | "error";
  renderingError?: string;
  theme?: VideoSummaryTheme;
  audioError?: string;
  hyperframesHtml?: string;
  scenes: VideoSummaryScene[];
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  customInstructions?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface InfographicData {
  id?: string;
  learnId?: string;
  title: string;
  topic?: string;
  imageUrl: string;
  prompt: string;
  visualPrompt?: string;
  orientation: "landscape" | "portrait" | "square";
  style: string;
  styleLabel?: string;
  detailLevel: "brief" | "standard" | "detailed";
  language: "id" | "en" | string;
  summary?: string;
  keyPoints?: string[];
  dimensions?: { width: number; height: number };
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  modelUsed?: string;
  providerUsed?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ReportSectionWidget {
  type: "infographic" | "quiz" | "flashcard" | "chart" | "callout" | string;
  badge?: string;
  title: string;
  description?: string;
  targetTool?: string;
}

export interface ReportSection {
  id: string;
  order: number;
  title: string;
  content: string; // Markdown with LaTeX KaTeX support
  recommendedWidget?: ReportSectionWidget;
}

export interface ReportData {
  id?: string;
  learnId?: string;
  title: string;
  format: "interactive" | "document";
  templateId: string;
  depth?: "short" | "medium" | "long" | "auto";
  language: "id" | "en";
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  toc: Array<{ id: string; title: string; order: number }>;
  sections: ReportSection[];
  feedback?: "good" | "bad";
  customInstructions?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CheatSheetCard {
  id: string;
  title: string;
  badge?: string;
  content: string; // Markdown supporting KaTeX $...$, code blocks, lists, tables
  span?: "normal" | "wide";
}

export interface CheatSheetData {
  id?: string;
  learnId?: string;
  title: string;
  topic?: string;
  coverageMode: "short" | "auto" | "long";
  sourceCount?: number;
  sourceTitles?: string[];
  sourceIds?: string[];
  cards: CheatSheetCard[];
  summaryMarkdown?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface LocalArtifact {
  id: string;
  learnId?: string;
  title: string;
  type: string;
  content?: string;
  data?: QuizData | FlashcardData | MindMapData | SlideDeckData | AudioSummaryData | VideoSummaryData | InfographicData | ReportData | CheatSheetData | any;
  fileUrl?: string;
  isZip?: boolean;
  status?: "generating" | "completed" | "error";
  sourcesCount?: number;
  error?: string;
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
  mutations?: FileMutationRecord[];
  traceSteps?: any[];
  durationMs?: number;
  attachments?: any[];
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

export interface LocalSource {
  id: string;
  learnId: string;
  title: string;
  type: "file" | "url" | "text" | "youtube" | "docs" | "drive" | "book" | "github";
  url?: string;
  path?: string;
  content?: string;
  size?: number;
  subpagesCount?: number;
  includedInChat: boolean;
  createdAt: number;
  updatedAt: number;
}

export const db = new Dexie("ConstLearnDatabase") as Dexie & {
  learns: EntityTable<LocalLearn, "id">;
  collections: EntityTable<LocalCollection, "id">;
  artifacts: EntityTable<LocalArtifact, "id">;
  messages: EntityTable<LocalMessage, "id">;
  sessions: EntityTable<LocalChatSession, "id">;
  sources: EntityTable<LocalSource, "id">;
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

db.version(4).stores({
  learns: "id, title, updatedAt, createdAt, *collectionIds, projectPath",
  collections: "id, name, updatedAt, createdAt",
  artifacts: "id, learnId, title, type, updatedAt, createdAt",
  messages: "id, learnId, sessionId, role, createdAt",
  sessions: "id, learnId, title, updatedAt, createdAt",
  sources: "id, learnId, type, includedInChat, createdAt",
});

// Hook on reading sources from DB to ensure content is always a clean string even for legacy/malformed records
db.sources.hook("reading", (obj: any) => {
  if (obj && obj.content && typeof obj.content !== "string") {
    const raw = obj.content;
    obj.content =
      typeof raw.text === "string"
        ? raw.text
        : typeof raw.content === "string"
        ? raw.content
        : typeof raw.snippet === "string"
        ? raw.snippet
        : JSON.stringify(raw);
  }
  return obj;
});

// Self-healing migration for existing records on DB ready
db.on("ready", async () => {
  try {
    const corruptSources = await db.sources
      .filter((s: any) => s && typeof s.content !== "string" && s.content !== undefined)
      .toArray();
    for (const s of corruptSources) {
      const raw = (s as any).content;
      const clean =
        typeof raw?.text === "string"
          ? raw.text
          : typeof raw?.content === "string"
          ? raw.content
          : typeof raw?.snippet === "string"
          ? raw.snippet
          : JSON.stringify(raw);
      await db.sources.update(s.id, { content: clean });
    }
  } catch (err) {
    console.warn("Source migration notice:", err);
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
    permissionMode?: "ask_before_changes" | "full_access";
  }): Promise<string> {
    const id = "learn_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.learns.add({
      id,
      title: data.title.trim() || "Untitled learn",
      description: data.description?.trim(),
      emoji: data.emoji || "book",
      collectionIds: data.collectionId ? [data.collectionId] : [],
      sourcesCount: 0,
      projectPath: data.projectPath?.trim(),
      permissionMode: data.permissionMode || "ask_before_changes",
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
      permissionMode?: "ask_before_changes" | "full_access";
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
    if (data.permissionMode !== undefined) updates.permissionMode = data.permissionMode;

    await db.learns.update(id, updates);
  },

  async deleteLearn(id: string) {
    await db.transaction("rw", [db.learns, db.artifacts, db.messages, db.sessions, db.sources], async () => {
      // 1. Delete all artifacts linked to this learnId (both index and data payload)
      const artifactIds = await db.artifacts
        .filter((a) => a.learnId === id || a.data?.learnId === id)
        .primaryKeys();
      if (artifactIds.length > 0) {
        await db.artifacts.bulkDelete(artifactIds);
      }

      // 2. Delete all chat messages
      await db.messages.where("learnId").equals(id).delete();

      // 3. Delete all chat sessions
      await db.sessions.where("learnId").equals(id).delete();

      // 4. Delete all sources
      await db.sources.where("learnId").equals(id).delete();

      // 5. Delete the workspace record
      await db.learns.delete(id);
    });

    // 6. Clean up localStorage cache
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(`const_learn_active_session_${id}`);
      }
    } catch {}

    // 7. Clean up workspace directory on disk in Electron if present
    try {
      const electron = (window as any)?.electron;
      if (electron?.deleteWorkspacePath) {
        await electron.deleteWorkspacePath(id);
      }
    } catch (err) {
      console.warn("Could not delete workspace directory on disk:", err);
    }
  },

  async batchDeleteLearns(ids: string[]) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    await db.transaction("rw", [db.learns, db.artifacts, db.messages, db.sessions, db.sources], async () => {
      const artifactIds = await db.artifacts
        .filter((a) => (a.learnId && idSet.has(a.learnId)) || (a.data?.learnId && idSet.has(a.data.learnId)))
        .primaryKeys();
      if (artifactIds.length > 0) {
        await db.artifacts.bulkDelete(artifactIds);
      }

      for (const id of ids) {
        await db.messages.where("learnId").equals(id).delete();
        await db.sessions.where("learnId").equals(id).delete();
        await db.sources.where("learnId").equals(id).delete();
      }
      await db.learns.bulkDelete(ids);
    });

    try {
      if (typeof localStorage !== "undefined") {
        for (const id of ids) {
          localStorage.removeItem(`const_learn_active_session_${id}`);
        }
      }
    } catch {}

    try {
      const electron = (window as any)?.electron;
      if (electron?.deleteWorkspacePath) {
        for (const id of ids) {
          await electron.deleteWorkspacePath(id);
        }
      }
    } catch (err) {
      console.warn("Could not batch delete workspace directories on disk:", err);
    }
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

  async addLearnsToCollection(collectionId: string, learnIds: string[]) {
    if (learnIds.length === 0) return;
    const now = Date.now();
    await db.transaction("rw", [db.learns], async () => {
      for (const learnId of learnIds) {
        const learn = await db.learns.get(learnId);
        if (!learn) continue;
        const current = learn.collectionIds || [];
        if (!current.includes(collectionId)) {
          await db.learns.update(learnId, {
            collectionIds: [...current, collectionId],
            updatedAt: now,
          });
        }
      }
    });
  },

  async removeLearnFromCollection(collectionId: string, learnId: string) {
    const learn = await db.learns.get(learnId);
    if (!learn) return;
    const current = learn.collectionIds || [];
    if (current.includes(collectionId)) {
      await db.learns.update(learnId, {
        collectionIds: current.filter((cid) => cid !== collectionId),
        updatedAt: Date.now(),
      });
    }
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
      emoji: data.emoji || "folder",
      color: data.color || "#0066ff",
      updatedAt: now,
      createdAt: now,
      lastOpenedAt: now,
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
      lastOpenedAt?: number;
    }
  ) {
    const updates: Partial<LocalCollection> = {
      updatedAt: Date.now(),
    };
    if (data.name !== undefined) updates.name = data.name.trim() || "New Collection";
    if (data.description !== undefined) updates.description = data.description?.trim();
    if (data.emoji !== undefined) updates.emoji = data.emoji;
    if (data.color !== undefined) updates.color = data.color;
    if (data.lastOpenedAt !== undefined) updates.lastOpenedAt = data.lastOpenedAt;

    await db.collections.update(id, updates);
  },

  async markCollectionOpened(id: string) {
    await db.collections.update(id, {
      lastOpenedAt: Date.now(),
    });
  },

  async deleteCollection(id: string) {
    await db.transaction("rw", [db.collections, db.learns], async () => {
      const affectedLearns = await db.learns.where("collectionIds").equals(id).toArray();
      for (const l of affectedLearns) {
        await db.learns.update(l.id, {
          collectionIds: (l.collectionIds || []).filter((cid) => cid !== id),
          updatedAt: Date.now(),
        });
      }
      await db.collections.delete(id);
    });
  },

  async batchDeleteCollections(ids: string[]) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    await db.transaction("rw", [db.collections, db.learns], async () => {
      for (const id of ids) {
        const affectedLearns = await db.learns.where("collectionIds").equals(id).toArray();
        for (const l of affectedLearns) {
          await db.learns.update(l.id, {
            collectionIds: (l.collectionIds || []).filter((cid) => !idSet.has(cid)),
            updatedAt: Date.now(),
          });
        }
      }
      await db.collections.bulkDelete(ids);
    });
  },

  // Artifacts
  async createArtifact(data: {
    id?: string;
    learnId?: string;
    title: string;
    type: string;
    content?: string;
    fileUrl?: string;
    isZip?: boolean;
    data?: any;
    status?: "generating" | "completed" | "error";
    sourcesCount?: number;
    error?: string;
  }): Promise<string> {
    const id = data.id || "art_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();
    await db.artifacts.add({
      id,
      learnId: data.learnId,
      title: data.title.trim() || "Untitled Artifact",
      type: data.type,
      content: data.content,
      data: data.data,
      fileUrl: data.fileUrl,
      isZip: data.isZip,
      status: data.status || "completed",
      sourcesCount: data.sourcesCount,
      error: data.error,
      updatedAt: now,
      createdAt: now,
    });
    return id;
  },

  async updateArtifact(
    id: string,
    updates: Partial<Omit<LocalArtifact, "id" | "createdAt">>
  ): Promise<void> {
    await db.artifacts.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async getArtifact(id: string): Promise<LocalArtifact | null> {
    return (await db.artifacts.get(id)) || null;
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
      const sessionMsgs = await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
      if (sessionMsgs.length > 0) {
        return sessionMsgs;
      }

      // Recovery fallback: If no messages have this sessionId, check if there are orphan messages for this learnId
      // and associate them to this session (e.g. from stream events where sessionId was omitted)
      const sessions = await db.sessions.where("learnId").equals(learnId).toArray();
      if (sessions.length <= 1) {
        const allMsgs = await db.messages.where("learnId").equals(learnId).sortBy("createdAt");
        const orphans = allMsgs.filter((m) => !m.sessionId);
        if (orphans.length > 0) {
          for (const o of orphans) {
            await db.messages.update(o.id, { sessionId });
          }
          return await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
        }
      }
      return sessionMsgs;
    }
    return await db.messages.where("learnId").equals(learnId).sortBy("createdAt");
  },

  async saveMessage(data: Omit<LocalMessage, "createdAt"> & { createdAt?: number }): Promise<string> {
    const now = data.createdAt || Date.now();
    await db.messages.put({
      ...data,
      createdAt: now,
    });

    // If message is linked to a session, update session snippet, accurate count, and updatedAt
    if (data.sessionId) {
      const session = await db.sessions.get(data.sessionId);
      if (session) {
        const snippet = typeof data.content === "string" ? data.content.slice(0, 100) : "";
        const actualCount = await db.messages.where("sessionId").equals(data.sessionId).count();
        await db.sessions.update(data.sessionId, {
          lastMessageSnippet: snippet,
          messageCount: actualCount,
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

  async deleteMessage(messageId: string, sessionId?: string): Promise<void> {
    await db.messages.delete(messageId);
    if (sessionId) {
      const remaining = await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
      const last = remaining[remaining.length - 1];
      const snippet = last && typeof last.content === "string" ? last.content.slice(0, 100) : "";
      await db.sessions.update(sessionId, {
        lastMessageSnippet: snippet,
        messageCount: remaining.length,
        updatedAt: Date.now(),
      });
    }
  },

  async deleteTurn(userMsgId: string, assistantMsgId?: string, sessionId?: string): Promise<void> {
    const toDelete = [userMsgId];
    if (assistantMsgId) toDelete.push(assistantMsgId);
    await db.messages.bulkDelete(toDelete);

    if (sessionId) {
      const remaining = await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
      const last = remaining[remaining.length - 1];
      const snippet = last && typeof last.content === "string" ? last.content.slice(0, 100) : "";
      await db.sessions.update(sessionId, {
        lastMessageSnippet: snippet,
        messageCount: remaining.length,
        updatedAt: Date.now(),
      });
    }
  },

  async truncateSessionFromMessage(userMsgId: string, sessionId?: string): Promise<string[]> {
    if (!sessionId) {
      await db.messages.delete(userMsgId);
      return [userMsgId];
    }
    const allMsgs = await db.messages.where("sessionId").equals(sessionId).sortBy("createdAt");
    const targetIdx = allMsgs.findIndex((m) => m.id === userMsgId);
    if (targetIdx === -1) {
      await db.messages.delete(userMsgId);
      return [userMsgId];
    }
    const toDeleteMsgs = allMsgs.slice(targetIdx);
    const toDeleteIds = toDeleteMsgs.map((m) => m.id);
    await db.messages.bulkDelete(toDeleteIds);

    const remaining = allMsgs.slice(0, targetIdx);
    const last = remaining[remaining.length - 1];
    const snippet = last && typeof last.content === "string" ? last.content.slice(0, 100) : "";
    await db.sessions.update(sessionId, {
      lastMessageSnippet: snippet,
      messageCount: remaining.length,
      updatedAt: Date.now(),
    });
    return toDeleteIds;
  },

  async updateMessageMutations(messageId: string, mutations: FileMutationRecord[]): Promise<void> {
    await db.messages.update(messageId, { mutations });
  },

  // Sources
  async createSource(data: {
    learnId: string;
    title: string;
    type?: LocalSource["type"];
    url?: string;
    path?: string;
    content?: any;
    size?: number;
    subpagesCount?: number;
    includedInChat?: boolean;
  }): Promise<string> {
    const id = "source_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const now = Date.now();

    let safeContent: string | undefined = undefined;
    if (typeof data.content === "string") {
      safeContent = data.content;
    } else if (data.content && typeof data.content === "object") {
      const c = data.content as any;
      safeContent =
        typeof c.text === "string"
          ? c.text
          : typeof c.content === "string"
          ? c.content
          : typeof c.snippet === "string"
          ? c.snippet
          : JSON.stringify(c);
    } else if (data.content !== undefined && data.content !== null) {
      safeContent = String(data.content);
    }

    const safeSize = data.size ?? (safeContent ? new Blob([safeContent]).size : undefined);

    await db.sources.add({
      id,
      learnId: data.learnId,
      title: data.title,
      type: data.type || "file",
      url: data.url,
      path: data.path,
      content: safeContent,
      size: safeSize,
      subpagesCount: data.subpagesCount,
      includedInChat: data.includedInChat ?? true,
      createdAt: now,
      updatedAt: now,
    });

    // Update learn sources count
    const count = await db.sources.where("learnId").equals(data.learnId).count();
    await db.learns.update(data.learnId, {
      sourcesCount: count,
      updatedAt: now,
    });

    return id;
  },

  async getSources(learnId: string): Promise<LocalSource[]> {
    const sources = await db.sources.where("learnId").equals(learnId).reverse().sortBy("createdAt");
    return sources.map((s: any) => {
      if (s.content && typeof s.content !== "string") {
        s.content = typeof s.content.text === "string" ? s.content.text : JSON.stringify(s.content);
      }
      return s;
    });
  },

  async toggleSourceInChat(sourceId: string, includedInChat: boolean): Promise<void> {
    await db.sources.update(sourceId, {
      includedInChat,
      updatedAt: Date.now(),
    });
  },

  async setAllSourcesInChat(learnId: string, includedInChat: boolean): Promise<void> {
    const all = await db.sources.where("learnId").equals(learnId).toArray();
    await Promise.all(
      all.map((s) =>
        db.sources.update(s.id, {
          includedInChat,
          updatedAt: Date.now(),
        })
      )
    );
  },

  async deleteSource(sourceId: string): Promise<void> {
    const source = await db.sources.get(sourceId);
    await db.sources.delete(sourceId);
    if (source?.learnId) {
      const count = await db.sources.where("learnId").equals(source.learnId).count();
      await db.learns.update(source.learnId, {
        sourcesCount: count,
        updatedAt: Date.now(),
      });
    }
  },
};

