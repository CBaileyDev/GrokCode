//! Tauri command surface exposed to the frontend.

use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::config::{self, AppConfig};
use crate::grok;
use crate::pty::{self, AppState};

/// Find grok on PATH (per-OS). Returns the resolved path, or null if not found.
#[tauri::command]
pub fn locate_grok() -> Option<String> {
    grok::locate_grok()
}

/// Check that a manually-chosen grok path exists / is a file.
#[tauri::command]
pub fn validate_grok(path: String) -> bool {
    grok::validate_grok(&path)
}

/// Start a grok session in `cwd`. `grok_path` overrides PATH lookup when set.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn start_session(
    app: AppHandle,
    state: State<AppState>,
    id: String,
    cwd: String,
    grok_path: Option<String>,
    cols: u16,
    rows: u16,
    on_output: Channel<String>,
) -> Result<(), String> {
    let resolved = match grok_path {
        Some(p) if grok::validate_grok(&p) => p,
        Some(p) => return Err(format!("grok not found at: {p}")),
        None => grok::locate_grok().ok_or_else(|| "grok was not found on your PATH".to_string())?,
    };
    pty::spawn(app, &state, id, cwd, resolved, cols, rows, on_output)
}

#[tauri::command]
pub fn write_session(state: State<AppState>, id: String, data: String) -> Result<(), String> {
    pty::write(&state, &id, data.as_bytes())
}

#[tauri::command]
pub fn resize_session(
    state: State<AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty::resize(&state, &id, cols, rows)
}

#[tauri::command]
pub fn kill_session(state: State<AppState>, id: String) -> Result<(), String> {
    pty::kill(&state, &id)
}

#[tauri::command]
pub fn load_config(app: AppHandle) -> AppConfig {
    config::load(&app)
}

#[tauri::command]
pub fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    config::save(&app, &config)
}
