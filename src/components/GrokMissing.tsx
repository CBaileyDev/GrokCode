interface Props {
  onLocate: () => void;
  onRetry: () => void;
  busy: boolean;
}

export function GrokMissing({ onLocate, onRetry, busy }: Props) {
  return (
    <div className="flex h-full items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-xl rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-neutral-100">
          The <span className="font-mono">grok</span> CLI wasn't found
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          GrokDesk couldn't find <span className="font-mono">grok</span> on your
          PATH. Install it, then retry — or point GrokDesk at the binary
          directly.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              macOS / Linux
            </div>
            <code className="block overflow-x-auto rounded bg-neutral-950 px-3 py-2 font-mono text-xs text-emerald-300">
              curl -fsSL https://x.ai/cli/install.sh | bash
            </code>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Windows
            </div>
            <code className="block overflow-x-auto rounded bg-neutral-950 px-3 py-2 font-mono text-xs text-emerald-300">
              irm https://x.ai/cli/install.ps1 | iex
            </code>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onLocate}
            disabled={busy}
            className="rounded bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-600 disabled:opacity-40"
          >
            Locate grok…
          </button>
        </div>
      </div>
    </div>
  );
}
