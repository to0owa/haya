//! Haya desktop backend: terminal sessions over haya-pty, database access over haya-db.

use std::{collections::HashMap, sync::Mutex, thread, time::Duration};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use haya_pty::PtySession;

mod db;
mod store;

use db::DbState;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
struct Terminals {
    next_id: Mutex<u32>,
    sessions: Mutex<HashMap<u32, PtySession>>,
}

#[derive(Clone, Serialize)]
struct OutputEvent {
    id: u32,
    /// Base64 so partial UTF-8 sequences survive the JSON boundary.
    data: String,
}

#[tauri::command]
fn pty_spawn(app: AppHandle, terminals: State<'_, Terminals>, rows: u16, cols: u16) -> Result<u32, String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let session = PtySession::spawn(&shell, rows, cols).map_err(|e| format!("{e:#}"))?;

    let id = {
        let mut next = terminals.next_id.lock().map_err(|e| e.to_string())?;
        *next += 1;
        *next
    };
    terminals.sessions.lock().map_err(|e| e.to_string())?.insert(id, session);
    eprintln!("[pty-debug] spawn id={id}");

    // Pump output to the frontend. Stops when the session is removed.
    let handle = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(8));
        let state = handle.state::<Terminals>();
        let Ok(sessions) = state.sessions.lock() else { break };
        let Some(session) = sessions.get(&id) else { break };
        for chunk in session.drain_output() {
            let _ = handle.emit("pty-output", OutputEvent { id, data: STANDARD.encode(chunk) });
        }
    });

    Ok(id)
}

#[tauri::command]
fn pty_write(terminals: State<'_, Terminals>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = terminals.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&id).ok_or("unknown terminal")?;
    session.write(data.as_bytes()).map_err(|e| format!("{e:#}"))
}

#[tauri::command]
fn pty_resize(terminals: State<'_, Terminals>, id: u32, rows: u16, cols: u16) -> Result<(), String> {
    let sessions = terminals.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get(&id).ok_or("unknown terminal")?;
    session.resize(rows, cols).map_err(|e| format!("{e:#}"))
}

#[tauri::command]
fn pty_close(terminals: State<'_, Terminals>, id: u32) -> Result<(), String> {
    // Drop the session after the lock is released: dropping it waits for the shell to exit.
    let removed = terminals.sessions.lock().map_err(|e| e.to_string())?.remove(&id);
    eprintln!("[pty-debug] close id={id} found={}", removed.is_some());
    drop(removed);
    eprintln!("[pty-debug] close id={id} done");
    Ok(())
}

/// Path of the saved workspace layout, next to the connection profiles.
fn workspaces_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(std::path::PathBuf::from(home).join("Library/Application Support/Haya/workspaces.json"))
}

/// Returns the saved layout as JSON, or None on first launch. The frontend validates it.
#[tauri::command]
fn workspaces_load() -> Result<Option<String>, String> {
    let path = workspaces_path()?;
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn workspaces_save(json: String) -> Result<(), String> {
    let path = workspaces_path()?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, json).map_err(|e| e.to_string())
}

mod themes;
mod wallpaper;

/// A web view configuration with Apple's Writing Tools off, or None when this macOS has no such setting.
/// Writing Tools draws a Siri glyph at the cursor of any text input, and a terminal counts as one: xterm reads keys
/// through a hidden textarea. The setting has to be on the configuration, before the web view exists.
#[cfg(target_os = "macos")]
fn writing_tools_off() -> Option<objc2::rc::Retained<objc2_web_kit::WKWebViewConfiguration>> {
    use objc2::{msg_send, sel};
    /// NSWritingToolsBehaviorNone
    const BEHAVIOR_NONE: isize = -1;
    let mtm = objc2::MainThreadMarker::new()?;
    let config = unsafe { objc2_web_kit::WKWebViewConfiguration::new(mtm) };
    // macOS 15 and later. Earlier systems have no Writing Tools to turn off.
    let supported: bool = unsafe { msg_send![&*config, respondsToSelector: sel!(setWritingToolsBehavior:)] };
    if !supported {
        return None;
    }
    let _: () = unsafe { msg_send![&*config, setWritingToolsBehavior: BEHAVIOR_NONE] };
    Some(config)
}

/// Builds the main window from tauri.conf.json. Tauri would build it itself (`create` is false there),
/// but then the web view could not be given its own configuration.
fn create_main_window(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = app.config().app.windows.first().cloned().ok_or("tauri.conf.json defines no window")?;
    let builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
    #[cfg(target_os = "macos")]
    let builder = match writing_tools_off() {
        Some(web_view) => builder.with_webview_configuration(web_view),
        None => builder,
    };
    builder.build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Terminals::default())
        .manage(DbState::default())
        .manage(themes::ThemeStore::default())
        .setup(|app| create_main_window(app))
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            workspaces_load,
            workspaces_save,
            wallpaper::wallpaper_import,
            wallpaper::wallpaper_path,
            wallpaper::wallpaper_remove,
            themes::themes_load,
            themes::theme_save,
            themes::theme_delete,
            pty_resize,
            pty_close,
            db::db_profiles,
            db::db_save_profile,
            db::db_connect,
            db::db_tables,
            db::db_page,
            db::db_execute,
            db::db_primary_key,
            db::db_update_row,
            db::db_insert_row
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haya");
}
