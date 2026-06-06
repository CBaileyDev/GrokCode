import type { SessionStatus } from "../types";

interface Props {
  cwd: string | null;
  status: SessionStatus | "none";
  busy: boolean;
  canStart: boolean;
  onPickFolder: () => void;
  onStart: () => void;
  onRestart: () => void;
  onKill: () => void;
}

const baseBtn =
  "rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function Toolbar({
  cwd,
  status,
  busy,
  canStart,
  onPickFolder,
  onStart,
  onRestart,
  onKill,
}: Props) {
  const running = status === "running" || status === "starting";

  return (
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
      <button
        type="button"
        onClick={onPickFolder}
        disabled={busy}
        className={`${baseBtn} bg-neutral-700 text-neutral-100 hover:bg-neutral-600`}
      >
        Folder…
      </button>

      <div
        className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-400"
        title={cwd ?? ""}
      >
        {cwd ?? "No working directory selected"}
      </div>

      {!running ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart || busy}
          className={`${baseBtn} bg-emerald-600 text-white hover:bg-emerald-500`}
        >
          Start
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onRestart}
            disabled={busy}
            className={`${baseBtn} bg-amber-600 text-white hover:bg-amber-500`}
          >
            Restart
          </button>
          <button
            type="button"
            onClick={onKill}
            disabled={busy}
            className={`${baseBtn} bg-red-600 text-white hover:bg-red-500`}
          >
            Kill
          </button>
        </>
      )}
    </div>
  );
}
