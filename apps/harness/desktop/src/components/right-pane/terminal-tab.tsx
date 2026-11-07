import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { RightPaneTab } from "./types";
import { useTranslation } from "../../lib/i18n";

interface TerminalTabProps {
  tab: RightPaneTab;
  onReady?: (cwd: string) => void;
}

export function TerminalTab({ tab, onReady }: TerminalTabProps) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const { t } = useTranslation();
  const translateRef = useRef(t);
  translateRef.current = t;
  const launchOptions = useRef({ cwd: tab.cwd, project: tab.project });
  launchOptions.current = { cwd: tab.cwd, project: tab.project };
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let ready = false;
    let lastSequence = 0;
    let queuedOutput: Array<{ data: string; sequence?: number }> = [];

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

    term.open(container);
    termRef.current = term;

    const fit = () => {
      // Hidden tabs have no usable dimensions. Fitting them can resize
      // the running console to the addon's one-row minimum.
      if (container.clientWidth > 0 && container.clientHeight > 0) fitAddon.fit();
    };
    fit();

    // 1. Hook up user keyboard input to Electron IPC
    const onDataDisposable = term.onData((data) => {
      if (ready) void window.electron?.terminal?.write({ id: tab.id, data, conversationId: tab.conversationId! }).catch(() => {});
    });
    const resize = () => {
      if (ready) void window.electron?.terminal?.resize({ id: tab.id, cols: term.cols, rows: term.rows, conversationId: tab.conversationId! }).catch(() => {});
    };
    const onResizeDisposable = term.onResize(resize);

    // 2. Hook up output from backend shell to xterm
    const writeOutput = (payload: { data: string; sequence?: number }) => {
      if (payload.sequence !== undefined && payload.sequence <= lastSequence) return;
      term.write(payload.data);
      if (payload.sequence !== undefined) lastSequence = payload.sequence;
    };
    const cleanupOnData = window.electron?.terminal?.onData((payload) => {
      if (payload.id === tab.id && payload.conversationId === tab.conversationId) {
        if (ready) writeOutput(payload);
        else queuedOutput.push(payload);
      }
    });

    const cleanupOnExit = window.electron?.terminal?.onExit((payload) => {
      if (payload.id === tab.id && payload.conversationId === tab.conversationId) {
        ready = false;
        term.writeln(`\r\n\x1b[90m${translateRef.current("bottomPanel.terminalExited").replace("{code}", String(payload.code))}\x1b[0m`);
      }
    });

    // 3. Initialize terminal session in backend
    window.electron?.terminal?.create({
      id: tab.id,
      ...launchOptions.current,
      conversationId: tab.conversationId,
      cols: term.cols,
      rows: term.rows,
    }).then(result => {
      if (disposed) return;
      if (!result?.success) {
        term.writeln(translateRef.current("bottomPanel.terminalStartFailed").replace("{error}", result?.error || ""));
        return;
      }
      if (result.replay) term.write(result.replay);
      lastSequence = result.sequence ?? 0;
      for (const payload of queuedOutput) writeOutput(payload);
      queuedOutput = [];
      ready = true;
      if (result.cwd) onReadyRef.current?.(result.cwd);
      fit();
      resize();
    }).catch(error => {
      if (!disposed) term.writeln(translateRef.current("bottomPanel.terminalStartFailed").replace("{error}", String(error)));
    });

    // Handle container resizing smoothly with ResizeObserver
    let fitFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(fit);
    });
    resizeObserver.observe(container);

    // Focus terminal on mount and initial render
    const focusTimer = setTimeout(() => {
      term.focus();
      (term as any).textarea?.focus();
    }, 150);

    return () => {
      disposed = true;
      clearTimeout(focusTimer);
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      cleanupOnData?.();
      cleanupOnExit?.();
      resizeObserver.disconnect();
      cancelAnimationFrame(fitFrame);
      term.dispose();
      termRef.current = null;
    };
    // The resolved cwd updates the tab label after launch. The PTY and its
    // xterm view stay attached to the same terminal ID through that update.
  }, [tab.id, tab.conversationId]);

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
