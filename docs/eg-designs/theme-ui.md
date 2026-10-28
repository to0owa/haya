# Design: Themes as files, and the theme list UI (revision 8)

Revision 8 answers the open questions from Pass B and Pass C in rounds 5 and 6. It is one consistent design. Relative paths are rooted as follows:
- Frontend: `apps/haya-desktop/src/haya/` (for example `theme/themes.ts`, `components/Icon.svelte`).
- Rust: `apps/haya-desktop/src-tauri/src/`.
- Repo docs: `docs/`.

## Why
The Color theme list hardcodes Dark and Light headings and only selects. Custom themes have nowhere to live, and rows do not follow the shared control states. Custom themes become TOML files in the user's config folder, so they are easy to add, share, and later mix with plugin files.

## Scope
In:
- Custom themes as TOML files in `~/.config/haya/themes/`. `$XDG_CONFIG_HOME/haya/themes/` is used instead when `XDG_CONFIG_HOME` is an absolute path. That branch only applies when the app is started from a terminal (development). A Finder launch does not inherit shell variables and uses `HOME`.
- Load, save, and delete of those files through three Tauri commands.
- Groups derived from data: Dark, then Light. Custom themes sit inside their mode group.
- A card grid with groups as disclosures. Each card has a "⋯" menu in Preferences only.
- "+ New" duplicates the active theme (Preferences only).
- The picker popover shows the same grid and groups without management actions.
- Preferences restyle to the squircle language, for every section of the dialog, in this pass.

Out:
- The token editor. Edit is a disabled entry point with a visible reason.
- Moving app state (workspaces, connections, wallpapers) to `~/.config`. Those stay in `~/Library/Application Support/Haya/`.
- Import, export, sharing. Update system (tracked in `docs/TODO.md`).

## Where things live
- Built-in themes: `HAYA_DARK`, `HAYA_LIGHT`, and the array `THEMES` in `src/haya/theme/themes.ts`. `THEMES` keeps its name and now means "built-in themes". It is bundled, always available, and has `custom: false`.
- `ANSI_LIGHT` and `extendedAnsiLight()` stay exported from `themes.ts` unchanged. `Terminal.svelte` imports them (lines 11 and 68).
- Custom theme files: `src-tauri/src/themes.rs` reads, validates, and writes them. Rust does not know built-in token keys.
- Missing-token fill-in and unknown-key checks: `themes.ts`, function `normalizeTheme`.
- Loaded custom list, selection, load status, and the terminal refresh counter: `src/haya/theme/theme.svelte.ts`, in the `themeState` store.
- Antrean dan rejection handling: `src/haya/theme/queue.ts` (pure, new).

## File format
TOML, one file per custom theme. Example `my-dark.toml`:
```toml
id = "my-dark"
name = "My Dark"
mode = "dark"
swatches = ["#181a1c", "#e7edf5", "#e8b84a", "#86c79a"]

[tokens]
"--bg" = "#181a1c"
"--text" = "#e8ebef"
```

### Rust checks (load and save)
- `id` passes `valid_id` (below). The file name must be exactly `<id>.toml`. Case matters: `Foo.toml` with `id = "foo"` is a name mismatch on load and is skipped with a warning.
- `id` must not be reserved: `haya-dark` or `haya-light` is `Invalid` on save, and a file with a reserved id is skipped with the warning `"<name>: reserved id"` on load.
- `name`: trimmed first, then the trimmed value must be 1 to 40 Unicode scalar values (`chars().count()`), with no `char::is_control()` characters. Load and save use the same check. The trimmed value is what is stored. Bytes are not used.
- `mode` is exactly `dark` or `light`.
- `swatches` has exactly four strings, each `#` followed by six hex digits. Hex digits may be upper or lower case, and values are stored as written.
- `tokens` is a table. Every key starts with `--`. Every value is `#` followed by six hex digits.
- Unknown top-level keys are ignored (serde default). They are not warnings. Token keys are checked against the built-in list in TypeScript, not in Rust.
- A file over 256 KiB (checked with metadata before reading) is skipped with the warning `"<name>: file too large"`.
- A TOML parse error, a missing required field, or a read error is one warning for that file. The file is skipped.

`valid_id(id: &str) -> bool` in `themes.rs` is hand-written, not a regex. It returns true when the id is 1 to 40 ASCII bytes, the first byte is `a-z` or `0-9`, and each later byte is `a-z`, `0-9`, or `-`. Save and delete both use it.

## Rust interfaces (`src-tauri/src/themes.rs`, new)
```rust
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ThemeFile {
    pub id: String,
    pub name: String,
    pub mode: String,
    pub swatches: [String; 4],
    pub tokens: BTreeMap<String, String>,
}

#[derive(Serialize)]
pub struct ThemeLoad { pub themes: Vec<ThemeFile>, pub warnings: Vec<String> }

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SaveError {
    Exists { message: String },   // overwrite was false and the file is there
    Invalid { message: String },  // failed the checks above, reserved id, symlink at the path
    Io { message: String },       // anything else, including a poisoned lock
}

#[derive(Default)]
pub struct ThemeStore(pub Mutex<()>);   // serializes writes and deletes

pub fn theme_dir_from(xdg: Option<OsString>, home: Option<OsString>) -> Result<PathBuf, String>;
pub fn theme_dir() -> Result<PathBuf, String>;   // reads the env vars, calls theme_dir_from
pub fn valid_id(id: &str) -> bool;
pub fn load_dir(base: &Path) -> Result<ThemeLoad, String>;
pub fn save_dir(base: &Path, store: &ThemeStore, theme: &ThemeFile, overwrite: bool) -> Result<(), SaveError>;
pub fn delete_dir(base: &Path, store: &ThemeStore, id: &str) -> Result<(), String>;

#[tauri::command] pub fn themes_load() -> Result<ThemeLoad, String>;
#[tauri::command] pub fn theme_save(store: State<'_, ThemeStore>, theme: ThemeFile, overwrite: bool) -> Result<(), SaveError>;
#[tauri::command] pub fn theme_delete(store: State<'_, ThemeStore>, id: String) -> Result<(), String>;
```
- The commands are synchronous, like the existing commands (`wallpaper::wallpaper_import`, `pty_spawn`). The file work is small (one TOML file), so this is a deliberate choice.
- `theme_dir_from`: if `xdg` is `Some`, not empty, and an absolute path, the base is `xdg/haya/themes`. Otherwise, if `home` is `Some` and not empty, the base is `home/.config/haya/themes`. Otherwise `Err("no home folder")`. `theme_dir` passes `env::var_os("XDG_CONFIG_HOME")` and `env::var_os("HOME")`. Tests call `theme_dir_from` directly. No test sets environment variables, so there is no `unsafe` env mutation under edition 2024.
- `*_dir` functions take `base` and, for writes, the store. Commands call `theme_dir()` once, then the `*_dir` function. Tests pass a temporary folder and a fresh `ThemeStore`.
- Lock poisoning: `store.0.lock()` failing maps to `SaveError::Io` in `save_dir` and `Err(String)` in `delete_dir`. Nothing panics.
- `lib.rs`:
  - `mod themes;` next to `mod wallpaper;` (around line 106).
  - `.manage(themes::ThemeStore::default())` next to the existing `.manage` calls.
  - `themes::themes_load`, `themes::theme_save`, and `themes::theme_delete` added to `generate_handler!` (around lines 112–114 and 119), module-qualified like `wallpaper::wallpaper_import`.
