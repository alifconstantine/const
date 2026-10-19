import { useState, useEffect, useCallback } from "react";

export type ShortcutScope = "Global" | "Composer";

export interface ShortcutItem {
  id: string;
  command: string;
  keybindings: string[][];
  scope: ShortcutScope;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: ShortcutItem[] = [
  {
    id: "open_command_center",
    command: "Open Command Center",
    keybindings: [["Ctrl", "K"], ["Ctrl", "Shift", "P"]],
    scope: "Global",
  },
  {
    id: "open_settings",
    command: "Open Settings",
    keybindings: [["Ctrl", ","]],
    scope: "Global",
  },
  {
    id: "find_in_task",
    command: "Find in Task",
    keybindings: [["Ctrl", "F"]],
    scope: "Global",
  },
  {
    id: "toggle_sidebar",
    command: "Toggle Sidebar",
    keybindings: [["Ctrl", "B"]],
    scope: "Global",
  },
  {
    id: "toggle_theme",
    command: "Toggle Light/Dark Theme",
    keybindings: [["Ctrl", "Shift", "L"]],
    scope: "Global",
  },
  {
    id: "toggle_terminal",
    command: "Toggle Terminal",
    keybindings: [["Ctrl", "J"]],
    scope: "Global",
  },
  {
    id: "toggle_side_pane",
    command: "Toggle Side Pane",
    keybindings: [["Ctrl", "Alt", "B"]],
    scope: "Global",
  },
  {
    id: "previous_task",
    command: "Previous Task",
    keybindings: [["Ctrl", "Shift", "["]],
    scope: "Global",
  },
  {
    id: "next_task",
    command: "Next Task",
    keybindings: [["Ctrl", "Shift", "]"]],
    scope: "Global",
  },
  {
    id: "navigate_back",
    command: "Navigate Back",
    keybindings: [["Ctrl", "["]],
    scope: "Global",
  },
  {
    id: "navigate_forward",
    command: "Navigate Forward",
    keybindings: [["Ctrl", "]"]],
    scope: "Global",
  },
  {
    id: "open_model_menu",
    command: "Open Model Menu",
    keybindings: [["Ctrl", "M"]],
    scope: "Global",
  },
  {
    id: "cycle_session_mode",
    command: "Cycle Session Mode",
    keybindings: [["Ctrl", "Shift", "M"]],
    scope: "Global",
  },
  {
    id: "cycle_thought_level",
    command: "Cycle Thought Level",
    keybindings: [["Ctrl", "T"]],
    scope: "Global",
  },
  {
    id: "new_task",
    command: "New Task",
    keybindings: [["Ctrl", "N"]],
    scope: "Global",
  },
  {
    id: "open_workspace",
    command: "Open Workspace",
    keybindings: [["Ctrl", "O"]],
    scope: "Global",
  },
  {
    id: "close_current_context",
    command: "Close Current Context",
    keybindings: [["Ctrl", "W"]],
    scope: "Global",
  },
  {
    id: "zoom_in",
    command: "Zoom In",
    keybindings: [["Ctrl", "+"]],
    scope: "Global",
  },
  {
    id: "zoom_out",
    command: "Zoom Out",
    keybindings: [["Ctrl", "-"]],
    scope: "Global",
  },
  {
    id: "reset_zoom",
    command: "Reset Zoom",
    keybindings: [["Ctrl", "0"]],
    scope: "Global",
  },
  {
    id: "send_message",
    command: "Send Message",
    keybindings: [["Enter"]],
    scope: "Composer",
  },
  {
    id: "insert_newline",
    command: "Insert Newline in Composer",
    keybindings: [["Shift", "Enter"]],
    scope: "Composer",
  },
];

const STORAGE_KEY = "const_harness_keyboard_shortcuts";

export function getSavedShortcuts(): ShortcutItem[] {
  if (typeof window === "undefined") return DEFAULT_KEYBOARD_SHORTCUTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYBOARD_SHORTCUTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_KEYBOARD_SHORTCUTS;

    // Merge with defaults in case new commands were added
    const map = new Map<string, ShortcutItem>(parsed.map((item: ShortcutItem) => [item.id, item]));
    return DEFAULT_KEYBOARD_SHORTCUTS.map((def) => {
      const saved = map.get(def.id);
      if (!saved) return def;
      return {
        ...def,
        keybindings: Array.isArray(saved.keybindings) ? saved.keybindings : def.keybindings,
        scope: saved.scope || def.scope,
      };
    });
  } catch {
    return DEFAULT_KEYBOARD_SHORTCUTS;
  }
}

