mod commands;
mod config;
mod grok;
mod pty;

use pty::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::locate_grok,
            commands::validate_grok,
            commands::start_session,
            commands::write_session,
            commands::resize_session,
            commands::kill_session,
            commands::load_config,
            commands::save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running GrokDesk");
}