- Capabilities: no change. `src-tauri/build.rs` is a plain `tauri_build::build()`. `capabilities/default.json` lists only core, opener, notification, and window permissions. App commands need no entries.
- Dependencies: `src-tauri/Cargo.toml` `[dependencies]` gets `toml = "0.8"`. `serde` is already present. `[dev-dependencies]` gets `tempfile = "3"`. No regex crate.

### Save
1. `theme_save` validates `ThemeFile` with the checks above. Reserved id or any failure returns `Invalid`.
2. Lock the store. Build the path only after `valid_id` passes: `base.join(format!("{id}.toml"))`. An id that fails `valid_id` returns `Invalid` before a path is built. This blocks `../` traversal.
3. `create_dir_all(base)`. If `symlink_metadata(path)` succeeds and the entry is a symlink, return `Invalid` with "is a symlink; not replaced". A dotfiles link is never turned into a regular file.
4. Write a temp file in `base` with `OpenOptions::create_new`, named `.{id}.{pid}.{nanos}.tmp`. Write the TOML and `sync_all`.
5. Commit, without a check-then-act race:
   - `overwrite = false`: `fs::hard_link(temp, path)`. The kernel fails with `AlreadyExists` if the file is there, which returns `Exists`. Then remove the temp file. This is atomic; there is no separate `exists()` check.
   - `overwrite = true`: `fs::rename(temp, path)`.
   - Any failure after the temp file exists: remove the temp file and return `Io`, or `Exists` for the `AlreadyExists` case.
6. The temp name uses only `std` (`std::process::id()` and `SystemTime` nanos).

### Load
- `Ok` with empty `themes` and no warning: the base folder does not exist.
- `Err(message)`: the base path exists but is not a directory, or `read_dir` fails. A `theme_dir()` failure is also `Err`. Failure is at the folder level only.
- Entries, per entry, never failing the whole load:
  - Symlinks (`symlink_metadata`): skipped with one warning `"<name>: symlink, not loaded"`.
  - Directories: skipped silently.
  - Names that do not end in `.toml`, or start with `.`: ignored silently.
  - A `.toml` file over 256 KiB, unreadable, invalid TOML, failing the Rust checks, reserved, or whose name is not `<id>.toml`: one warning `"<name>: <reason>"`. The file is skipped.
- Load applies the same name trim and length rule as save. A name that is blank after trimming is a warning.

### Delete
- Lock the store. `valid_id` first; invalid returns `Err`.
- A symlink at the path returns `Err("<id>.toml is a symlink; remove the link yourself")`. Delete never removes through a link.
- A missing `<id>.toml` returns `Ok` (idempotent). Other removal failures return `Err`.

## TypeScript interfaces (`src/haya/theme/themes.ts`, pure)
```ts
export type ThemeMode = "dark" | "light";
export interface Theme {
  id: string; name: string; mode: ThemeMode;
  swatches: [string, string, string, string];   // four colors, one per strip column
  tokens: Record<string, string>;
  custom: boolean;                               // false for HAYA_DARK and HAYA_LIGHT; true for files
}
export interface ThemeGroup { mode: ThemeMode; label: string; themes: Theme[] }
export interface ThemeFileDto {                  // the shape returned by themes_load and sent to theme_save
  id: string; name: string; mode: string; swatches: string[]; tokens: Record<string, string>;
}
export interface SaveErrorDto { kind: "exists" | "invalid" | "io"; message: string }

export const HAYA_DARK: Theme;                   // existing, now with custom: false
export const HAYA_LIGHT: Theme;                  // existing, now with custom: false
export const THEMES: Theme[];                    // existing name; the built-in list, [HAYA_DARK, HAYA_LIGHT]
export const DEFAULT_THEME_ID = HAYA_DARK.id;    // existing
export const RESERVED_THEME_IDS: readonly string[] = ["haya-dark", "haya-light"];
export const MODE_LABELS: Record<ThemeMode, string> = { dark: "Dark", light: "Light" };
export const ANSI_LIGHT: Record<string, string>; // existing, unchanged
export function extendedAnsiLight(): string[];   // existing, unchanged

export function findTheme(list: Theme[], id: string): Theme | undefined;   // CHANGED: takes the list, no fallback to HAYA_DARK
export function groupThemes(list: Theme[]): ThemeGroup[];
  // Order: dark, then light. Within a group: custom false first in list order, then custom true sorted by name with localeCompare(..., { sensitivity: "base" }), ties by id. Empty groups omitted.
export function defaultOf(list: Theme[], mode: ThemeMode): Theme | undefined;   // first theme with custom false and that mode
export function copyId(taken: string[], base: string): string;   // base truncated to 32 chars, then "-copy", "-copy-2", ... unique against taken
export function copyName(name: string): string;   // base truncated by code points so the result is at most 40 code points, then " copy"
export function toFileDto(theme: Theme): ThemeFileDto;   // copies id, name, mode, swatches (as a 4-element array), tokens; drops custom
export function fromFile(file: ThemeFileDto): Theme;      // maps mode, sets custom: true; does not check tokens
export function normalizeTheme(theme: Theme, builtin: Theme): { theme: Theme | null; warnings: string[] };
  // Missing keys copied from builtin, no warning. A key the builtin does not define: theme is null, warning "<name>: unknown token <key>". The caller skips a null theme.
export function parseStored(raw: string | null): { id: string; mode: ThemeMode | null } | null;
export function resolveStored(raw: string | null, list: Theme[], loaded: boolean): { id: string; mode: ThemeMode; clear: boolean };
export function serializeStored(id: string, mode: ThemeMode): string;   // JSON {"id","mode"}
export function parseGroupState(raw: string | null): Record<ThemeMode, boolean>;   // {dark, light} collapsed flags; malformed or missing means all false
export function serializeGroupState(state: Record<ThemeMode, boolean>): string;
export function filterGroups(groups: ThemeGroup[], query: string): ThemeGroup[];
  // Case-insensitive match on name. Groups with no match dropped. Empty query returns groups unchanged.
export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";
export function nextCardId(rows: string[][], columns: number, current: string, key: GridKey): string | null;
export function tokenRemovals(prev: Record<string, string>, next: Record<string, string>, known: string[]): string[];
  // Keys in known that next does not set. applyTheme removes these.
export type SaveResult = { ok: true } | { ok: false; kind: "exists" | "invalid" | "io"; message: string };
export function saveResultFrom(error: unknown): SaveResult;   // see Rejection shapes
export function errorMessage(error: unknown): string;          // see Rejection shapes
export async function runDuplicate(
  source: Theme, taken: string[], save: (copy: Theme) => Promise<SaveResult>, attempts?: number,
): Promise<{ ok: true; copy: Theme } | { ok: false; kind: "invalid" | "io"; message: string } | { ok: false; kind: "exhausted" }>;
  // Up to 50 attempts (attempts default 50). For each: copy = {...source, id: copyId(taken, source.id), name: copyName(source.name), custom: true}. On ok, return copy. On exists, push copy.id into taken and try again. On invalid or io, return that failure. After the last exists, return exhausted.
```

