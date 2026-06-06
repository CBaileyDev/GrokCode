# GrokDesk

A cross-platform **Tauri 2** desktop app that embeds the [Grok Build CLI](https://x.ai)
(`grok`) as an interactive terminal, so you can run agentic coding sessions in a GUI
window instead of a bare terminal.

Grok Build is a full-screen TUI (ANSI redraws, plan mode, approval gates), so GrokDesk
spawns it inside a **real pseudo-terminal** via [`portable-pty`](https://crates.io/crates/portable-pty)
and renders the raw byte stream with [xterm.js](https://xtermjs.org/). This makes the
full TUI work correctly — piping stdout/stderr would corrupt the in-place redraws.

## Stack

| Layer | Tech |
|---|---|
| Shell / backend | Tauri 2, Rust, `portable-pty`, `which` |
| Frontend | React 19 + TypeScript 5, Vite 6 |
| Styling | Tailwind v4 (`@tailwindcss/vite`) |
| State | Zustand 5 |
| Terminal | `@xterm/xterm` + `@xterm/addon-fit` |

## Features (v1)

- **Working-directory picker** (Tauri dialog); `grok` launches in that cwd.
- **Start / Restart / Kill** session controls.
- Terminal fills the window and **resizes cleanly** (FitAddon + `ResizeObserver`).
- **Status bar**: cwd, session state (running / stopped / exit code), resolved grok path.
- **Graceful "grok not found"**: shows install hints and lets you browse to the binary
  manually. The chosen path and last working directory are remembered across launches.
- Per-OS binary lookup (handles `grok.exe`, a `grok.cmd` shim, or a `grok.ps1` shim
  on Windows; a plain executable on macOS/Linux).
- Single session for v1, but the Zustand store keys sessions by id so **tabs** can be
  added later.
- No telemetry, no external calls beyond what `grok` itself makes.

## Prerequisites

- **Node.js** 18+ and **npm**
- **Rust** (stable) + the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/)
  for your OS.
- The **`grok` CLI** installed (the app will prompt with these hints if it's missing):
  - macOS / Linux: `curl -fsSL https://x.ai/cli/install.sh | bash`
  - Windows: `irm https://x.ai/cli/install.ps1 | iex`

## Develop

```bash
npm install
npm run tauri dev
```

This launches Vite (port 1420) and the Tauri shell with hot reload.

## Release build

Run on each target OS (cross-OS bundling is not supported from a single machine):

```bash
npm run tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`:

- **macOS (Apple Silicon):** `.app` and `.dmg`
- **Windows 11:** `.msi` and an NSIS `.exe`

## Architecture

```
src/                     React + TypeScript frontend
  App.tsx                Orchestrates boot, grok resolution, session lifecycle
  store/sessionStore.ts  Zustand store — sessions keyed by id (multi-session ready)
  lib/tauri.ts           Typed wrappers over invoke() + the output Channel + events
  components/
    TerminalView.tsx     xterm.js + FitAddon; onData→write, channel→term.write
    Toolbar.tsx          cwd picker, Start/Restart/Kill
    StatusBar.tsx        cwd · status · exit code · grok path
    GrokMissing.tsx      install hints + "Locate grok…" + Retry

src-tauri/               Rust backend
  src/grok.rs            Per-OS binary discovery + command construction
  src/pty.rs             PTY session lifecycle (spawn / write / resize / kill)
  src/config.rs          Persisted config (last cwd, grok path) in app_config_dir
  src/commands.rs        #[tauri::command] surface
  src/lib.rs             Tauri builder + command registration
```

**Data flow:** `start_session` opens a PTY, spawns `grok` (with `TERM=xterm-256color`)
in the chosen cwd, and streams output bytes to the frontend over a Tauri
`Channel<String>` (base64-encoded so multi-byte ANSI/UTF-8 sequences are never split).
Keystrokes flow back via `write_session`; the pane size is mirrored to the PTY via
`resize_session`. When `grok` exits, the backend emits a `session-exit` event with the
exit code.
