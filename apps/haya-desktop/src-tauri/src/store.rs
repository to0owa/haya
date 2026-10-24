//! Saved connection profiles. Settings live in a JSON file; passwords live in the Keychain.

use std::{fs, path::PathBuf};

use anyhow::{Context as _, Result};
use haya_db::{Dialect, Profile};
use serde::{Deserialize, Serialize};

const KEYCHAIN_SERVICE: &str = "dev.haya.terminal";

#[derive(Clone, Serialize, Deserialize)]
pub struct StoredProfile {
    pub name: String,
    pub dialect: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub database: String,
}

pub fn to_profile(stored: &StoredProfile, password: Option<String>) -> Profile {
    Profile {
        name: stored.name.clone(),
        dialect: if stored.dialect == "cratedb" { Dialect::CrateDb } else { Dialect::Postgres },
        host: stored.host.clone(),
        port: stored.port,
        user: stored.user.clone(),
        password,
        database: stored.database.clone(),
    }
}

fn store_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").context("HOME is not set")?;
    Ok(PathBuf::from(home).join("Library/Application Support/Haya/connections.json"))
}

pub fn load() -> Vec<StoredProfile> {
    let Ok(path) = store_path() else { return Vec::new() };
    let Ok(text) = fs::read_to_string(path) else { return Vec::new() };
    serde_json::from_str(&text).unwrap_or_default()
}

pub fn save(profiles: &[StoredProfile]) -> Result<()> {
    let path = store_path()?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).context("create config directory")?;
    }
    fs::write(path, serde_json::to_string_pretty(profiles)?).context("write connections file")
}

pub fn set_password(profile_name: &str, password: &str) -> Result<()> {
    keyring::Entry::new(KEYCHAIN_SERVICE, profile_name)?.set_password(password)?;
    Ok(())
}

pub fn password(profile_name: &str) -> Option<String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, profile_name).ok()?.get_password().ok()
}
