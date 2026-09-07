import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type ScheduledTaskScheduleKind =
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "custom";

export interface ScheduledTaskSchedule {
  kind?: ScheduledTaskScheduleKind;
  type?: ScheduledTaskScheduleKind;
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  cron?: string;
  customInterval?: number;
  customUnit?: "minutes" | "hours" | "days" | "weeks" | "months";
  endsType?: "never" | "date";
  endDate?: string;
  intervalMinutes?: number;
  intervalSeconds?: number;
}

export interface ScheduledTaskItem {
  id: string;
  title: string;
  instructions: string;
  name?: string;
  prompt?: string;
  schedule: ScheduledTaskSchedule;
  workspacePath?: string;
  permissionPreset: "full_access" | "ask_before_changes" | "read-only" | "workspace-write" | "danger-full-access" | "prompt" | "auto" | string;
  model?: string;
  conversationId?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
}

export interface ScheduledTaskRunHistory {
  id: string;
  taskId: string;
  triggeredAt: string;
  source: "scheduled" | "manual";
  status: "completed" | "failed" | "in-progress" | "skipped";
  durationMs: number;
  sessionId?: string;
  error?: string;
}

/**
 * Calculate the next ISO timestamp for a given schedule configuration.
 */
export function calculateNextRunAt(
  schedule: ScheduledTaskSchedule,
  fromMs: number = Date.now()
): string {
  const kind = schedule.kind || schedule.type || "daily";
  if (kind === "hourly") {
    const next = new Date(fromMs);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next.toISOString();
  }

  const parseTime = (timeStr?: string): { hour: number; minute: number } => {
    if (!timeStr) return { hour: 9, minute: 0 };
    const parts = timeStr.split(":");
    return {
      hour: Number.parseInt(parts[0] ?? "9", 10),
      minute: Number.parseInt(parts[1] ?? "0", 10),
    };
  };

  const { hour, minute } = parseTime(schedule.time);

  if (kind === "daily") {
    const target = new Date(fromMs);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= fromMs) {
      target.setDate(target.getDate() + 1);
    }
    return target.toISOString();
  }

  if (kind === "weekdays") {
    const target = new Date(fromMs);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= fromMs) {
      target.setDate(target.getDate() + 1);
    }
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() + 1);
    }
    return target.toISOString();
  }

  if (kind === "weekly") {
    const targetDay = schedule.dayOfWeek ?? 1;
    const target = new Date(fromMs);
    target.setHours(hour, minute, 0, 0);
    let daysUntil = (targetDay - target.getDay() + 7) % 7;
    if (daysUntil === 0 && target.getTime() <= fromMs) {
      daysUntil = 7;
    }
    target.setDate(target.getDate() + daysUntil);
    return target.toISOString();
  }

  if (kind === "monthly") {
    const targetDay = Math.min(31, Math.max(1, schedule.dayOfMonth ?? 1));
    const target = new Date(fromMs);
    target.setDate(targetDay);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= fromMs) {
      target.setMonth(target.getMonth() + 1);
      target.setDate(targetDay);
    }
    return target.toISOString();
  }

  let intervalMinutes = schedule.intervalMinutes;
  if (!intervalMinutes && schedule.customInterval) {
    const unit = schedule.customUnit || "days";
    if (unit === "minutes") intervalMinutes = schedule.customInterval;
    else if (unit === "hours") intervalMinutes = schedule.customInterval * 60;
    else if (unit === "days") intervalMinutes = schedule.customInterval * 1440;
    else if (unit === "weeks") intervalMinutes = schedule.customInterval * 10080;
    else if (unit === "months") intervalMinutes = schedule.customInterval * 43200;
  }
  if (!intervalMinutes && schedule.intervalSeconds) {
    intervalMinutes = Math.round(schedule.intervalSeconds / 60);
  }
  if (!intervalMinutes) intervalMinutes = 60;

  if (schedule.time && intervalMinutes >= 1440) {
    const days = Math.round(intervalMinutes / 1440);
    const target = new Date(fromMs);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= fromMs) {
      target.setDate(target.getDate() + days);
    }
    return target.toISOString();
  }

  return new Date(fromMs + intervalMinutes * 60 * 1000).toISOString();
}

export interface ScheduledTasksManagerDeps {
  executeTaskRunner: (task: ScheduledTaskItem) => Promise<{ sessionId?: string }>;
  onChanged?: () => void;
}

