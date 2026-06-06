export type SessionStatus =
  | "idle"
  | "starting"
  | "running"
  | "stopped"
  | "error";

export interface GrokSession {
  id: string;
  cwd: string;
  status: SessionStatus;
  exitCode: number | null;
  error: string | null;
}

/** Mirrors the Rust `AppConfig` (serde snake_case). */
export interface AppConfig {
  last_cwd: string | null;
  grok_path: string | null;
}

export interface SessionExitPayload {
  id: string;
  code: number;
}
