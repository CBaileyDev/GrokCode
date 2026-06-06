//! PTY session lifecycle: spawn grok in a pseudo-terminal, pump its output to
//! the frontend over a Tauri channel, and handle input / resize / kill.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use portable_pty::{native_pty_system, Child, MasterPty, PtySize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager};

use crate::grok;

/// A live PTY session. Owns the master (for resize), the writer (for input),
/// and the child process (for kill). The child is shared with the reader thread
/// so it can collect the exit status once the PTY closes.
pub struct PtyHandle {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

/// App-wide state: all live sessions, keyed by id. v1 uses a single id, but the
/// map keeps multi-session/tabs a small change later.
#[derive(Default)]
pub struct AppState {
    pub sessions: Mutex<HashMap<String, PtyHandle>>,
}

#[derive(Clone, serde::Serialize)]
pub struct ExitPayload {
    pub id: String,
    pub code: u32,
}

/// Spawn `grok` inside a fresh PTY and start streaming its output.
#[allow(clippy::too_many_arguments)]
pub fn spawn(
    app: AppHandle,
    state: &AppState,
    id: String,
    cwd: String,
    grok_path: String,
    cols: u16,
    rows: u16,
    on_output: Channel<String>,
) -> Result<(), String> {
    if state.sessions.lock().unwrap().contains_key(&id) {
        return Err(format!("session '{id}' is already running"));
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("failed to open pty: {e}"))?;

    let mut cmd = grok::build_command(&grok_path);
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("failed to launch grok: {e}"))?;
    // The slave handle is not needed in the parent once grok is spawned.
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("failed to obtain pty reader: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("failed to obtain pty writer: {e}"))?;

    let child = Arc::new(Mutex::new(child));

    let handle = PtyHandle {
        master: pair.master,
        writer,
        child: child.clone(),
    };
    state.sessions.lock().unwrap().insert(id.clone(), handle);

    // Reader thread: pump PTY bytes to the frontend until EOF, then report exit.
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF: process exited / pty closed
                Ok(n) => {
                    // base64 so a multi-byte UTF-8 / ANSI sequence is never split
                    // or corrupted crossing the IPC boundary.
                    if on_output.send(STANDARD.encode(&buf[..n])).is_err() {
                        break; // frontend went away
                    }
                }
                Err(_) => break,
            }
        }

        let code = child
            .lock()
            .unwrap()
            .wait()
            .map(|status| status.exit_code())
            .unwrap_or(0);

        if let Some(state) = app.try_state::<AppState>() {
            state.sessions.lock().unwrap().remove(&id);
        }
        let _ = app.emit("session-exit", ExitPayload { id, code });
    });

    Ok(())
}

/// Write keystroke bytes into the PTY.
pub fn write(state: &AppState, id: &str, data: &[u8]) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let handle = sessions
        .get_mut(id)
        .ok_or_else(|| format!("no running session '{id}'"))?;
    handle.writer.write_all(data).map_err(|e| e.to_string())?;
    handle.writer.flush().map_err(|e| e.to_string())
}

/// Resize the PTY to match the terminal pane.
pub fn resize(state: &AppState, id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let handle = sessions
        .get(id)
        .ok_or_else(|| format!("no running session '{id}'"))?;
    handle
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

/// Kill the session's process. The reader thread will observe EOF and emit the
/// `session-exit` event, so we don't remove from state here.
pub fn kill(state: &AppState, id: &str) -> Result<(), String> {
    // Clone the child handle and release the sessions lock before killing.
    let child = {
        let sessions = state.sessions.lock().unwrap();
        match sessions.get(id) {
            Some(handle) => handle.child.clone(),
            None => return Ok(()), // already gone
        }
    };
    let mut guard = child.lock().unwrap();
    guard.kill().map_err(|e| e.to_string())
}
