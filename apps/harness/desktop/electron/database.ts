import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { TranscriptWriter } from "./transcript-writer";
import { DatabaseSync } from "node:sqlite";
import { mergeTelemetry, reduceTelemetry, telemetryForHistory, type ChatTelemetry } from "../src/lib/chat-telemetry";
import type { ConversationRightPaneState, ConversationUiPatch, SideConversationItem } from "../src/lib/conversation-store";
import { modelRequestToLog, type LocalRequestLog } from "../src/lib/usage-logs";

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
  rightPaneState?: ConversationRightPaneState;
  sideConversations?: SideConversationItem[];
}

export class ConversationDatabase {
  private db: DatabaseSync;
  private harnessHome: string;
  private brainDir: string;
  private transcriptWriter = new TranscriptWriter();
  private deletedConversations = new Set<string>();

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

  /** UI updates must never replace a transcript or another side conversation. */
  updateConversationUi(id: string, patch: ConversationUiPatch): boolean {
    const stored = this.getConversation(id);
    if (!stored) return false;
    const rightPaneState = patch.rightPaneState ?? stored.rightPaneState;
    let sideConversations = stored.sideConversations;
    if (patch.sideConversation) {
      if (patch.sideConversation.parentConversationId !== id) throw new Error("REMOTE_INVALID_ARGUMENT");
      sideConversations = [...(sideConversations || [])];
      const index = sideConversations.findIndex(side => side.id === patch.sideConversation!.id);
      if (index < 0) sideConversations.push(patch.sideConversation);
      else sideConversations[index] = patch.sideConversation;
    }
    if (patch.deleteSideConversationId) {
      sideConversations = (sideConversations || []).filter(side => side.id !== patch.deleteSideConversationId);
    }
    if (JSON.stringify(rightPaneState) === JSON.stringify(stored.rightPaneState) &&
        JSON.stringify(sideConversations) === JSON.stringify(stored.sideConversations)) return false;
    this.db.prepare("UPDATE conversations SET right_pane_state = ?, side_conversations = ? WHERE id = ?")
      .run(rightPaneState ? JSON.stringify(rightPaneState) : null, sideConversations ? JSON.stringify(sideConversations) : null, id);
    return true;
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
        context_usage TEXT,
        telemetry TEXT,
        right_pane_state TEXT,
        side_conversations TEXT
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
    try {
      this.db.exec("ALTER TABLE conversations ADD COLUMN right_pane_state TEXT;");
    } catch {}
    try {
      this.db.exec("ALTER TABLE conversations ADD COLUMN side_conversations TEXT;");
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

  /** Sidebar bootstrap must not load the full transcript of every local chat. */
  public listRemoteSummaries(includeArchived = false): ConversationRecord[] {
    const rows = this.db.prepare("SELECT id, title, project, model, mode, is_pinned AS isPinned, is_archived AS isArchived, is_scheduled AS isScheduled, created_at AS createdAt, updated_at AS updatedAt FROM conversations WHERE (? = 1 OR is_archived = 0) AND id NOT LIKE 'side_conversation_%' AND id NOT LIKE 'side_chat_%' ORDER BY updated_at DESC").all(includeArchived ? 1 : 0) as any[];
    return rows.map(row => ({ ...row, isPinned: !!row.isPinned, isArchived: !!row.isArchived, isScheduled: !!row.isScheduled, messages: [], __remoteSummary: true }));
  }

  public searchRemoteConversations(query: string): ConversationRecord[] {
    const text = String(query).slice(0, 200).trim();
    if (text.length < 2) return [];
    const like = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = this.db.prepare("SELECT c.id, c.title, c.project, c.created_at AS createdAt, c.updated_at AS updatedAt, substr(m.content, max(instr(lower(m.content), lower(?)) - 80, 1), 500) AS snippet FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id WHERE c.is_archived = 0 AND c.id NOT LIKE 'side_conversation_%' AND c.id NOT LIKE 'side_chat_%' AND (c.title LIKE ? ESCAPE '\\' OR c.project LIKE ? ESCAPE '\\' OR m.content LIKE ? ESCAPE '\\') GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 100").all(text, like, like, like) as any[];
    return rows.map(({ snippet, ...row }) => ({ ...row, messages: snippet ? [{ role: "assistant", content: snippet }] : [] }));
  }

  public listRemoteProjects(): string[] {
    const rows = this.db.prepare("SELECT DISTINCT project FROM conversations WHERE is_archived = 0 AND project <> 'Outside Project' AND project <> '' AND id NOT LIKE 'side_conversation_%' AND id NOT LIKE 'side_chat_%' LIMIT 200").all() as { project: string }[];
    return rows.map((row) => row.project);
  }

  public getConversation(id: string): ConversationRecord | null {
    const row = this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as any;
    if (!row) return null;
    return this.hydrateConversation(row);
  }

  public saveConversation(convo: ConversationRecord): void {
    if (!convo?.id || this.deletedConversations.has(convo.id) || convo.id.startsWith("side_conversation_") || convo.id.startsWith("side_chat_")) {
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

    const rightPaneState = convo.rightPaneState !== undefined ? convo.rightPaneState : previous?.rightPaneState;
    const rightPaneStateJson = rightPaneState ? JSON.stringify(rightPaneState) : null;
    const sideConversations = convo.sideConversations !== undefined ? convo.sideConversations : previous?.sideConversations;
    const sideConversationsJson = sideConversations ? JSON.stringify(sideConversations) : null;

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, project, is_pinned, is_archived, is_scheduled, created_at, updated_at, model, mode, diff_stats, context_usage, telemetry, right_pane_state, side_conversations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        telemetry = excluded.telemetry,
        right_pane_state = excluded.right_pane_state,
        side_conversations = excluded.side_conversations
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
      telemetryJson,
      rightPaneStateJson,
      sideConversationsJson
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

  /** Export provider usage without exposing conversation transcripts. */
  public listUsageLogs(): LocalRequestLog[] {
    // Usage needs metadata only, including archived tasks. Never transfer all
    // transcripts just to populate a remote activity chart.
    const rows = this.db.prepare("SELECT id, telemetry FROM conversations WHERE telemetry IS NOT NULL").all() as { id: string; telemetry: string }[];
    const logs: LocalRequestLog[] = [];
    for (const row of rows) {
      try {
        const telemetry = JSON.parse(row.telemetry) as ChatTelemetry;
        if (telemetry.version !== 1 || !telemetry.requests || Array.isArray(telemetry.requests)) continue;
        for (const request of Object.values(telemetry.requests)) {
          const log = modelRequestToLog(row.id, request);
          if (log) logs.push(log);
        }
      } catch { /* One damaged historical record must not hide other usage. */ }
    }
    return logs.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Stream telemetry updates never rewrite messages or conversation metadata. */
  public recordTelemetry(conversationId: string, event: unknown): ChatTelemetry | undefined {
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
    return telemetry;
  }

  public async deleteConversation(id: string): Promise<void> {
    // Revoke stale checkpoints and trailing stream events before the first await.
    this.deletedConversations.add(id);
    await this.flushTranscriptEvents(id);
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
    if (this.deletedConversations.has(conversationId)) return;
    try {
      this.transcriptWriter.append(this.transcriptPath(conversationId), event);
    } catch (err) {
      console.warn("[ConversationDB] Failed to append transcript event:", err);
    }
  }

  private transcriptPath(conversationId: string): string {
    return path.join(this.brainDir, conversationId, ".system_generated", "logs", "events.jsonl");
  }

  public flushTranscriptEvents(conversationId?: string): Promise<void> {
    return this.transcriptWriter.flush(conversationId ? this.transcriptPath(conversationId) : undefined);
  }

  public closeTranscriptEvents(): Promise<void> {
    return this.transcriptWriter.close();
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
    let rightPaneState = undefined;
    let sideConversations = undefined;
    try {
      if (row.telemetry) telemetry = JSON.parse(row.telemetry);
    } catch {}
    try {
      if (row.diff_stats) diffStats = JSON.parse(row.diff_stats);
    } catch {}
    try {
      if (row.context_usage) contextUsage = JSON.parse(row.context_usage);
    } catch {}
    try {
      if (row.right_pane_state) rightPaneState = JSON.parse(row.right_pane_state);
    } catch {}
    try {
      if (row.side_conversations) sideConversations = JSON.parse(row.side_conversations);
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
      rightPaneState,
      sideConversations,
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
