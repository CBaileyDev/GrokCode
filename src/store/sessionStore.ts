import { create } from "zustand";
import type { GrokSession, SessionStatus } from "../types";

interface SessionState {
  /** The currently focused session (single session in v1). */
  activeId: string | null;
  /** All sessions, keyed by id — keeps multi-session/tabs a small change later. */
  sessions: Record<string, GrokSession>;

  /** Resolved grok binary path, and whether grok was found at all. */
  grokPath: string | null;
  grokFound: boolean | null; // null = not yet checked
  /** Selected working directory for the next launch. */
  cwd: string | null;

  setCwd: (cwd: string | null) => void;
  setGrok: (path: string | null, found: boolean | null) => void;
  createSession: (id: string, cwd: string) => void;
  setStatus: (id: string, status: SessionStatus, error?: string | null) => void;
  setExit: (id: string, code: number) => void;
  removeSession: (id: string) => void;
  setActive: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeId: null,
  sessions: {},
  grokPath: null,
  grokFound: null,
  cwd: null,

  setCwd: (cwd) => set({ cwd }),
  setGrok: (grokPath, grokFound) => set({ grokPath, grokFound }),

  createSession: (id, cwd) =>
    set((s) => ({
      activeId: id,
      sessions: {
        ...s.sessions,
        [id]: { id, cwd, status: "starting", exitCode: null, error: null },
      },
    })),

  setStatus: (id, status, error = null) =>
    set((s) => {
      const current = s.sessions[id];
      if (!current) return {};
      return {
        sessions: { ...s.sessions, [id]: { ...current, status, error } },
      };
    }),

  setExit: (id, code) =>
    set((s) => {
      const current = s.sessions[id];
      if (!current) return {};
      const status: SessionStatus = code === 0 ? "stopped" : "error";
      return {
        sessions: { ...s.sessions, [id]: { ...current, status, exitCode: code } },
      };
    }),

  removeSession: (id) =>
    set((s) => {
      const next = { ...s.sessions };
      delete next[id];
      return {
        sessions: next,
        activeId: s.activeId === id ? null : s.activeId,
      };
    }),

  setActive: (id) => set({ activeId: id }),
}));
