// Custom colour themes as TOML files in the user's config folder (see docs/eg-designs/theme-ui.md).
// Rust reads, validates, and writes the files. It does not know the built-in token keys; TypeScript checks those.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::State;

const RESERVED: [&str; 2] = ["haya-dark", "haya-light"];
const MAX_FILE_BYTES: u64 = 256 * 1024;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ThemeFile {
    pub id: String,
    pub name: String,
    pub mode: String,
    pub swatches: [String; 4],
    pub tokens: BTreeMap<String, String>,
}

#[derive(Serialize)]
pub struct ThemeLoad {
    pub themes: Vec<ThemeFile>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Debug)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SaveError {
    Exists { message: String },
    Invalid { message: String },
    Io { message: String },
}

#[derive(Default)]
pub struct ThemeStore(pub Mutex<()>);

/// Picks the folder: `$XDG_CONFIG_HOME/haya/themes` when that is an absolute path, else `$HOME/.config/haya/themes`.
pub fn theme_dir_from(xdg: Option<OsString>, home: Option<OsString>) -> Result<PathBuf, String> {
    let xdg = xdg.filter(|v| !v.is_empty()).map(PathBuf::from);
    if let Some(xdg) = xdg.filter(|p| p.is_absolute()) {
        return Ok(xdg.join("haya").join("themes"));
    }
    match home.filter(|v| !v.is_empty()) {
        Some(home) => Ok(PathBuf::from(home).join(".config").join("haya").join("themes")),
        None => Err("no home folder".into()),
    }
}

pub fn theme_dir() -> Result<PathBuf, String> {
    theme_dir_from(std::env::var_os("XDG_CONFIG_HOME"), std::env::var_os("HOME"))
}

/// 1 to 40 ASCII bytes. First byte `a-z` or `0-9`; the rest `a-z`, `0-9`, or `-`.
pub fn valid_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    if bytes.is_empty() || bytes.len() > 40 {
        return false;
    }
    let first_ok = matches!(bytes[0], b'a'..=b'z' | b'0'..=b'9');
    first_ok
        && bytes[1..]
            .iter()
            .all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9' | b'-'))
}

fn is_hex6(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].bytes().all(|b| b.is_ascii_hexdigit())
}

/// Checks a theme file and trims its name. Returns the reason on failure.
fn validate(theme: &mut ThemeFile) -> Result<(), String> {
    if !valid_id(&theme.id) {
        return Err("invalid id: 1 to 40 characters, a-z, 0-9, and '-', starting with a letter or digit".into());
    }
    if RESERVED.contains(&theme.id.as_str()) {
        return Err("reserved id".into());
    }
    theme.name = theme.name.trim().to_string();
    let len = theme.name.chars().count();
    if len == 0 || len > 40 {
        return Err("name must be 1 to 40 characters".into());
    }
    if theme.name.chars().any(|c| c.is_control()) {
        return Err("name contains control characters".into());
    }
    if theme.mode != "dark" && theme.mode != "light" {
        return Err("mode must be dark or light".into());
    }
    if !theme.swatches.iter().all(|s| is_hex6(s)) {
        return Err("swatches must be four #rrggbb colors".into());
    }
    for (key, value) in &theme.tokens {
        if !key.starts_with("--") {
            return Err(format!("token {key} must start with --"));
        }
        if !is_hex6(value) {
            return Err(format!("token {key} must be a #rrggbb color"));
        }
    }
    Ok(())
}

