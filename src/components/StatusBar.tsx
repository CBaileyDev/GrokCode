import type { SessionStatus } from "../types";

interface Props {
  cwd: string | null;
  grokPath: string | null;
  status: SessionStatus | "none";
  exitCode: number | null;
}

const STATUS_STYLES: Record<SessionStatus | "none", string> = {
  none: "bg-neutral-700 text-neutral-300",
  idle: "bg-neutral-700 text-neutral-300",
  starting: "bg-amber-700 text-amber-100",
  running: "bg-emerald-700 text-emerald-100",
  stopped: "bg-neutral-700 text-neutral-300",
  error: "bg-red-700 text-red-100",
};

const STATUS_LABEL: Record<SessionStatus | "none", string> = {
  none: "no session",
  idle: "idle",
  starting: "starting…",
  running: "running",
  stopped: "stopped",
  error: "error",
};

export function StatusBar({ cwd, grokPath, status, exitCode }: Props) {
  return (
    <div className="flex items-center gap-3 border-t border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400">
      <span
        className={`rounded px-2 py-0.5 font-medium ${STATUS_STYLES[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>

      <span className="min-w-0 flex-1 truncate font-mono" title={cwd ?? ""}>
        {cwd ?? "—"}
      </span>

      {exitCode !== null && (status === "stopped" || status === "error") && (
        <span className="font-mono">exit {exitCode}</span>
      )}

      <span
        className="truncate font-mono text-neutral-600"
        title={grokPath ?? ""}
      >
        {grokPath ? `grok: ${grokPath}` : "grok: not found"}
      </span>
    </div>
  );
}