### parseStored, in this order
1. `null` or empty: `null`.
2. The raw string passes the `valid_id` character rules (1 to 40 ASCII characters): an old bare id. Return `{ id: raw, mode: null }`. This check runs before JSON, so `123` and `true` are bare ids, not JSON.
3. Otherwise `JSON.parse` in a try. The result must be an object with `id` a valid-looking id string and `mode` exactly `"dark"` or `"light"`. Return `{ id, mode }`.
4. Anything else, including a parse error: `null`.

### resolveStored, in this order
1. `parseStored(raw)` is `null`: return `{ id: DEFAULT_THEME_ID, mode: "dark", clear: false }`. Nothing is stored, so nothing is cleared.
2. The id is in `list`: return it with its `mode` from the theme, `clear: false`. A bare id takes its mode from the theme it names.
3. The id is not in `list` and `loaded` is `false`: return the stored id with `mode` from the stored value (`"dark"` if `null`), `clear: false`. The id stays selected until the list loads.
4. The id is not in `list` and `loaded` is `true`: return `defaultOf(list, mode)` for the stored mode (`"dark"` if `null`), `clear: true`. The caller rewrites storage.

### Rejection shapes
- `errorMessage(error)`: a string returns itself. An object with a string `message` returns it. Anything else returns `"unexpected error"`.
- `saveResultFrom(error)`:
  - An object with `kind` in `exists`, `invalid`, `io` (a `SaveErrorDto` from Rust) maps to that kind with its `message`.
  - A plain string (a Tauri argument-deserialization error, for example a swatch count other than four) maps to `invalid` with that string.
  - Anything else (for example a `TypeError` when Tauri is not present, as on the Vite page) maps to `io` with `errorMessage(error)`.
- The same function serves `theme_delete` and `themes_load` failures through `errorMessage`.

## TypeScript state (`src/haya/theme/theme.svelte.ts`)
One module store holds all theme state. Components read it. Nothing lives inside a component, so an unmount during an in-flight call cannot leave stale state.

```ts
export const themeState = $state({
  id: DEFAULT_THEME_ID,          // selected id; may be a custom id that is not loaded yet
  mode: "dark" as ThemeMode,
  pickerOpen: false,
  custom: [] as Theme[],         // loaded custom themes
  loaded: false,                 // true only after a successful themes_load
  loadError: null as string | null,
  version: 0,                    // incremented by every applyTheme; the terminal watches it
});
```
- `allThemes(): Theme[]` returns `[...THEMES, ...themeState.custom]`. It is the only combined list.
- `currentTheme(): Theme | undefined` returns `findTheme(allThemes(), themeState.id)`. No fallback; the grid shows no selected card when it is undefined.
- `setTheme(id: string)` keeps its signature. Unknown id: no-op. Otherwise it sets `themeState.id` and `themeState.mode`, calls `applyTheme`, writes storage with `serializeStored`, and closes the picker.
- `applyTheme(theme: Theme)`: for each key in `tokenRemovals(lastApplied, theme.tokens, allTokenKeys())`, call `removeProperty`. Then set every key of `theme.tokens`. Then set `data-theme` and `color-scheme` on `document.documentElement`, write the token cache, and increment `themeState.version`. `lastApplied` is the module variable holding the last applied token object. `allTokenKeys()` is the union of token keys across `allThemes()`.
- Storage: `haya.theme` holds the JSON from `serializeStored`. `write()` changes from bare id to JSON. Old bare-id values are read by `parseStored`, then rewritten by the next `setTheme` or reconcile.
- Token cache: `haya.theme.tokens` holds the JSON of the applied token object, written by `applyTheme`. It is a per-viewer convenience cache.
- No-flash startup: `src/app.html` gets an inline `<script>` placed before `%sveltekit.head%` (which is where the styles arrive). The script reads `haya.theme.tokens` and sets each property on `document.documentElement`. It reads `haya.theme`: if the value is JSON with a `mode` of `dark` or `light`, it sets `data-theme` and `color-scheme`. An old bare-id value has no mode and is skipped. The whole script is wrapped in try/catch. The cached theme is applied before first paint.
- `initTheme()` (existing, still called from `onMount` in `src/routes/+page.svelte`): `resolveStored(read(), THEMES, false)`. It sets `themeState.id` and `themeState.mode`. If the token cache was missing, it applies the built-in theme with the resolved id. It writes nothing unless `clear` is true, which cannot happen here.