pub fn load_dir(base: &Path) -> Result<ThemeLoad, String> {
    match fs::metadata(base) {
        Ok(meta) if !meta.is_dir() => return Err(format!("{} is not a folder", base.display())),
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ThemeLoad { themes: vec![], warnings: vec![] });
        }
        Err(e) => return Err(e.to_string()),
    }

    let entries = fs::read_dir(base).map_err(|e| e.to_string())?;
    let mut themes = Vec::new();
    let mut warnings = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                warnings.push(format!("folder entry: {e}"));
                continue;
            }
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || !name.ends_with(".toml") {
            continue;
        }
        let path = entry.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(meta) => meta,
            Err(e) => {
                warnings.push(format!("{name}: {e}"));
                continue;
            }
        };
        if meta.file_type().is_symlink() {
            warnings.push(format!("{name}: symlink, not loaded"));
            continue;
        }
        if !meta.is_file() {
            continue;
        }
        if meta.len() > MAX_FILE_BYTES {
            warnings.push(format!("{name}: file too large"));
            continue;
        }
        let text = match fs::read_to_string(&path) {
            Ok(text) => text,
            Err(e) => {
                warnings.push(format!("{name}: {e}"));
                continue;
            }
        };
        let mut theme: ThemeFile = match toml::from_str(&text) {
            Ok(theme) => theme,
            Err(e) => {
                warnings.push(format!("{name}: invalid TOML: {e}"));
                continue;
            }
        };
        if format!("{}.toml", theme.id) != name {
            warnings.push(format!("{name}: file name must be {}.toml", theme.id));
            continue;
        }
        match validate(&mut theme) {
            Ok(()) => themes.push(theme),
            Err(reason) => warnings.push(format!("{name}: {reason}")),
        }
    }

    themes.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(ThemeLoad { themes, warnings })
}

fn temp_path(base: &Path, id: &str) -> PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    base.join(format!(".{id}.{}.{nanos}.tmp", std::process::id()))
}

pub fn save_dir(base: &Path, store: &ThemeStore, theme: &ThemeFile, overwrite: bool) -> Result<(), SaveError> {
    let _guard = store.0.lock().map_err(|_| SaveError::Io { message: "theme store is unavailable".into() })?;

    let mut theme = theme.clone();
    validate(&mut theme).map_err(|message| SaveError::Invalid { message })?;

    fs::create_dir_all(base).map_err(|e| SaveError::Io { message: e.to_string() })?;
    let path = base.join(format!("{}.toml", theme.id));
    if fs::symlink_metadata(&path).map(|m| m.file_type().is_symlink()).unwrap_or(false) {
        return Err(SaveError::Invalid { message: "the file is a symlink; it was not replaced".into() });
    }

    let mut toml = toml::to_string(&theme).map_err(|e| SaveError::Io { message: e.to_string() })?;
    if !toml.ends_with('\n') {
        toml.push('\n');
    }

    let temp = temp_path(base, &theme.id);
    let written = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(toml.as_bytes())?;
        file.sync_all()
    })();
    if let Err(e) = written {
        let _ = fs::remove_file(&temp);
        return Err(SaveError::Io { message: e.to_string() });
    }

    let committed = if overwrite {
        fs::rename(&temp, &path).map_err(|e| SaveError::Io { message: e.to_string() })
    } else {
        match fs::hard_link(&temp, &path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                Err(SaveError::Exists { message: "a theme with this id already exists".into() })
            }
            // Some file systems do not support hard links. The store lock serializes this app's writes,
            // so a check and a rename is enough here.
            Err(_) if path.exists() => Err(SaveError::Exists { message: "a theme with this id already exists".into() }),
            Err(_) => fs::rename(&temp, &path).map_err(|e| SaveError::Io { message: e.to_string() }),
        }
    };
    let _ = fs::remove_file(&temp);
    committed
}

