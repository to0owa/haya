//! Database commands for the frontend. One active connection at a time, as in the GPUI app.

use std::sync::Arc;

use haya_db::{Connection, QueryResult};
use serde::Serialize;
use tauri::State;
use tokio::sync::Mutex;

use crate::store::{self, StoredProfile};

#[derive(Default)]
pub struct DbState {
    active: Mutex<Option<Arc<Connection>>>,
}

#[derive(Serialize)]
pub struct QueryDto {
    columns: Vec<String>,
    rows: Vec<Vec<Option<String>>>,
    truncated: bool,
    rows_affected: Option<u64>,
    elapsed_ms: u128,
}

impl From<QueryResult> for QueryDto {
    fn from(result: QueryResult) -> Self {
        Self {
            columns: result.columns,
            rows: result.rows,
            truncated: result.truncated,
            rows_affected: result.rows_affected,
            elapsed_ms: result.elapsed.as_millis(),
        }
    }
}

fn err(error: anyhow::Error) -> String {
    format!("{error:#}")
}

async fn active(state: &DbState) -> Result<Arc<Connection>, String> {
    state.active.lock().await.clone().ok_or_else(|| "Connect to a database first".to_string())
}

#[tauri::command]
pub fn db_profiles() -> Vec<StoredProfile> {
    store::load()
}

#[tauri::command]
pub fn db_save_profile(profile: StoredProfile, password: Option<String>) -> Result<(), String> {
    if let Some(password) = password.filter(|p| !p.is_empty()) {
        store::set_password(&profile.name, &password).map_err(err)?;
    }
    let mut profiles = store::load();
    profiles.retain(|p| p.name != profile.name);
    profiles.push(profile);
    store::save(&profiles).map_err(err)
}

/// Connects to a saved profile and returns its schemas.
#[tauri::command]
pub async fn db_connect(state: State<'_, DbState>, name: String) -> Result<Vec<String>, String> {
    let stored = store::load()
        .into_iter()
        .find(|p| p.name == name)
        .ok_or_else(|| format!("no profile named {name}"))?;
    let profile = store::to_profile(&stored, store::password(&name));
    let conn = Arc::new(Connection::connect(&profile).await.map_err(err)?);
    let schemas = conn.schemas().await.map_err(err)?;
    *state.active.lock().await = Some(conn);
    Ok(schemas)
}

#[tauri::command]
pub async fn db_tables(state: State<'_, DbState>, schema: String) -> Result<Vec<String>, String> {
    active(&state).await?.tables(&schema).await.map_err(err)
}

#[tauri::command]
pub async fn db_page(
    state: State<'_, DbState>,
    schema: String,
    table: String,
    offset: u64,
    limit: u64,
) -> Result<QueryDto, String> {
    active(&state).await?.page(&schema, &table, offset, limit).await.map(Into::into).map_err(err)
}

#[tauri::command]
pub async fn db_execute(state: State<'_, DbState>, sql: String, row_cap: usize) -> Result<QueryDto, String> {
    active(&state).await?.execute(&sql, row_cap).await.map(Into::into).map_err(err)
}