### Queue and reload
- `src/haya/theme/queue.ts` (pure, new): `createQueue()` returns `enqueue<T>(fn: () => Promise<T>): Promise<T>`. Each call runs after the previous one has settled, whether it resolved or rejected. The chain stores `prev.catch(() => {})` and returns the promise of `fn`, so one failure does not stop later calls. There is no timeout; `invoke` calls on local files are accepted as not hanging. This is a deliberate choice.
- The queue lives in `theme.svelte.ts`: `const enqueue = createQueue();`.
- Internal, unqueued functions, called only from inside a queued function:
  - `reloadLocked(): Promise<void>`: calls `invoke("themes_load")` with no arguments. On rejection: `loadError = errorMessage(e)`, `loaded` stays false, one error toast "Could not read the themes folder: <message>", return. On success: `fromFile` each entry, `normalizeTheme` each against `defaultOf(THEMES, mode)`. Each returned warning becomes one info toast "Skipped <warning>". Accepted themes go into `themeState.custom`, `loaded = true`, `loadError = null`. Then reconcile.
  - Reconcile: `resolveStored(read(), allThemes(), true)`. Set `themeState.id` and `themeState.mode`. If `clear` is true, write storage. Then always `applyTheme(findTheme(allThemes(), id))` if found. This applies the file's tokens, so an edited file takes effect now.
  - `saveLocked(theme: Theme, overwrite: boolean): Promise<SaveResult>`: `invoke("theme_save", { theme: toFileDto(theme), overwrite })`. Resolves to `{ ok: true }`, or `saveResultFrom(e)` on rejection. `invalid` and `io` show one error toast with `message`. Does not reload.
  - `deleteLocked(id)`: see below.
- Public, queued:
  - `loadCustomThemes()` = `enqueue(reloadLocked)`. Called from `onMount` in `ThemeList.svelte`, so it runs whenever the list mounts: on Preferences open (the list is inside the open dialog) and on picker open.
  - `saveTheme(theme, overwrite)` = `enqueue(() => saveLocked(theme, overwrite))`.
  - `duplicate(source: Theme)` = `enqueue(async () => {...})`:
    1. `taken = allThemes().map(t => t.id)`.
    2. `result = await runDuplicate(source, taken, copy => saveLocked(copy, false))`.
    3. On `ok`: push `copy` into `themeState.custom` immediately, so the list has it even if the reload fails. Then `await reloadLocked()` inside its own try; on failure show an error toast "Saved, but the list could not be refreshed." Then `setTheme(copy.id)`.
    4. On failure: an error toast with the message (`exhausted` says "Could not find a free name for the copy."). Then `reloadLocked()` to resync.
  - `deleteTheme(id: string)` = `enqueue(async () => {...})`:
    1. Capture `const mode = themeState.custom.find(t => t.id === id)?.mode`, and `wasActive = themeState.id === id`, before any await.
    2. `invoke("theme_delete", { id })`. On rejection: error toast with `errorMessage`, state unchanged, return.
    3. On success: remove the theme from `themeState.custom`. If `wasActive`, `setTheme(defaultOf(allThemes(), mode ?? "dark")?.id ?? DEFAULT_THEME_ID)`.
- Disabled rules: while `themeState.loaded` is false, "+ New", Duplicate, and Delete are disabled. Reasons: "Themes are still loading." while `loadError` is null, and "The themes folder could not be read." once it is set. The reason shows as a tooltip and as a line in the "⋯" menu.
- Toast kinds: `notify` supports `info`, `success`, `error`. Skipped files use `info`. Failures use `error`.
- Invoke argument names: `themes_load` has none. `theme_save` takes `{ theme, overwrite }`. `theme_delete` takes `{ id }`.

## Terminal
- `Terminal.svelte` line 100 has `void themeState.id;` as the effect dependency, and line 104 sets `term.options.theme = termTheme()`. Change the dependency to `void themeState.version;`. Token-only changes then repaint the terminal.
- `termTheme()` (line 58) reads `--terminal-bg`, `--terminal-fg`, `--terminal-cursor`, and `--terminal-selection` from computed style. Every theme's `tokens` must set them. `normalizeTheme` fills them from the built-in of the same mode when missing, so every theme has them.
- Closes "Terminal palette follows the theme tokens" in `docs/TODO.md`.

## Svelte components
- `src/haya/theme/ThemeList.svelte` (rewritten), props `manage: boolean` (default `false`):
  - `onMount`: `loadCustomThemes()`. Teardown is not needed (no listeners).
  - `manage = false` (`ThemePicker.svelte`): groups and cards only.
  - `manage = true` (`Preferences.svelte`, `manage={true}`): adds a header row below Preferences' `<h3>Color theme</h3>`, with "+ New" right-aligned, and each card gets a "⋯" button.
  - Renders the search field when `allThemes().length > 8`.
  - Renders the delete `<dialog>` only when `manage` is true. The picker never shows it.
- `src/haya/components/Swatch.svelte` (existing; `ThemeList.svelte` already imports it): changes from four dots to a strip. Props `colors` and `label` stay. It renders `<span class="haya-swatch-strip" role="img" aria-label={label}>` with four child `<span>` elements. Their `style="background: {color}"` stays inline, because the colors are data. The strip is a CSS grid, four equal columns, height `--haya-card-strip-h`.
- `src/haya/theme/ThemeMenu.svelte` (new). ContextMenu is not reused. It is point-based, and `EditLayer.svelte` and `Bar.svelte` depend on it.
  - Props: `trigger: HTMLElement`, `items: { label: string; disabled?: boolean; reason?: string; onselect: () => void }[]`, `onclose: () => void`.
  - Placement: below the trigger, right edge aligned to the trigger's right edge. If there is less than 8px below before `window.innerHeight`, it opens above. Horizontal position is clamped to 8px inside the viewport.
  - Opening: focus goes to the first enabled item. Arrow Up and Down move between items. Enter activates. Escape closes and returns focus to `trigger` if `trigger.isConnected`.
  - Opening also sets `keyRecording.id = null`, so a keymap recording cannot consume the Escape.
  - Escape: a capture-phase `keydown` listener on `window`, added on open and removed on teardown. It calls `preventDefault()` and `stopImmediatePropagation()`. It is registered last, so it runs after the capture listeners already on `window` (`recordKey` in `Preferences.svelte`, `handleKey` in `+page.svelte`). No keymap binds Escape: a search of `src/haya` for Escape bindings found none. Preferences' `onkey` is a bubble listener on `window`, so it never sees an Escape this listener consumed.
  - Outside click: a capture-phase `mousedown` listener on `window`, added on open and removed on teardown. `ContextMenu.svelte` uses a bubble-phase `mousedown`. ThemeMenu uses capture on purpose, so it can stop the event before the Preferences scrim sees it. A `mousedown` inside `trigger` or the menu is ignored. Any other `mousedown` closes the menu and calls `stopPropagation()`. One click on the scrim then closes only the menu.