pub fn delete_dir(base: &Path, store: &ThemeStore, id: &str) -> Result<(), String> {
    let _guard = store.0.lock().map_err(|_| "theme store is unavailable".to_string())?;
    if !valid_id(id) {
        return Err("invalid theme id".into());
    }
    let path = base.join(format!("{id}.toml"));
    match fs::symlink_metadata(&path) {
        Ok(meta) if meta.file_type().is_symlink() => {
            Err(format!("{id}.toml is a symlink; remove the link yourself"))
        }
        Ok(_) => fs::remove_file(&path).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn themes_load() -> Result<ThemeLoad, String> {
    load_dir(&theme_dir()?)
}

#[tauri::command]
pub fn theme_save(store: State<'_, ThemeStore>, theme: ThemeFile, overwrite: bool) -> Result<(), SaveError> {
    let base = theme_dir().map_err(|message| SaveError::Io { message })?;
    save_dir(&base, &store, &theme, overwrite)
}

#[tauri::command]
pub fn theme_delete(store: State<'_, ThemeStore>, id: String) -> Result<(), String> {
    delete_dir(&theme_dir()?, &store, &id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(id: &str) -> ThemeFile {
        let mut tokens = BTreeMap::new();
        tokens.insert("--bg".to_string(), "#181a1c".to_string());
        tokens.insert("--text".to_string(), "#e8ebef".to_string());
        ThemeFile {
            id: id.into(),
            name: "My Dark".into(),
            mode: "dark".into(),
            swatches: ["#181a1c".into(), "#e7edf5".into(), "#e8b84a".into(), "#86c79a".into()],
            tokens,
        }
    }

    fn write_file(dir: &Path, name: &str, body: &str) {
        fs::write(dir.join(name), body).unwrap();
    }

    #[test]
    fn valid_id_accepts_and_rejects_the_documented_cases() {
        assert!(valid_id("a"));
        assert!(valid_id("a-b"));
        assert!(valid_id(&"a".repeat(40)));
        assert!(!valid_id(""));
        assert!(!valid_id(&"a".repeat(41)));
        assert!(!valid_id("-a"));
        assert!(!valid_id("A"));
        assert!(!valid_id("../x"));
        assert!(!valid_id("a b"));
    }

    #[test]
    fn theme_dir_prefers_absolute_xdg_then_home() {
        let abs = theme_dir_from(Some("/x/cfg".into()), Some("/home/u".into())).unwrap();
        assert_eq!(abs, PathBuf::from("/x/cfg/haya/themes"));
        let relative = theme_dir_from(Some("cfg".into()), Some("/home/u".into())).unwrap();
        assert_eq!(relative, PathBuf::from("/home/u/.config/haya/themes"));
        let empty = theme_dir_from(Some("".into()), Some("/home/u".into())).unwrap();
        assert_eq!(empty, PathBuf::from("/home/u/.config/haya/themes"));
        assert!(theme_dir_from(None, None).is_err());
    }

    #[test]
    fn missing_folder_loads_empty_without_warning() {
        let dir = tempfile::tempdir().unwrap();
        let load = load_dir(&dir.path().join("absent")).unwrap();
        assert!(load.themes.is_empty() && load.warnings.is_empty());
    }

    #[test]
    fn base_that_is_a_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("plain");
        fs::write(&file, "x").unwrap();
        assert!(load_dir(&file).is_err());
    }

    #[test]
    fn save_then_load_round_trips_and_trims_name() {
        let dir = tempfile::tempdir().unwrap();
        let store = ThemeStore::default();
        let mut theme = sample("my-dark");
        theme.name = "  My Dark  ".into();
        save_dir(dir.path(), &store, &theme, false).unwrap();
        let load = load_dir(dir.path()).unwrap();
        assert!(load.warnings.is_empty());
        assert_eq!(load.themes.len(), 1);
        assert_eq!(load.themes[0].name, "My Dark");
        assert_eq!(load.themes[0].tokens, theme.tokens);
    }

    #[test]
    fn save_without_overwrite_returns_exists_and_overwrite_replaces() {
        let dir = tempfile::tempdir().unwrap();
        let store = ThemeStore::default();
        save_dir(dir.path(), &store, &sample("t1"), false).unwrap();
        let again = save_dir(dir.path(), &store, &sample("t1"), false);
        assert!(matches!(again, Err(SaveError::Exists { .. })));
        let mut changed = sample("t1");
        changed.name = "Changed".into();
        save_dir(dir.path(), &store, &changed, true).unwrap();
        assert_eq!(load_dir(dir.path()).unwrap().themes[0].name, "Changed");
    }

    #[test]
    fn concurrent_saves_without_overwrite_let_exactly_one_win() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_path_buf();
        let store = std::sync::Arc::new(ThemeStore::default());
        let handles: Vec<_> = (0..4)
            .map(|_| {
                let base = base.clone();
                let store = store.clone();
                std::thread::spawn(move || save_dir(&base, &store, &sample("race"), false).is_ok())
            })
            .collect();
        let wins = handles.into_iter().filter_map(|h| h.join().ok()).filter(|ok| *ok).count();
        assert_eq!(wins, 1);
    }

    #[test]
    fn atomic_write_failure_leaves_no_temp_and_no_target() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("blocked.toml")).unwrap();
        let store = ThemeStore::default();
        let result = save_dir(dir.path(), &store, &sample("blocked"), true);
        assert!(matches!(result, Err(SaveError::Io { .. })));
        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn reserved_and_invalid_saves_are_rejected_before_any_path_is_built() {
        let dir = tempfile::tempdir().unwrap();
        let store = ThemeStore::default();
        assert!(matches!(save_dir(dir.path(), &store, &sample("haya-dark"), false), Err(SaveError::Invalid { .. })));
        assert!(matches!(save_dir(dir.path(), &store, &sample("../x"), false), Err(SaveError::Invalid { .. })));
        assert!(delete_dir(dir.path(), &store, "../x").is_err());
    }

    #[test]
    fn delete_missing_is_ok_and_symlink_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let store = ThemeStore::default();
        assert!(delete_dir(dir.path(), &store, "nothing").is_ok());
        let target = dir.path().join("target.txt");
        fs::write(&target, "keep").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&target, dir.path().join("linked.toml")).unwrap();
            assert!(delete_dir(dir.path(), &store, "linked").is_err());
            assert!(fs::symlink_metadata(dir.path().join("linked.toml")).is_ok());
            assert_eq!(fs::read_to_string(&target).unwrap(), "keep");
        }
    }

    #[test]
    fn bad_files_become_warnings_and_good_ones_still_load() {
        let dir = tempfile::tempdir().unwrap();
        let store = ThemeStore::default();
        save_dir(dir.path(), &store, &sample("good"), false).unwrap();
        write_file(dir.path(), "badcolor.toml", "id = \"badcolor\"\nname = \"x\"\nmode = \"dark\"\nswatches = [\"#000000\",\"#000000\",\"#000000\",\"red\"]\n[tokens]\n");
        write_file(dir.path(), "mismatch.toml", &toml::to_string(&sample("other")).unwrap());
        write_file(dir.path(), "haya-dark.toml", &toml::to_string(&sample("haya-dark")).unwrap());
        write_file(dir.path(), "notes.txt", "ignored");
        write_file(dir.path(), ".hidden.toml", "ignored");
        let load = load_dir(dir.path()).unwrap();
        assert_eq!(load.themes.len(), 1);
        assert_eq!(load.themes[0].id, "good");
        assert_eq!(load.warnings.len(), 3);
        assert!(load.warnings.iter().any(|w| w.starts_with("haya-dark.toml: reserved id")));
    }

    #[test]
    fn invalid_toml_and_oversized_files_are_skipped_with_warnings() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "broken.toml", "not = [valid");
        write_file(dir.path(), "big.toml", &"#".repeat((MAX_FILE_BYTES + 1) as usize));
        let load = load_dir(dir.path()).unwrap();
        assert!(load.themes.is_empty());
        assert_eq!(load.warnings.len(), 2);
    }

    #[test]
    fn name_length_counts_scalars_not_bytes() {
        let mut ok = sample("names");
        ok.name = "é".repeat(40);
        assert!(validate(&mut ok).is_ok());
        let mut too_long = sample("names");
        too_long.name = "é".repeat(41);
        assert!(validate(&mut too_long).is_err());
    }

    #[test]
    fn reserved_ids_match_the_typescript_list() {
        assert_eq!(RESERVED, ["haya-dark", "haya-light"]);
    }
}
