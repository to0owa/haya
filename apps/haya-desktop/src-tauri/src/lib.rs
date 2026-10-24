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
    terminals.sessions.lock().map_err(|e| e.to_string())?.remove(&id);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(Terminals::default())
        .manage(DbState::default())
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_close,
            db::db_profiles,
            db::db_save_profile,
            db::db_connect,
            db::db_tables,
            db::db_page,
            db::db_execute
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haya");
}