- Delete confirmation: a native `<dialog>` opened with `showModal()`, rendered inside `ThemeList` in manage mode.
  - Escape closes the dialog natively.
  - `Preferences.svelte` `onkey` changes to: `if (prefs.open && event.key === "Escape" && !document.querySelector("dialog[open]")) closePreferences();`. It closes Preferences on any Escape today (lines 93–95), so this change is required. Keydown fires before the native close, so the check sees the open dialog.
  - On close, focus goes to the card's "⋯" button if `isConnected`, otherwise the grid container (`tabindex="-1"`).
- `Preferences.svelte`: passes `manage={true}`. Its scrim and `closePreferences` are unchanged. Its section markup is wrapped as described under Preferences restyle.
- `src/haya/theme/ThemePicker.svelte`: uses `ThemeList` with the default `manage`. Width stays 232px.

## Card
- Each theme is a `div.haya-theme-card` in its group's grid, `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`, gap `--haya-card-gap` (6px). It reflows with the 232px popover and the wider Preferences pane.
- Fixed height `--haya-card-h` (68px), so an empty badge row causes no layout shift.
- Inside the card, top to bottom:
  - Strip: `Swatch`, height `--haya-card-strip-h` (24px), flush with the card's top edge. The card clips it to its radius.
  - Body: `button.haya-theme-card-body` (the select button) with padding 6px on the sides and bottom and a 6px gap below the strip. It contains:
    - Name: one line, 16px line height, 12px font, ellipsis, full name in `title`.
    - Gap 2px.
    - Badge row, 14px high. "default" (11px, muted) at the left when the theme is its mode's default. A selected card shows the `check` icon in a 14px circle at the right. The row is always present.
- "⋯" button `button.haya-theme-card-more` (manage mode only): 22px square at the top-right inside the strip, with 2px inset, on a tinted background so it reads over any swatch. Visible on hover and on `focus-within`. Always visible below 360px viewport width. The check icon is at the bottom-right of the badge row, so it never shares a position with "⋯".
- Surface: the card `div` is the surface, with rest fill `var(--soft)`.
  - Hover: `var(--haya-state-hover)` on the card.
  - Selected: `var(--haya-state-active)` on the card, and `aria-current="true"` on the select button.
  - Focus: `outline: 1px solid var(--haya-state-fg); outline-offset: -1px` on the card under `:focus-within`.
- Shape: `border-radius: var(--haya-control-radius); corner-shape: squircle`, matching `.haya-btn`.
- Card tokens `--haya-card-h: 68px`, `--haya-card-strip-h: 24px`, `--haya-card-gap: 6px` go in the root block that defines `--haya-state-rest` (`haya.css`, the `:root` at about line 203).

## Groups and search
- `div.haya-theme-list`, `role="group" aria-label="Color themes"`. Each mode group is a `section.haya-theme-group` with:
  - A disclosure button `button.haya-theme-group-toggle` with `aria-expanded` and `aria-controls` pointing to its grid. It shows a `chevron-down` icon (rotated when collapsed), the label, and the count ("Dark · 2"). It is a normal tab stop.
  - A grid `div.haya-theme-grid`, `role="group" aria-label="<label> themes"`, rendered only when expanded.
- Collapsed state: `localStorage` key `haya.theme.groups`, read and written with `parseGroupState` and `serializeGroupState`. The value is `{ "dark": boolean, "light": boolean }`, where `true` means collapsed. Reads and writes are wrapped in try/catch.
- Search: rendered when `allThemes().length > 8`. A visible label "Search themes" sits above the field. Filtering uses `filterGroups`. While the query is non-empty, every matching group is shown expanded, and the stored collapse state is not changed. Groups without matches are hidden. With no match at all, the line "No themes match" shows.
- Escape in the search field: if the value is non-empty, clear it and call `stopPropagation()` and `preventDefault()`. If empty, do nothing, so the key reaches Preferences or the popover (both bubble listeners on `window`).
- Arrow Down in the field moves focus to the first visible card.

## Keyboard in the grid
- Roving tabindex across the whole list: exactly one select button has `tabindex="0"`, the active card if visible, otherwise the first visible card. The rest are `-1`. The "⋯" buttons are normal tab stops.
- One `keydown` listener on the list container. When the target is a card select button, it builds `rows` from the DOM (visible card ids per group, in display order, one array per group), and `columns` from `getComputedStyle(targetGrid).gridTemplateColumns.split(" ").length`. Then it calls `nextCardId(rows, columns, currentId, key)` and focuses the returned card. Arrow and Home/End keys call `preventDefault()`.
- Behavior of `nextCardId`:
  - Left and Right: flatten `rows` in display order. Move one back or forward, wrapping at both ends. This crosses group boundaries, which is intended, because it reads as one list.
  - Up and Down: operate only inside the current group. The card keeps its column (`index % columns`) in the row above or below within the same group. If there is none, return the current id. Up and Down do not cross into another group, because each group is a separate grid under its own heading. This is intended.
  - Home and End: first and last of the flattened list.
- Enter and Space activate the focused select button through native `button` behavior.

## UX flow
```
Interface
├─ Color theme
│   [+ New]  (manage mode, right-aligned in the list header)
│   [Search themes]  (only when more than 8 themes)
│   ▾ Dark · 2
│   ┌──────┐ ┌──────┐
│   │strip │ │strip │
│   │Haya  │ │My    │
│   │Dark  │ │Dark  │
│   └──────┘ └──────┘
│   ▾ Light · 1
│   ┌──────┐
│   │strip │
│   │Haya  │
│   │Light │
│   └──────┘
└─ Window (opacity, blur, glass)
```
- Click or Enter selects a card.
- "⋯" opens the menu:
  - Duplicate: every theme.
  - Edit: disabled, reason as a tooltip and as a line in the menu: "Editor comes later."
  - Delete: opens the confirmation dialog.