export class ScheduledTasksManager {
  private tasks: ScheduledTaskItem[] = [];
  private historyList: ScheduledTaskRunHistory[] = [];
  private runningIds = new Set<string>();
  private loaded = false;
  private timer: NodeJS.Timeout | undefined;
  private dir: string;

  constructor(
    storageDir: string,
    private readonly deps: ScheduledTasksManagerDeps
  ) {
    this.dir = storageDir;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    try {
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }

      const tasksPath = path.join(this.dir, "tasks.json");
      const legacyAutomationsPath = path.join(this.dir, "automations.json");
      const historyPath = path.join(this.dir, "history.json");

      // Load tasks (check tasks.json, fallback to automations.json migration)
      if (fs.existsSync(tasksPath)) {
        try {
          this.tasks = JSON.parse(fs.readFileSync(tasksPath, "utf-8"));
        } catch {
          this.tasks = [];
        }
      } else if (fs.existsSync(legacyAutomationsPath)) {
        try {
          this.tasks = JSON.parse(fs.readFileSync(legacyAutomationsPath, "utf-8"));
        } catch {
          this.tasks = [];
        }
      } else {
        this.tasks = [];
      }

      if (fs.existsSync(historyPath)) {
        try {
          this.historyList = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
        } catch {
          this.historyList = [];
        }
      } else {
        this.historyList = [];
      }
    } catch {
      this.tasks = [];
      this.historyList = [];
    }
    this.loaded = true;
  }

  private persist(): void {
    try {
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.dir, "tasks.json"),
        JSON.stringify(this.tasks, null, 2),
        "utf-8"
      );
      fs.writeFileSync(
        path.join(this.dir, "history.json"),
        JSON.stringify(this.historyList, null, 2),
        "utf-8"
      );
    } catch (err) {
      console.warn("[ScheduledTasksManager] Failed to persist tasks/history:", err);
    }
  }

  start(): void {
    if (this.timer) return;
    this.ensureLoaded();
    console.log("[ScheduledTasksManager] Starting scheduled tasks background ticker (30s)");
    this.timer = setInterval(() => {
      void this.checkDueSchedules();
    }, 30_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      console.log("[ScheduledTasksManager] Stopped scheduled tasks ticker");
    }
  }

  listTasks(): ScheduledTaskItem[] {
    this.ensureLoaded();
    return [...this.tasks];
  }

  createTask(data: {
    title?: string;
    name?: string;
    instructions?: string;
    prompt?: string;
    schedule: ScheduledTaskSchedule;
    workspacePath?: string;
    permissionPreset?: ScheduledTaskItem["permissionPreset"];
    model?: string;
    conversationId?: string;
  }): ScheduledTaskItem {
    this.ensureLoaded();
    const id = `task_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const nextRunAt = calculateNextRunAt(data.schedule);
    const title = data.title || data.name || "Untitled Scheduled Task";
    const instructions = data.instructions || data.prompt || "";
    const item: ScheduledTaskItem = {
      id,
      title,
      name: title,
      instructions,
      prompt: instructions,
      schedule: data.schedule,
      permissionPreset: data.permissionPreset ?? "full_access",
      enabled: true,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      nextRunAt,
      ...(data.workspacePath !== undefined ? { workspacePath: data.workspacePath } : {}),
      ...(data.model !== undefined ? { model: data.model } : {}),
      ...(data.conversationId !== undefined ? { conversationId: data.conversationId } : {}),
    };
    this.tasks.unshift(item);
    this.persist();
    this.deps.onChanged?.();
    return item;
  }

  updateTask(data: {
    id: string;
    title?: string;
    name?: string;
    instructions?: string;
    prompt?: string;
    schedule?: ScheduledTaskSchedule;
    workspacePath?: string;
    permissionPreset?: ScheduledTaskItem["permissionPreset"];
    model?: string;
    conversationId?: string;
    enabled?: boolean;
  }): ScheduledTaskItem | null {
    this.ensureLoaded();
    const idx = this.tasks.findIndex((t) => t.id === data.id);
    if (idx === -1) return null;

    const existing = this.tasks[idx];
    if (!existing) return null;

    const scheduleChanged =
      data.schedule &&
      JSON.stringify(data.schedule) !== JSON.stringify(existing.schedule);
    const now = new Date().toISOString();

    const title = data.title ?? data.name;
    const instructions = data.instructions ?? data.prompt;

    const updated: ScheduledTaskItem = {
      ...existing,
      ...(title !== undefined ? { title, name: title } : {}),
      ...(instructions !== undefined ? { instructions, prompt: instructions } : {}),
      ...(data.schedule !== undefined ? { schedule: data.schedule } : {}),
      ...(data.workspacePath !== undefined ? { workspacePath: data.workspacePath } : {}),
      ...(data.permissionPreset !== undefined
        ? { permissionPreset: data.permissionPreset }
        : {}),
      ...(data.model !== undefined ? { model: data.model } : {}),
      ...(data.conversationId !== undefined ? { conversationId: data.conversationId } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      updatedAt: now,
    };

    if (scheduleChanged || (data.enabled === true && !existing.enabled)) {
      updated.nextRunAt = calculateNextRunAt(updated.schedule);
    }

    this.tasks[idx] = updated;
    this.persist();
    this.deps.onChanged?.();
    return updated;
  }

  deleteTask(id: string): boolean {
    this.ensureLoaded();
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    this.persist();
    this.deps.onChanged?.();
    return true;
  }

  getHistory(taskId?: string): ScheduledTaskRunHistory[] {
    this.ensureLoaded();
    if (!taskId) return [...this.historyList];
    return this.historyList.filter((h) => h.taskId === taskId);
  }

  deleteRun(runId: string): boolean {
    this.ensureLoaded();
    const idx = this.historyList.findIndex((h) => h.id === runId);
    if (idx === -1) return false;
    this.historyList.splice(idx, 1);
    this.persist();
    this.deps.onChanged?.();
    return true;
  }

  private static readonly MAX_HISTORY_ITEMS = 500;

  private async checkDueSchedules(): Promise<void> {
    this.ensureLoaded();
    const now = Date.now();
    for (const item of this.tasks) {
      if (!item.enabled || !item.nextRunAt) continue;
      if (this.runningIds.has(item.id)) continue;

      // Automatically disable task if schedule end date has expired
      if (item.schedule?.endsType === "date" && item.schedule?.endDate) {
        const endMs = Date.parse(item.schedule.endDate);
        if (!Number.isNaN(endMs) && now > endMs) {
          item.enabled = false;
          this.persist();
          this.deps.onChanged?.();
          continue;
        }
      }

      const dueTime = Date.parse(item.nextRunAt);
      if (!Number.isNaN(dueTime) && dueTime <= now) {
        // Advance nextRunAt immediately to prevent double execution on subsequent ticks
        item.nextRunAt = calculateNextRunAt(item.schedule, now + 1000);
        this.persist();
        void this.executeTask(item.id, "scheduled");
      }
    }
  }

  async executeTask(
    id: string,
    source: "scheduled" | "manual"
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    this.ensureLoaded();
    const item = this.tasks.find((t) => t.id === id);
    if (!item) {
      return { success: false, error: `Scheduled task "${id}" not found` };
    }

    if (this.runningIds.has(item.id)) {
      return { success: false, error: `Scheduled task "${id}" is already running` };
    }
    this.runningIds.add(item.id);

    const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
    const startTime = Date.now();
    const historyEntry: ScheduledTaskRunHistory = {
      id: runId,
      taskId: item.id,
      triggeredAt: new Date(startTime).toISOString(),
      source,
      status: "in-progress",
      durationMs: 0,
    };
    this.historyList.unshift(historyEntry);
    if (this.historyList.length > ScheduledTasksManager.MAX_HISTORY_ITEMS) {
      this.historyList = this.historyList.slice(0, ScheduledTasksManager.MAX_HISTORY_ITEMS);
    }

    item.runCount += 1;
    item.lastRunAt = new Date().toISOString();
    item.nextRunAt = calculateNextRunAt(item.schedule, startTime + 1000);
    this.persist();
    this.deps.onChanged?.();

    try {
      console.log(`[ScheduledTasksManager] Running task "${item.title}" (${source})`);
      const res = await this.deps.executeTaskRunner(item);
      const durationMs = Date.now() - startTime;
      historyEntry.status = "completed";
      historyEntry.durationMs = durationMs;
      historyEntry.sessionId = res.sessionId;
      if (res.sessionId && item.conversationId !== res.sessionId) {
        item.conversationId = res.sessionId;
      }
      this.persist();
      this.deps.onChanged?.();
      return { success: true, sessionId: res.sessionId };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      historyEntry.status = "failed";
      historyEntry.durationMs = durationMs;
      historyEntry.error = err?.message || String(err);
      this.persist();
      this.deps.onChanged?.();
      return { success: false, error: historyEntry.error };
    } finally {
      this.runningIds.delete(item.id);
    }
  }
}
