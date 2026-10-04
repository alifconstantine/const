import React, { useState, useEffect } from "react";
import { ArrowLeft, Minus, Square, Copy, X } from "lucide-react";
import { toast, ScrollArea } from "@const/ui";
import type { ScheduledTaskItem, ScheduledTaskRunHistory } from "../../vite-env";
import {
  ScheduledTasksDashboard,
  type StarterTemplate,
} from "./scheduled-tasks-dashboard";
import {
  ScheduledTaskForm,
  type ScheduledTaskFormData,
} from "./scheduled-task-form";
import { ScheduledTaskHistory } from "./scheduled-task-history";

export interface ScheduledTasksViewProps {
  onBackToWorkspace: () => void;
  onOpenSession?: (sessionId: string) => void;
  currentWorkspacePath?: string;
}

export function ScheduledTasksView({
  onBackToWorkspace,
  onOpenSession,
  currentWorkspacePath,
}: ScheduledTasksViewProps): React.JSX.Element {
  const [view, setView] = useState<"dashboard" | "create" | "settings" | "history">("dashboard");
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<ScheduledTaskItem | null>(null);
  const [historyList, setHistoryList] = useState<ScheduledTaskRunHistory[]>([]);
  const [prefillValues, setPrefillValues] = useState<Partial<ScheduledTaskItem> | undefined>(undefined);
  const [formTaskName, setFormTaskName] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  // Window maximized state & listener
  useEffect(() => {
    window.electron?.isMaximized?.().then((max) => setIsMaximized(Boolean(max)));
    const cleanup = window.electron?.onMaximizedChange?.((max) => {
      setIsMaximized(max);
    });
    return () => {
      cleanup?.();
    };
  }, []);

  const handleMinimize = () => window.electron?.minimize?.();
  const handleMaximize = () => window.electron?.maximize?.();
  const handleClose = () => window.electron?.close?.();

  // Refresh tasks
  const refreshTasks = async () => {
    if (!window.electron?.scheduledTasks?.list) return;
    try {
      const items = await window.electron.scheduledTasks.list();
      setTasks(items || []);
    } catch (err: any) {
      console.error("Failed to list scheduled tasks:", err);
    }
  };

  // Refresh history for task
  const refreshHistory = async (taskId?: string) => {
    if (!window.electron?.scheduledTasks?.history) return;
    try {
      const history = await window.electron.scheduledTasks.history(taskId);
      setHistoryList(history || []);
    } catch (err: any) {
      console.error("Failed to get task history:", err);
    }
  };

  // Initial load & listeners
  useEffect(() => {
    void refreshTasks();

    const unsubscribe = window.electron?.scheduledTasks?.onChanged?.(() => {
      void refreshTasks();
      if (selectedTask) {
        void refreshHistory(selectedTask.id);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [selectedTask]);

  // Load history when viewing history or settings
  useEffect(() => {
    if (selectedTask && (view === "history" || view === "settings")) {
      void refreshHistory(selectedTask.id);
    }
  }, [selectedTask, view]);

  // Actions
  const handleRunNow = async (taskId: string) => {
    if (!window.electron?.scheduledTasks?.run) return;
    try {
      toast.info("Scheduled task execution started");
      await window.electron.scheduledTasks.run(taskId);
      await refreshTasks();
      if (selectedTask?.id === taskId) {
        await refreshHistory(taskId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to run scheduled task");
    }
  };

  const handleSelectTemplate = (template: StarterTemplate) => {
    setSelectedTask(null);
    setFormTaskName(template.title);
    setPrefillValues({
      name: template.title,
      prompt: template.instructions,
      schedule: template.schedule,
      permissionPreset: "full_access",
      workspacePath: currentWorkspacePath,
    });
    setView("create");
  };

  const handleSelectTask = (task: ScheduledTaskItem) => {
    setSelectedTask(task);
    setFormTaskName(task.name || task.title || "");
    setView("settings");
  };

  const handleCreateSubmit = async (data: ScheduledTaskFormData) => {
    if (!window.electron?.scheduledTasks?.create) return;
    try {
      await window.electron.scheduledTasks.create(data);
      toast.success("Scheduled task created");
      await refreshTasks();
      setView("dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create scheduled task");
    }
  };

  const handleUpdateSubmit = async (data: ScheduledTaskFormData) => {
    if (!selectedTask || !window.electron?.scheduledTasks?.update) return;
    try {
      const updated = await window.electron.scheduledTasks.update({
        id: selectedTask.id,
        ...data,
      });
      if (updated) {
        setSelectedTask(updated);
      }
      toast.success("Scheduled task updated");
      await refreshTasks();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update scheduled task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.electron?.scheduledTasks?.delete) return;
    try {
      await window.electron.scheduledTasks.delete(taskId);
      toast.success("Scheduled task deleted");
      await refreshTasks();
      setSelectedTask(null);
      setView("dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete scheduled task");
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!window.electron?.scheduledTasks?.deleteRun) return;
    try {
      await window.electron.scheduledTasks.deleteRun(runId);
      if (selectedTask) {
        await refreshHistory(selectedTask.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete run");
    }
  };

  return (
    <div className="relative w-full h-full bg-[#161616] text-[#d4d4d4] flex flex-col select-none font-sans overflow-hidden">
      {/* Top Header Drag & Window Controls Strip */}
      <div
        className="h-10 shrink-0 flex items-center justify-between px-4 select-none relative z-30"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* Left: Back to workspace or Task Breadcrumb */}
        <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} className="flex items-center gap-1.5 text-[13px]">
          {view === "dashboard" ? (
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="flex items-center gap-1.5 text-xs text-[#969696] hover:text-white hover:bg-[#222222] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to workspace</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(null);
                  setFormTaskName("");
                  setView("dashboard");
                }}
                className="inline-flex items-center gap-1.5 text-[#969696] hover:text-white hover:bg-[#222222] px-2 py-1 rounded-md transition-colors cursor-pointer"
                title="Back to Scheduled Tasks"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Scheduled Tasks</span>
              </button>
              <span className="text-[#5d5d5d] select-none">/</span>
              <span className="text-[#d4d4d4] font-medium px-1 truncate max-w-[240px]">
                {view === "create"
                  ? (formTaskName.trim() || "New task")
                  : view === "history"
                  ? (selectedTask?.name || selectedTask?.title || "History")
                  : (formTaskName.trim() || selectedTask?.name || selectedTask?.title || "Edit task")}
              </span>
            </div>
          )}
        </div>

        {/* Right: Window Controls */}
        <div
          className="flex items-center gap-0.5 text-[#969696] shrink-0 ml-auto"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e81123] hover:text-white transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Subview Routing wrapped in ScrollArea */}
      <ScrollArea className="flex-1 w-full min-h-0" thumbClassName="bg-white/20 hover:bg-white/30">
        {view === "dashboard" && (
          <ScheduledTasksDashboard
            tasks={tasks}
            onCreateNew={() => {
              setSelectedTask(null);
              setFormTaskName("");
              setPrefillValues(
                currentWorkspacePath
                  ? { workspacePath: currentWorkspacePath, permissionPreset: "full_access" }
                  : { permissionPreset: "full_access" }
              );
              setView("create");
            }}
            onSelectTemplate={handleSelectTemplate}
            onSelectTask={handleSelectTask}
            onRunNow={(id) => void handleRunNow(id)}
            onRefresh={() => void refreshTasks()}
          />
        )}

        {view === "create" && (
          <ScheduledTaskForm
            initialValues={prefillValues}
            isEditing={false}
            onSubmit={(vals) => void handleCreateSubmit(vals)}
            onCancel={() => {
              setView("dashboard");
              setFormTaskName("");
            }}
            onNameChange={setFormTaskName}
          />
        )}

        {(view === "settings" || view === "history") && selectedTask && (
          <ScheduledTaskForm
            task={selectedTask}
            initialValues={selectedTask}
            isEditing={true}
            activeSubTab={view}
            onSubTabChange={(tab) => setView(tab)}
            onSubmit={(vals) => void handleUpdateSubmit(vals)}
            onCancel={() => {
              setView("dashboard");
              setSelectedTask(null);
              setFormTaskName("");
            }}
            onNameChange={setFormTaskName}
            historyList={historyList}
            onRunNow={(id) => void handleRunNow(id)}
            onDeleteTask={(id) => void handleDeleteTask(id)}
            onOpenSession={(id) => onOpenSession?.(id)}
            onDeleteRun={(runId) => void handleDeleteRun(runId)}
          />
        )}
      </ScrollArea>
    </div>
  );
}