export function saveShortcuts(shortcuts: ShortcutItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    window.dispatchEvent(new CustomEvent("const:shortcuts-changed", { detail: shortcuts }));
  } catch (err) {
    console.error("Failed to save keyboard shortcuts:", err);
  }
}

export function resetShortcuts(): ShortcutItem[] {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent("const:shortcuts-changed", { detail: DEFAULT_KEYBOARD_SHORTCUTS })
      );
    } catch {}
  }
  return DEFAULT_KEYBOARD_SHORTCUTS;
}

export function useKeyboardShortcuts(): {
  shortcuts: ShortcutItem[];
  updateShortcut: (id: string, keybindings: string[][]) => void;
  deleteShortcut: (id: string) => void;
  resetAll: () => void;
} {
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>(getSavedShortcuts);

  useEffect(() => {
    const handleChanged = (e: Event) => {
      const custom = e as CustomEvent<ShortcutItem[]>;
      if (custom.detail) {
        setShortcuts(custom.detail);
      } else {
        setShortcuts(getSavedShortcuts());
      }
    };
    window.addEventListener("const:shortcuts-changed", handleChanged);
    return () => window.removeEventListener("const:shortcuts-changed", handleChanged);
  }, []);

  const updateShortcut = useCallback((id: string, keybindings: string[][]) => {
    setShortcuts((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, keybindings } : s));
      saveShortcuts(next);
      return next;
    });
  }, []);

  const deleteShortcut = useCallback((id: string) => {
    setShortcuts((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, keybindings: [] } : s));
      saveShortcuts(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const def = resetShortcuts();
    setShortcuts(def);
  }, []);

  return { shortcuts, updateShortcut, deleteShortcut, resetAll };
}

export function matchesKeyCombo(e: KeyboardEvent, combo: string[]): boolean {
  if (!combo || combo.length === 0) return false;
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  const hasCtrl = combo.some((k) => k === "Ctrl" || k === "Cmd" || k === "⌘");
  const hasShift = combo.includes("Shift");
  const hasAlt = combo.includes("Alt");

  const ctrlPressed = isMac ? e.metaKey || e.ctrlKey : e.ctrlKey;
  if (hasCtrl !== Boolean(ctrlPressed)) return false;
  if (hasShift !== Boolean(e.shiftKey)) return false;
  if (hasAlt !== Boolean(e.altKey)) return false;

  const mainKey = combo.find((k) => !["Ctrl", "Cmd", "⌘", "Shift", "Alt"].includes(k));
  if (!mainKey) return false;

  const eventKey = e.key;

  if (mainKey === "+" || mainKey === "=") {
    return eventKey === "+" || eventKey === "=" || e.code === "Equal";
  }
  if (mainKey === "-" || mainKey === "_") {
    return eventKey === "-" || eventKey === "_" || e.code === "Minus";
  }
  if (mainKey === "[") {
    return eventKey === "[" || eventKey === "{" || e.code === "BracketLeft";
  }
  if (mainKey === "]") {
    return eventKey === "]" || eventKey === "}" || e.code === "BracketRight";
  }
  if (mainKey === ",") {
    return eventKey === "," || e.code === "Comma";
  }
  if (mainKey === "0") {
    return eventKey === "0" || e.code === "Digit0";
  }
  if (mainKey === "Enter") {
    return eventKey === "Enter";
  }
  if (mainKey === "Esc" || mainKey === "Escape") {
    return eventKey === "Escape";
  }

  return eventKey.toLowerCase() === mainKey.toLowerCase();
}

export function matchesShortcutCommand(
  e: KeyboardEvent,
  commandId: string,
  shortcutsList: ShortcutItem[] = getSavedShortcuts()
): boolean {
  const item = shortcutsList.find((s) => s.id === commandId);
  if (!item || !item.keybindings || item.keybindings.length === 0) return false;
  return item.keybindings.some((combo) => matchesKeyCombo(e, combo));
}
