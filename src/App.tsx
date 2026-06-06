import { useCallback, useEffect, useRef, useState } from "react";
import { TerminalView, type TerminalHandle } from "./components/TerminalView";
import { Toolbar } from "./components/Toolbar";
import { StatusBar } from "./components/StatusBar";
import { GrokMissing } from "./components/GrokMissing";
import { useSessionStore } from "./store/sessionStore";
import {
  killSession,
  loadConfig,
  locateGrok,
  onSessionExit,
  pickDirectory,
  pickGrokBinary,
  saveConfig,
  startSession,
  validateGrok,
} from "./lib/tauri";

function App() {
  const termRef = useRef<TerminalHandle>(null);
  const [busy, setBusy] = useState(false);

  const {
    activeId,
    sessions,
    cwd,
    grokPath,
    grokFound,
    setCwd,
    setGrok,
    createSession,
    setStatus,
    setExit,
  } = useSessionStore();

  const activeSession = activeId ? sessions[activeId] : null;
  const status = activeSession?.status ?? "none";

  // Persist the current selections so the next launch pre-fills them.
  const persist = useCallback(
    (nextCwd: string | null, nextGrok: string | null) => {
      void saveConfig({ last_cwd: nextCwd, grok_path: nextGrok });
    },
    [],
  );

  // Resolve grok: prefer a saved/validated override, else search PATH.
  const resolveGrok = useCallback(async (savedPath: string | null) => {
    if (savedPath && (await validateGrok(savedPath))) {
      setGrok(savedPath, true);
      return;
    }
    const found = await locateGrok();
    setGrok(found, found !== null);
  }, [setGrok]);

  // Boot: load persisted config, resolve grok, subscribe to exit events.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      const cfg = await loadConfig();
      if (cfg.last_cwd) setCwd(cfg.last_cwd);
      await resolveGrok(cfg.grok_path);
      unlisten = await onSessionExit(({ id, code }) => setExit(id, code));
    })();
    return () => unlisten?.();
  }, [resolveGrok, setCwd, setExit]);

  const handlePickFolder = useCallback(async () => {
    const dir = await pickDirectory(cwd);
    if (dir) {
      setCwd(dir);
      persist(dir, grokPath);
    }
  }, [cwd, grokPath, persist, setCwd]);

  const handleLocateGrok = useCallback(async () => {
    setBusy(true);
    try {
      const picked = await pickGrokBinary();
      if (picked && (await validateGrok(picked))) {
        setGrok(picked, true);
        persist(cwd, picked);
      }
    } finally {
      setBusy(false);
    }
  }, [cwd, persist, setGrok]);

  const handleRetryGrok = useCallback(async () => {
    setBusy(true);
    try {
      await resolveGrok(grokPath);
    } finally {
      setBusy(false);
    }
  }, [grokPath, resolveGrok]);

  const handleStart = useCallback(async () => {
    if (!cwd) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const term = termRef.current;
      term?.clear();
      const { cols, rows } = term?.fit() ?? { cols: 80, rows: 24 };

      createSession(id, cwd);
      try {
        await startSession(
          { id, cwd, grokPath, cols, rows },
          (bytes) => termRef.current?.write(bytes),
        );
        setStatus(id, "running");
        persist(cwd, grokPath);
        term?.focus();
      } catch (e) {
        setStatus(id, "error", String(e));
      }
    } finally {
      setBusy(false);
    }
  }, [cwd, grokPath, createSession, setStatus, persist]);

  const handleKill = useCallback(async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      await killSession(activeId);
    } finally {
      setBusy(false);
    }
  }, [activeId]);

  const handleRestart = useCallback(async () => {
    if (activeId) {
      try {
        await killSession(activeId);
      } catch {
        // ignore — we're starting fresh anyway
      }
    }
    await handleStart();
  }, [activeId, handleStart]);

  // Show the install/locate screen until grok is resolved.
  const showMissing = grokFound === false;

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      <Toolbar
        cwd={cwd}
        status={status}
        busy={busy}
        canStart={!!cwd && grokFound === true}
        onPickFolder={handlePickFolder}
        onStart={handleStart}
        onRestart={handleRestart}
        onKill={handleKill}
      />

      <div className="relative min-h-0 flex-1">
        {/* The terminal stays mounted so its buffer/size persist; overlay on top. */}
        <div className="absolute inset-0 p-1">
          <TerminalView ref={termRef} sessionId={activeId} />
        </div>
        {showMissing && (
          <div className="absolute inset-0">
            <GrokMissing
              onLocate={handleLocateGrok}
              onRetry={handleRetryGrok}
              busy={busy}
            />
          </div>
        )}
      </div>

      <StatusBar
        cwd={cwd}
        grokPath={grokPath}
        status={status}
        exitCode={activeSession?.exitCode ?? null}
      />
    </div>
  );
}

export default App;
