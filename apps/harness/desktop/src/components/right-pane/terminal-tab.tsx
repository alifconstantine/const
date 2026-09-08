import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { RightPaneTab } from "./types";

interface TerminalTabProps {
  tab: RightPaneTab;
}

export function TerminalTab({ tab }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create xterm instance with clean aesthetic matching Image 1
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
      fontSize: 12.5,
      lineHeight: 1.25,
      theme: {
        background: "#101010",
        foreground: "#d4d4d4",
        cursor: "#ededed",
        selectionBackground: "rgba(255, 255, 255, 0.2)",
        black: "#1c1c1c",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e5e5e5",
        brightBlack: "#4b5563",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#fde047",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff",
      },
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    try {
      fitAddon.fit();
    } catch {}

    // 1. Hook up user keyboard input to Electron IPC
    const onDataDisposable = term.onData((data) => {
      window.electron?.terminal?.write({ id: tab.id, data });
    });

    // 2. Hook up output from backend shell to xterm
    const cleanupOnData = window.electron?.terminal?.onData((payload) => {
      if (payload.id === tab.id) {
        term.write(payload.data);
      }
    });

    const cleanupOnExit = window.electron?.terminal?.onExit((payload) => {
      if (payload.id === tab.id) {
        term.writeln(`\r\n\x1b[90m[Process exited with code ${payload.code}]\x1b[0m`);
      }
    });

    // 3. Initialize terminal session in backend
    window.electron?.terminal?.create({
      id: tab.id,
      cwd: tab.cwd,
      project: tab.project,
      conversationId: tab.conversationId,
      cols: term.cols,
      rows: term.rows,
    });

    // Handle container resizing smoothly with ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {}
      });
    });

    resizeObserver.observe(containerRef.current);

    // Focus terminal on mount and initial render
    const focusTimer = setTimeout(() => {
      term.focus();
      (term as any).textarea?.focus();
    }, 150);

    return () => {
      clearTimeout(focusTimer);
      onDataDisposable.dispose();
      cleanupOnData?.();
      cleanupOnExit?.();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [tab.id, tab.cwd]);

  return (
    <div
      className="flex-1 w-full h-full p-2 bg-[#101010] overflow-hidden select-text cursor-text"
      onMouseDown={() => {
        termRef.current?.focus();
        (termRef.current as any)?.textarea?.focus();
      }}
      onClick={() => {
        termRef.current?.focus();
        (termRef.current as any)?.textarea?.focus();
      }}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