- Delete dialog: "Delete My Dark? This removes its file." Buttons: Cancel (focused by default) and Delete. Escape cancels.
- "+ New" duplicates the active theme.

## Failure modes
- Folder missing: no toast. Built-ins only. A stored custom id is cleared after the successful load (rule 4 of `resolveStored`).
- Folder unreadable (`themes_load` rejects or returns `Err`): one error toast. Built-ins only. The stored custom id stays selected and its tokens stay applied. `loaded` stays false, so "+ New", Duplicate, and Delete are disabled with the reason.
- Vite page (no Tauri): `invoke` throws a `TypeError`. `errorMessage` turns it into the message, and the same error path runs.
- A file fails validation or cannot be parsed: skipped, one info toast per warning, with the file name.
- `theme_save` returns `exists` during Duplicate: the next suffix is tried (`runDuplicate`). `invalid` or `io` shows an error toast and the list is resynced.
- Save fails with a Tauri argument error (a plain string): mapped to `invalid` by `saveResultFrom`, error toast.
- `theme_delete` fails: error toast, state unchanged.
- Save succeeds but the reload fails: the copy is already in the list and is selected. The error toast says the list could not be refreshed.
- The active custom file is removed or edited outside the app: picked up at the next load (picker or Preferences open, or startup). A removed file clears the stored id and selects the mode default. An edited file's tokens are applied by reconcile.
- A symlink at the save or delete path: refused, with the messages above.
- Case-insensitive file systems: a file named `Foo.toml` never loads as id `foo` (name mismatch warning). On save, `hard_link` fails with `AlreadyExists` only when the exact name exists. On macOS APFS, a save of `foo` when `Foo.toml` exists fails with `Exists` through the same kernel check, because the names collide at the file system level. That is the intended result: the user gets a choice, not a silent overwrite.

## Verification criteria
Rust (`cargo test -p haya-desktop`, with `tempfile`):
- Valid file loads. Bad id, bad color, unknown mode, reserved id, name too long (by scalar count), name with control characters, blank name, mismatched file name, invalid TOML, a missing `tokens` table, and a file over 256 KiB each produce one warning and are skipped.
- A file named `haya-dark.toml` with id `haya-dark`: skipped with the reserved-id warning.
- Unknown top-level key in a valid file: loads, no warning.
- Name with surrounding spaces: stored trimmed. A 40-scalar name with multi-byte characters is accepted; 41 is rejected.
- `valid_id`: empty, 41 characters, leading `-`, uppercase, `../x`, and `a b` are rejected; `a`, `a-b`, and 40 characters of `a` are accepted.
- `theme_dir_from`: absolute `XDG` wins; relative `XDG` is ignored; empty `XDG` is ignored; `HOME` is the fallback; neither returns `Err`.
- Missing folder: empty, no warning. Base path that is a regular file: `Err`. The mode-000 test is dropped, because it is unreliable as root.
- Save then load round-trips.
- `save_dir` with `overwrite = false` returns `Exists` when the file is there, using `hard_link`. With `overwrite = true` it replaces the file.
- Two concurrent `save_dir` calls with `overwrite = false` for the same id (two threads): exactly one returns `Ok`, the other `Exists`, and the file content is from the winner.
- Atomic write failure: make `<id>.toml` a directory, then `save_dir` with `overwrite = true`. The rename fails, the call returns `Io`, and no temp file remains in `base`.
- Symlink at `<id>.toml`: save returns `Invalid` and the link target is untouched. Delete returns `Err` and the link still exists.
- Poisoned lock: poison the mutex in a test thread; `save_dir` returns `Io` and `delete_dir` returns `Err`. No panic.
- Symlink entry during load: one symlink warning. Directory entry: skipped silently. Non-`.toml` file: ignored silently.
- `delete_dir` with an invalid id is rejected before any path is built. Deleting a missing id returns `Ok`.
- Reserved-id parity: a Rust test asserts `RESERVED` equals `["haya-dark", "haya-light"]`. `themes.test.ts` asserts `RESERVED_THEME_IDS` equals the same literal list.

TypeScript (`bun test`, `src/haya/theme/themes.test.ts` and `src/haya/theme/queue.test.ts`):
- `groupThemes`: order; custom after built-in within its mode; sort by name with `localeCompare`; empty groups omitted.
- `defaultOf` never returns a custom theme. `findTheme(list, id)` returns undefined for an unknown id and never falls back.
- `copyId`: unique against `taken`, truncation to 32, suffix `-copy-2`. `copyName`: at most 40 code points.
- `toFileDto`: `custom` is dropped, `swatches` is a 4-element array.
- `normalizeTheme`: missing keys filled from the built-in with no warning; an unknown key returns `theme: null` with a warning naming the key.
- `parseStored`: `null`, empty, a bare valid id (`mode: null`), `123` and `true` read as bare ids, malformed JSON, wrong shape, and new JSON each return the documented result.
- `resolveStored`: one case per numbered rule (null raw; found id; not found and not loaded; not found and loaded; bare id takes its mode from the theme).
- `parseGroupState` and `serializeGroupState`: round-trip; malformed value returns all false.
- `filterGroups`: case-insensitive name match; groups with no match dropped; empty query unchanged.
- `nextCardId`: Left and Right wrap across groups; Up and Down keep the column inside the group; Up on the top row returns the current id; Home and End go to the ends; an id not in `rows` returns null.
- `tokenRemovals`: a key set by the previous theme and absent from the next one is returned; keys set by the next theme are not.
- `saveResultFrom`: a `SaveErrorDto` object, a plain string, and a `TypeError` each map to the documented kind.
- `runDuplicate`: `exists` twice then `ok` returns the third suffix; always `exists` returns exhausted after the attempts; `io` stops at once.
- `createQueue` (`queue.test.ts`): a rejected task does not stop the next task; tasks run in order; a task that starts while another is pending waits for it.
- Migration: an old bare-id `haya.theme` value resolves through `parseStored` and is rewritten as JSON after reconcile.

