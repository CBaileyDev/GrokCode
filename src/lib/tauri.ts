import { invoke, Channel } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppConfig, SessionExitPayload } from "../types";

export function locateGrok(): Promise<string | null> {
  return invoke<string | null>("locate_grok");
}

export function validateGrok(path: string): Promise<boolean> {
  return invoke<boolean>("validate_grok", { path });
}

export interface StartOptions {
  id: string;
  cwd: string;
  grokPath: string | null;
  cols: number;
  rows: number;
}

/**
 * Start a grok session. Incoming PTY output arrives on a Tauri channel as
 * base64 strings; we decode each chunk to bytes and hand it to `onOutput`.
 */
export function startSession(
  opts: StartOptions,
  onOutput: (bytes: Uint8Array) => void,
): Promise<void> {
  const channel = new Channel<string>();
  channel.onmessage = (b64) => onOutput(base64ToBytes(b64));
  return invoke<void>("start_session", {
    id: opts.id,
    cwd: opts.cwd,
    grokPath: opts.grokPath,
    cols: opts.cols,
    rows: opts.rows,
    onOutput: channel,
  });
}

export function writeSession(id: string, data: string): Promise<void> {
  return invoke<void>("write_session", { id, data });
}

export function resizeSession(
  id: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>("resize_session", { id, cols, rows });
}

export function killSession(id: string): Promise<void> {
  return invoke<void>("kill_session", { id });
}

export function loadConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("load_config");
}

export function saveConfig(config: AppConfig): Promise<void> {
  return invoke<void>("save_config", { config });
}

export function onSessionExit(
  cb: (payload: SessionExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<SessionExitPayload>("session-exit", (e) => cb(e.payload));
}

export async function pickDirectory(
  defaultPath?: string | null,
): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath ?? undefined,
  });
  return typeof result === "string" ? result : null;
}

export async function pickGrokBinary(): Promise<string | null> {
  const result = await open({
    directory: false,
    multiple: false,
    title: "Locate the grok executable",
  });
  return typeof result === "string" ? result : null;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}
