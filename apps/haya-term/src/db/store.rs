//! Saved connection profiles. Non-secret settings live in a JSON file; passwords live in the Keychain.

use std::{fs, path::PathBuf};

use anyhow::{Context as _, Result};
use haya_db::{Dialect, Profile};
use serde::{Deserialize, Serialize};

const KEYCHAIN_SERVICE: &str = "dev.haya.terminal";

#[derive(Serialize, Deserialize)]
struct StoredProfile {
    name: String,
    dialect: String,
    host: String,
    port: u16,
    user: String,
    database: String,
}

fn dialect_key(dialect: Dialect) -> &'static str {
    match dialect {
        Dialect::Postgres => "postgres",
        Dialect::CrateDb => "cratedb",
    }
}

fn parse_dialect(key: &str) -> Dialect {
    match key {
        "cratedb" => Dialect::CrateDb,
        _ => Dialect::Postgres,
    }
}

fn store_path() -> Result<PathBuf> {
    let home = std::env::var("HOME").context("HOME is not set")?;
    Ok(PathBuf::from(home).join("Library/Application Support/Haya/connections.json"))
}

/// Loads saved profiles. Passwords are not included; call [`password`] for each one.
pub fn load() -> Vec<Profile> {
    let Ok(path) = store_path() else { return Vec::new() };
    let Ok(text) = fs::read_to_string(path) else { return Vec::new() };
    let Ok(stored) = serde_json::from_str::<Vec<StoredProfile>>(&text) else { return Vec::new() };
    stored
        .into_iter()
        .map(|p| Profile {
            name: p.name,
            dialect: parse_dialect(&p.dialect),
            host: p.host,
            port: p.port,
            user: p.user,
            password: None,
            database: p.database,
        })
        .collect()
}

/// Writes profile settings to disk. Passwords never reach the file.
pub fn save(profiles: &[Profile]) -> Result<()> {
    let path = store_path()?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).context("create config directory")?;
    }
    let stored: Vec<StoredProfile> = profiles
        .iter()
        .map(|p| StoredProfile {
            name: p.name.clone(),
            dialect: dialect_key(p.dialect).to_string(),
            host: p.host.clone(),
            port: p.port,
            user: p.user.clone(),
            database: p.database.clone(),
        })
        .collect();
    fs::write(path, serde_json::to_string_pretty(&stored)?).context("write connections file")
}

/// Stores a password in the macOS Keychain under the profile name.
pub fn set_password(profile_name: &str, password: &str) -> Result<()> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, profile_name)?;
    entry.set_password(password)?;
    Ok(())
}

/// Reads a password from the Keychain. Returns `None` when none is stored.
pub fn password(profile_name: &str) -> Option<String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, profile_name)
        .ok()?
        .get_password()
        .ok()
}