Native window checks (`bun run tauri dev`; IPC needed):
- First run, no folder: no toast, built-ins listed.
- Duplicate a built-in theme: the file appears in `~/.config/haya/themes/` and the copy is selected. Restart: still there, still selected, and the cached tokens show at first paint.
- Delete with confirmation: Cancel keeps the file. Delete removes it and selects the mode default. Escape in the dialog closes only the dialog. Escape with the dialog closed and the search field empty closes Preferences.
- Menu: Tab to "⋯", Enter opens it, Escape closes only the menu. A click outside closes only the menu. A click on the Preferences scrim while the menu is open does not close Preferences.
- Bar and EditLayer context menus behave as before.
- Edit a theme file on disk, then open Preferences: the new tokens apply without restart.
- A custom light theme: switch to it, open a terminal; the terminal palette follows.
- A symlinked theme file: shows the symlink info toast.
- A file with three swatches: skipped with a clear warning (a Rust validation error, not an argument error).
- Two quick Duplicate clicks produce two files.
- Escape in the search field clears a non-empty field and does not close Preferences.
- Preferences at the minimum window size (800×560) and at the default size (1280×800), and maximized: no horizontal overflow, nav width unchanged, dialog not clipped.

Vite page checks (`bun run dev` at `http://localhost:1420`; no Tauri IPC):
- The error path shows: one error toast, "+ New" and Duplicate disabled with the reason, built-ins still listed.
- Layout: the grid reflows at 232px and at Preferences width without horizontal scroll. The card, strip, name, and badge match the measurements above. On a selected card, "⋯" and the check icon do not overlap.
- Arrow keys move between built-in cards; Up and Down stay within a group; Home and End work.
- Preferences restyle (below) at the same three sizes.

Gates:
- `cd apps/haya-desktop && bun run check`: 0 errors and at most 3 warnings. Measured at the start of revision 8: 0 errors, 3 warnings (`src/haya/components/Tab.svelte`, `src/haya/Grid.svelte`, `src/haya/wm/Tiles.svelte`). The working tree has unrelated modified files; this gate counts svelte-check output only.
- `bun test`: passes.
- `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets`, `cargo test --workspace`: pass.

## Preferences restyle
Applies to the whole Preferences dialog, in the same pass as the theme list. All of its sections are restyled, including Workspaces and Toolbar (`Preferences.svelte` lines around 185 and 223–225) and the Shortcuts group headings (around line 280), because they share the same classes.
- Dialog `.haya-prefs` (`haya.css` around line 304): radius 20px with `corner-shape: squircle`. Add `backdrop-filter: blur(12px) saturate(160%)` and `-webkit-backdrop-filter` with the same value, which is the glass value already used at `haya.css:406–407`. The scrim gets no backdrop filter.
- Section nav: each item is a squircle button (`border-radius: var(--haya-control-radius); corner-shape: squircle`). The active item uses `--haya-state-active` and `--haya-state-fg-active`, the same as `.haya-btn.is-on`.
- Close button: a new class `.haya-prefs-close`, 28px square with `border-radius: 50%`, a 14px icon, `--haya-state-rest` background, `--haya-state-hover` on hover. It is not `.haya-btn-icon`, which is `--haya-btn-h` (22px).
- Section cards: each section's markup is wrapped in `div.haya-prefs-card` with `background: var(--soft)`, `border-radius: 16px; corner-shape: squircle`, `box-shadow: 0 8px 24px #0003`, and `padding: 12px`. Gap 12px between cards. No 1px separators.
- Section headings: each `h3` heading gets the new class `.haya-prefs-section-title`, 13px, weight 700. Today's `h3.haya-prefs-sub` (11px, muted) is replaced at those sites, and `.haya-prefs-sub` stays only for field labels, 11px and `--quiet`.
- Sliders: keep the track and white thumb. Only spacing and the value label change.
- Verification: at the three sizes listed above, the dialog has no horizontal overflow, the nav width is unchanged, and the active nav item and active theme card use the same state tokens (`--haya-state-active`, `--haya-state-fg-active`).

## Docs maintenance
- `docs/design-system.md`: add the card tokens (`--haya-card-h`, `--haya-card-strip-h`, `--haya-card-gap`), the `.haya-theme-*` classes, `.haya-prefs-card`, `.haya-prefs-section-title`, and `.haya-prefs-close`.
- `docs/TODO.md`:
  - Line 29, "Terminal palette follows the theme tokens": check off with the Terminal change.
  - Line 60, "Restyle the Preferences dialog": change "Revision 5" to "revision 8", and check off when the restyle lands.

## CSS inventory (`src/haya/haya.css`)
- Removed:
  - `.haya-theme-group-label` (line 294)
  - `.haya-theme-divider` (line 295)
  - `.haya-theme-row`, `.haya-theme-row:hover`, `.haya-theme-row.is-on` (lines 296–298)
  - `.haya-theme-name` (line 299)
  - `.haya-theme-default` (line 300)
  - `.haya-swatch` and `.haya-swatch-dot` (lines 290–292), and the comment on line 289 that describes the old picker rows.
- Kept and restyled: `.haya-theme-list` (line 322), now the list container described above.
- Kept: `.haya-theme-picker` (line 293), width 232px.
- Added: `.haya-theme-group`, `.haya-theme-group-toggle`, `.haya-theme-grid`, `.haya-theme-card`, `.haya-theme-card.is-on`, `.haya-theme-card-body`, `.haya-theme-card-name`, `.haya-theme-card-badge`, `.haya-theme-card-more`, `.haya-theme-search`, `.haya-theme-empty`, `.haya-swatch-strip`, `.haya-prefs-card`, `.haya-prefs-section-title`, `.haya-prefs-close`.

## Icons
Add to `src/haya/components/Icon.svelte`: `more` (`M5 12h.01M12 12h.01M19 12h.01`) and `check` (`M5 12l5 5L20 7`). The dot segments of `more` are invisible without round line caps. The `<svg>` in `Icon.svelte` gets `stroke-linecap="round" stroke-linejoin="round"` if it does not already set them. The implementer checks the visual result of existing icons after this change. `plus` and `chevron-down` already exist.

## Revision 9: amendments (these override the matching rules above)
The points below win over earlier text. Nothing else changed.

