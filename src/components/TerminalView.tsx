import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { resizeSession, writeSession } from "../lib/tauri";

export interface TerminalHandle {
  write: (bytes: Uint8Array) => void;
  /** Re-fit to the container and return the resulting dimensions. */
  fit: () => { cols: number; rows: number };
  focus: () => void;
  clear: () => void;
}

interface Props {
  /** The active session id (used to route input/resize). */
  sessionId: string | null;
}

const THEME = {
  background: "#0b0e14",
  foreground: "#c5c8c6",
  cursor: "#58a6ff",
  selectionBackground: "#264f78",
};

export const TerminalView = forwardRef<TerminalHandle, Props>(
  function TerminalView({ sessionId }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    // Keep the latest session id reachable from stable event handlers.
    const sessionIdRef = useRef<string | null>(sessionId);
    sessionIdRef.current = sessionId;

    useImperativeHandle(ref, () => ({
      write: (bytes) => termRef.current?.write(bytes),
      fit: () => {
        fitRef.current?.fit();
        const t = termRef.current;
        return { cols: t?.cols ?? 80, rows: t?.rows ?? 24 };
      },
      focus: () => termRef.current?.focus(),
      clear: () => termRef.current?.clear(),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const term = new Terminal({
        fontFamily:
          'Menlo, "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
        fontSize: 13,
        cursorBlink: true,
        allowProposedApi: true,
        scrollback: 10000,
        theme: THEME,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;

      const dataSub = term.onData((data) => {
        const id = sessionIdRef.current;
        if (id) void writeSession(id, data);
      });

      // Keep the PTY sized to the pane; debounce via rAF to coalesce bursts.
      let raf = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          try {
            fit.fit();
          } catch {
            return; // container hidden / zero-sized
          }
          const id = sessionIdRef.current;
          if (id) void resizeSession(id, term.cols, term.rows);
        });
      });
      observer.observe(container);

      return () => {
        dataSub.dispose();
        observer.disconnect();
        cancelAnimationFrame(raf);
        term.dispose();
        termRef.current = null;
        fitRef.current = null;
      };
    }, []);

    return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
  },
);
