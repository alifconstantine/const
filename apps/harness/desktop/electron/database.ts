import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { mergeTelemetry, reduceTelemetry, telemetryForHistory, type ChatTelemetry } from "../src/lib/chat-telemetry";

export interface StoredMessage {
  id?: string;
  role: string;
  content: string | any[];
  thinking?: string;
  toolCalls?: any[];
  toolResults?: any[];
  createdAt?: number;
  [key: string]: any;
}

export interface ConversationRecord {
  id: string;
  title: string;
  project: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isScheduled?: boolean;
  createdAt: number;
  updatedAt: number;
  model?: string;
  telemetry?: ChatTelemetry;
  mode?: "ask_before_changes" | "full_access" | string;
  messages: StoredMessage[];
  contextUsage?: {
    usedTokens: number;
    totalTokens: number;
  };
  diffStats?: {
    additions: number;
    deletions: number;
  };
}

export class ConversationDatabase {
  private db: DatabaseSync;
  private harnessHome: string;
  private brainDir: string;

  constructor(harnessHome: string) {
    this.harnessHome = harnessHome;
    this.brainDir = path.join(harnessHome, "brain");
    const convosDir = path.join(harnessHome, "conversations");

    if (!fs.existsSync(convosDir)) {
      fs.mkdirSync(convosDir, { recursive: true });
    }
    if (!fs.existsSync(this.brainDir)) {
      fs.mkdirSync(this.brainDir, { recursive: true });
    }

    const dbPath = path.join(convosDir, "conversations.db");
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    try {
      this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    } catch {}

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_scheduled INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        model TEXT,
        mode TEXT,
        diff_stats TEXT,
        context_usage TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        thinking TEXT,
        tool_calls TEXT,
        tool_results TEXT,
        created_at INTEGER NOT NULL,
        raw_json TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS project_pins (
        project_name TEXT PRIMARY KEY,
        is_pinned INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conv_archived ON conversations(is_archived);
      CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at ASC);
    `);

    // Schema migrations
    try {
      this.db.exec("ALTER TABLE conversations ADD COLUMN is_scheduled INTEGER NOT NULL DEFAULT 0;");
    } catch {}
    try {
      this.db.exec("ALTER TABLE conversations ADD COLUMN mode TEXT;");
    } catch {}
    try {
      this.db.exec("ALTER TABLE conversations ADD COLUMN telemetry TEXT;");
    } catch {}

    // Clean up legacy [Scheduled] titles in existing database
    try {
      this.db.exec(`
        UPDATE conversations 
        SET is_scheduled = 1, title = TRIM(SUBSTR(title, 13)) 
        WHERE title LIKE '[Scheduled] %';
      `);
      this.db.exec(`
        UPDATE conversations 
        SET is_scheduled = 1 
        WHERE id LIKE 'scheduled_%';
      `);
    } catch {}

    // Clean up any leaked side conversations in existing database
    try {
      this.db.exec(`
        DELETE FROM messages WHERE conversation_id LIKE 'side_conversation_%' OR conversation_id LIKE 'side_chat_%';
        DELETE FROM conversations WHERE id LIKE 'side_conversation_%' OR id LIKE 'side_chat_%';
      `);
    } catch {}
  }

  public listConversations(includeArchived = false): ConversationRecord[] {
    const query = includeArchived
      ? "SELECT * FROM conversations WHERE id NOT LIKE 'side_conversation_%' AND id NOT LIKE 'side_chat_%' ORDER BY is_pinned DESC, updated_at DESC"
      : "SELECT * FROM conversations WHERE is_archived = 0 AND id NOT LIKE 'side_conversation_%' AND id NOT LIKE 'side_chat_%' ORDER BY is_pinned DESC, updated_at DESC";

    const rows = this.db.prepare(query).all() as any[];
    return rows.map((row) => this.hydrateConversation(row));
  }

  public listArchivedConversations(): ConversationRecord[] {
    const query = "SELECT * FROM conversations WHERE is_archived = 1 AND id NOT LIKE 'side_conversation_%' AND id NOT LIKE 'side_chat_%' ORDER BY updated_at DESC";
    const rows = this.db.prepare(query).all() as any[];
    return rows.map((row) => this.hydrateConversation(row));
  }

  public getConversation(id: string): ConversationRecord | null {
    const row = this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as any;
    if (!row) return null;
    return this.hydrateConversation(row);
  }

  public saveConversation(convo: ConversationRecord): void {
    if (!convo?.id || convo.id.startsWith("side_conversation_") || convo.id.startsWith("side_chat_")) {
      return;
    }
    const now = Date.now();
    const updatedAt = convo.updatedAt || now;
    const createdAt = convo.createdAt || now;
    const isPinned = convo.isPinned ? 1 : 0;
    const isArchived = convo.isArchived ? 1 : 0;
    const isScheduled = convo.isScheduled || convo.id?.startsWith("scheduled_") ? 1 : 0;

    const diffStatsJson = convo.diffStats ? JSON.stringify(convo.diffStats) : null;
    const previous = this.getConversation(convo.id);
    const telemetry = mergeTelemetry(previous?.telemetry, convo.telemetry);
    const telemetryJson = telemetry ? JSON.stringify(telemetry) : null;
    const contextUsage = telemetry?.context ?? convo.contextUsage ?? previous?.contextUsage;
    const contextUsageJson = contextUsage ? JSON.stringify(contextUsage) : null;

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, project, is_pinned, is_archived, is_scheduled, created_at, updated_at, model, mode, diff_stats, context_usage, telemetry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        project = excluded.project,
        is_pinned = excluded.is_pinned,
        is_archived = excluded.is_archived,
        is_scheduled = excluded.is_scheduled,
        updated_at = excluded.updated_at,
        model = excluded.model,
        mode = excluded.mode,
        diff_stats = excluded.diff_stats,
        context_usage = excluded.context_usage,
        telemetry = excluded.telemetry
    `);