### Load triggers
- Startup: `src/routes/+page.svelte` onMount calls `initTheme()`, then `await loadCustomThemes()`. This is the startup load. It does not depend on the picker or Preferences.
- `ThemeList.svelte` onMount also calls `loadCustomThemes()`. The list mounts when the picker opens and when Preferences shows the Interface section. Each mount reloads. Loads are queued, so repeated calls are safe.
- Preferences renders `ThemeList` only inside `{#if prefs.section === "interface"}`, so switching sections unmounts it. An in-flight load keeps running in the queue and writes only to `themeState`, so an unmount cannot leave stale state. Nothing is cancelled.
- `initTheme` with a missing token cache and a stored custom id: it applies `defaultOf(THEMES, mode)` tokens for display only, without changing `themeState.id`. The startup load then reconciles.

### Reconcile skips unchanged tokens
- `reconcile` calls `applyTheme` only when the resolved id differs from the applied id, or the resolved theme's tokens differ from `lastApplied` (compared as JSON). An unchanged reload does not bump `themeState.version`, so terminals are not re-rendered on every open.
- `lastApplied` starts as `{}`.

### Preferences layout and the menu
- `ThemeMenu` is portaled: on mount it moves its root element to `document.body`. It uses `position: fixed` in viewport coordinates from `trigger.getBoundingClientRect()`. Teardown removes the element.
- Reason: `.haya-prefs` gets `backdrop-filter`, which makes it the containing block for fixed descendants, and `.haya-prefs` and `.haya-prefs-body` have `overflow` set. Without the portal, the menu would be positioned against and clipped by the dialog.
- Selecting an item closes the menu first (`onclose`), then runs `onselect`. Delete opens the dialog only after the menu is gone, so the next Escape reaches the dialog.
- `ThemePicker.svelte` (`svelte:window onkeydown` calling `closePicker()` on Escape) and `ThemeToggle.svelte` (owns `pickerOpen`) are unchanged. Escape in the picker's search field clears a non-empty field and stops propagation, as specified above, so the picker stays open.

### Card actions on built-in themes
- Built-in cards (`custom: false`) show no Delete item in the "⋯" menu. Duplicate and Edit remain. The Delete rule in `deleteTheme` also rejects a built-in id before calling Rust.
- "+ New" duplicates `currentTheme() ?? defaultOf(allThemes(), themeState.mode)`, so it always has a source when loaded.

### Badge and icon values
- Check circle: background `var(--haya-state-fg-active)`, check stroke `var(--soft)`.
- "⋯" tinted background: `color-mix(in srgb, var(--popup) 80%, transparent)`.
- Card badge text ("default"): color `var(--haya-state-fg)`.
- Icon stroke caps: `Icon.svelte` gets `stroke-linecap="round" stroke-linejoin="round"` on its `<svg>`. Verification renders every key of its icon map in the native window and checks each one visually.

### Names, sizes, and parsing
- `copyName(name)`: the result is at most 40 code points. The base is truncated to at most 35 code points, then " copy" (5 code points) is appended.
- `validId(id: string): boolean` in `themes.ts` is the TypeScript twin of Rust `valid_id`. The same literal cases run in both `themes.rs` tests and `themes.test.ts`: `""`, 41 `a`s, `-a`, `A`, `../x`, `a b` are invalid; `a`, `a-b`, 40 `a`s are valid.
- Preferences section cards: one `div.haya-prefs-card` per nav section. All headings and fields of that section go inside it. This is one card per `section`, not per `h3`.
- Sliders: the value label gets `font-variant-numeric: tabular-nums` and `margin-top: 4px`. Track, thumb, and gaps stay as they are.
- Keyboard grid: each select button carries `data-theme-id="<id>"`. `rows` is built from `querySelectorAll("[data-theme-id]")` inside the visible groups.

### Failure modes added
- `hard_link` unsupported (exFAT, some FUSE and network mounts; the error kind is not `AlreadyExists`): `save_dir` falls back to a check-then-rename under the store lock. The store lock serializes this app's writes, so the race only exists against an outside writer. A fallback that is also unsupported returns `Io`.
- A crash between temp create and rename leaves `.{id}.{pid}.{nanos}.tmp` files. They are dotfiles, load ignores them, and nothing removes them. This is intended.
- Dialog and the reconcile are independent: a failed reload never changes the applied tokens.

### Testability of the store
- `theme.svelte.ts` reads its I/O through a `deps` object: `invoke`, `storage` (`getItem` and `setItem`), and `applyDom`. Production wires the real ones. `export function __setThemeDepsForTests(overrides)` replaces entries. Tests use it.
- `src/haya/theme/theme.test.ts` (new) covers, with a mocked `invoke`: reloadLocked success and failure; reconcile with a missing file (clears the id), an edited file (applies the new tokens), and an unchanged reload (no `applyTheme`); duplicate with two `exists` then `ok`; deleteTheme on a built-in is refused; deleteTheme on a custom id reselects the mode default.
- Native check added: restart with a stored custom id and the picker never opened. After startup, tokens are the file's tokens, the card is selected, and "+ New" is enabled.

## Decisions (resolved)
- Storage: TOML in `~/.config/haya/themes/`.
- Built-in list keeps the name `THEMES`. `findTheme` takes the list and never falls back.
- Edit: disabled, with reason.
- Custom mark: none. The "default" badge stays.
- Delete: confirmation required, with the theme name. Delete refuses symlinks.
- Save: `hard_link` for no-clobber, `rename` for overwrite. Symlinks at the path are refused, not replaced.
- ContextMenu: not reused. `ThemeMenu.svelte` is new, with capture-phase listeners.
- Startup: cached tokens applied by an inline script in `app.html`, before `%sveltekit.head%`.
- Load: an unreadable folder is an error; a missing folder is empty; a bad file is a warning. A failed load keeps the stored custom id and disables mutations.
- Base folder: `theme_dir()` from `XDG_CONFIG_HOME` (terminal launch only) or `HOME`. No Tauri path API.
- Id check: hand-written `valid_id`. No regex crate. Size cap 256 KiB per file.
- Commands are synchronous, like the existing ones.
- Queue: one serialized promise chain that continues after failures. No timeout.
- Reload triggers: `ThemeList` mount (startup, Preferences open, picker open) and after each mutation.
- Search: while searching, matching groups are shown expanded without changing the stored collapse state.
- Up and Down stay inside a group; Left and Right cross groups.
- Restyle covers every Preferences section, in this pass.