    stmt.run(
      convo.id,
      convo.title,
      convo.project || "Outside Project",
      isPinned,
      isArchived,
      isScheduled,
      createdAt,
      updatedAt,
      convo.model || null,
      convo.mode || null,
      diffStatsJson,
      contextUsageJson,
      telemetryJson
    );

    // Sync messages
    if (Array.isArray(convo.messages)) {
      this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(convo.id);

      const insertMsg = this.db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, thinking, tool_calls, tool_results, created_at, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < convo.messages.length; i++) {
        const msg = convo.messages[i];
        if (!msg) continue;
        const msgId = msg.id || `${convo.id}_msg_${i}_${Date.now()}`;
        const role = msg.role || "user";
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content || "");
        const thinking = msg.thinking || null;
        const toolCalls = msg.toolCalls ? JSON.stringify(msg.toolCalls) : null;
        const toolResults = msg.toolResults ? JSON.stringify(msg.toolResults) : null;
        const msgCreatedAt = msg.createdAt || createdAt + i;
        const rawJson = JSON.stringify(msg);

        insertMsg.run(
          msgId,
          convo.id,
          role,
          content,
          thinking,
          toolCalls,
          toolResults,
          msgCreatedAt,
          rawJson
        );
      }
    }

    // Ensure brain directory and append to transcript.jsonl
    this.ensureBrainTranscript(convo);
  }

  /** Stream telemetry updates never rewrite messages or conversation metadata. */
  public recordTelemetry(conversationId: string, event: unknown): void {
    const row = this.db.prepare("SELECT telemetry FROM conversations WHERE id = ?").get(conversationId) as { telemetry?: string } | undefined;
    if (!row) return;
    let previous: ChatTelemetry | undefined;
    try {
      const parsed = row.telemetry ? JSON.parse(row.telemetry) : undefined;
      if (parsed?.version === 1 && parsed.requests && typeof parsed.requests === "object" && !Array.isArray(parsed.requests)) {
        previous = parsed;
      }
    } catch {}
    previous ??= telemetryForHistory(this.getConversation(conversationId)?.messages ?? []);
    const telemetry = reduceTelemetry(previous, event);
    this.db.prepare("UPDATE conversations SET telemetry = ?, context_usage = COALESCE(?, context_usage) WHERE id = ?")
      .run(JSON.stringify(telemetry), telemetry.context ? JSON.stringify(telemetry.context) : null, conversationId);
  }

  public deleteConversation(id: string): void {
    this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);

    // Clean up brain directory if exists
    try {
      const convoBrain = path.join(this.brainDir, id);
      if (fs.existsSync(convoBrain)) {
        fs.rmSync(convoBrain, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn("[ConversationDB] Failed to remove brain directory for", id, e);
    }
  }

  public renameConversation(id: string, title: string): void {
    this.db
      .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(title.trim(), Date.now(), id);
  }

  public archiveConversation(id: string): void {
    this.db
      .prepare("UPDATE conversations SET is_archived = 1, updated_at = ? WHERE id = ?")
      .run(Date.now(), id);
  }

  public unarchiveConversation(id: string): void {
    this.db
      .prepare("UPDATE conversations SET is_archived = 0, updated_at = ? WHERE id = ?")
      .run(Date.now(), id);
  }

  public pinConversation(id: string, isPinned: boolean): void {
    this.db
      .prepare("UPDATE conversations SET is_pinned = ?, updated_at = ? WHERE id = ?")
      .run(isPinned ? 1 : 0, Date.now(), id);
  }

  public pinProject(projectName: string, isPinned: boolean): void {
    if (isPinned) {
      this.db
        .prepare(`
          INSERT INTO project_pins (project_name, is_pinned, updated_at)
          VALUES (?, 1, ?)
          ON CONFLICT(project_name) DO UPDATE SET is_pinned = 1, updated_at = excluded.updated_at
        `)
        .run(projectName, Date.now());
    } else {
      this.db.prepare("DELETE FROM project_pins WHERE project_name = ?").run(projectName);
    }
  }

  public getProjectPins(): string[] {
    const rows = this.db
      .prepare("SELECT project_name FROM project_pins WHERE is_pinned = 1 ORDER BY updated_at ASC")
      .all() as any[];
    return rows.map((r) => r.project_name);
  }

  public appendTranscriptEvent(conversationId: string, event: any): void {
    try {
      const logsDir = path.join(this.brainDir, conversationId, ".system_generated", "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const transcriptPath = path.join(logsDir, "events.jsonl");
      const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + "\n";
      fs.appendFileSync(transcriptPath, line, "utf-8");
    } catch (err) {
      console.warn("[ConversationDB] Failed to append transcript event:", err);
    }
  }

  public importLegacyConversations(convos: ConversationRecord[]): void {
    for (const c of convos) {
      if (!c.id) continue;
      const existing = this.db.prepare("SELECT id FROM conversations WHERE id = ?").get(c.id);
      if (!existing) {
        this.saveConversation(c);
      }
    }
  }

  private hydrateConversation(row: any): ConversationRecord {
    let diffStats = undefined;
    let contextUsage = undefined;
    let telemetry: ChatTelemetry | undefined;
    try {
      if (row.telemetry) telemetry = JSON.parse(row.telemetry);
    } catch {}
    try {
      if (row.diff_stats) diffStats = JSON.parse(row.diff_stats);
    } catch {}
    try {
      if (row.context_usage) contextUsage = JSON.parse(row.context_usage);
    } catch {}

    const msgRows = this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(row.id) as any[];

    const messages: StoredMessage[] = msgRows.map((m) => {
      if (m.raw_json) {
        try {
          return JSON.parse(m.raw_json);
        } catch {}
      }
      let toolCalls = undefined;
      let toolResults = undefined;
      try {
        if (m.tool_calls) toolCalls = JSON.parse(m.tool_calls);
      } catch {}
      try {
        if (m.tool_results) toolResults = JSON.parse(m.tool_results);
      } catch {}

      return {
        id: m.id,
        role: m.role,
        content: m.content,
        thinking: m.thinking || undefined,
        toolCalls,
        toolResults,
        createdAt: m.created_at,
      };
    });

    const isScheduled = Boolean(
      row.is_scheduled ||
      row.id?.startsWith("scheduled_") ||
      row.title?.startsWith("[Scheduled]")
    );
    let title = row.title;
    if (title && title.startsWith("[Scheduled]")) {
      title = title.replace(/^\[Scheduled\]\s*/i, "");
    }

    return {
      id: row.id,
      title,
      project: row.project,
      isPinned: Boolean(row.is_pinned),
      isArchived: Boolean(row.is_archived),
      isScheduled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      model: row.model || undefined,
      mode: row.mode || undefined,
      diffStats,
      contextUsage,
      telemetry,
      messages,
    };
  }

  private ensureBrainTranscript(convo: ConversationRecord): void {
    try {
      const logsDir = path.join(this.brainDir, convo.id, ".system_generated", "logs");
      const scratchDir = path.join(this.brainDir, convo.id, "scratch");
      const userUploadedDir = path.join(this.brainDir, convo.id, ".user_uploaded");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      if (!fs.existsSync(userUploadedDir)) {
        fs.mkdirSync(userUploadedDir, { recursive: true });
      }

      if (convo.messages && convo.messages.length > 0) {
        const fullTranscript = path.join(logsDir, "transcript_full.jsonl");
        const compactTranscript = path.join(logsDir, "transcript.jsonl");

        const fullLines = convo.messages
          .map((m, idx) =>
            JSON.stringify({
              step_index: idx,
              source: m.role === "user" ? "USER_EXPLICIT" : "MODEL",
              type: m.role === "user" ? "USER_INPUT" : "PLANNER_RESPONSE",
              content: m.content || "",
              thinking: m.thinking || undefined,
              trace_steps: m.traceSteps,
              duration_ms: m.durationMs,
              tool_calls: m.toolCalls && m.toolCalls.length > 0 ? m.toolCalls : undefined,
              tool_results: m.toolResults && m.toolResults.length > 0 ? m.toolResults : undefined,
              mutations: m.mutations && m.mutations.length > 0 ? m.mutations : undefined,
              created_at: new Date(m.createdAt || convo.createdAt).toISOString(),
            })
          )
          .join("\n");
        fs.writeFileSync(fullTranscript, fullLines + "\n", "utf-8");

        const compactLines = convo.messages
          .map((m, idx) => {
            const hasLongContent = typeof m.content === "string" && m.content.length > 300;
            const hasLongThinking = typeof m.thinking === "string" && m.thinking.length > 300;
            const truncated: string[] = [];
            if (hasLongContent) truncated.push("content");
            if (hasLongThinking) truncated.push("thinking");

            return JSON.stringify({
              step_index: idx,
              source: m.role === "user" ? "USER_EXPLICIT" : "MODEL",
              type: m.role === "user" ? "USER_INPUT" : "PLANNER_RESPONSE",
              content: hasLongContent && typeof m.content === "string" ? m.content.slice(0, 300) + "..." : m.content || "",
              thinking: hasLongThinking && typeof m.thinking === "string" ? m.thinking.slice(0, 300) + "..." : m.thinking || undefined,
              tool_calls: m.toolCalls && m.toolCalls.length > 0 ? m.toolCalls : undefined,
              truncated_fields: truncated.length > 0 ? truncated : undefined,
              created_at: new Date(m.createdAt || convo.createdAt).toISOString(),
            });
          })
          .join("\n");
        fs.writeFileSync(compactTranscript, compactLines + "\n", "utf-8");
      }
    } catch (e) {
      console.warn("[ConversationDB] Failed to ensure brain transcript:", e);
    }
  }
}
