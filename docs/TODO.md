# TODO

## Toolbar
- [x] Activity-bar behaviour on the side strips: clicking the active view collapses the panel, clicking another view switches to it. Done with Explorer and Connections.
- [ ] Icon library, so toolbar icons can be customised the way VS Code's activity bar can. Keep it out until the current widget set settles.
- [ ] Hide the whole side strip, not only its widgets.
- [ ] Top toolbar clips on the right when many tabs are open. The layout toggles can fall outside the window. Find out why the tab strip does not shrink.
- [ ] Verify the toolbar right-click menu on screen, and the Preferences → Toolbar options.
- [ ] Squircle corners on toolbar buttons and inputs. Check on hover, in both themes, and in this webview.
- [ ] Window frame: thinner workspace outline, and corner radius for the stage and the windows. Decide the radius for the window corners first.
- [ ] Terminal ring in the Light theme: the terminal background is hardcoded dark, so a light 1px ring shows around it.

## Logo
- [ ] Pick a compact mark and a full mark from `docs/logo/`. Check them at 16 px and in both themes, then replace `components/HayaLogo.svelte`.
- [ ] Logo style setting in Preferences → Toolbar. It exists now as a placeholder "H" mark.

## Explorer
- [ ] File tree for the project. Needs a Rust command that lists a folder. Right now the Explorer view is a placeholder.

## Connections and drivers
- [ ] Driver upload. Needs backend support for loading a driver. `haya-db` only supports PostgreSQL and CrateDB today.
- [ ] Add MySQL and SQLite drivers, after upload works.
- [ ] Connection form: SSL mode, Over SSH, and a Test button. Only the basic fields exist today.
- [ ] Driver list: a grid option with real logos, if the list grows.

## Terminal
- [ ] Fix PTY leak: `pty_close` must kill the shell child (see the 471 zsh children note). Restart Haya until this lands. The leak also blocks new terminals once macOS reaches its 511 PTY limit.
- [ ] Reload Window command: safe only after the PTY leak is fixed. Each reload currently starts new shells without closing the old ones.
- [ ] Terminal palette follows the theme tokens instead of the hardcoded `#1E2020`.
- [ ] Verify the WebGL pool with 10+ terminals. Measure with `footprint` and typing latency.
- [ ] Measure xterm.js WebGL against Alacritty, using the same workload on both.

## Shell
- [ ] Stable code-signing identity for dev builds, so the Keychain "Always Allow" choice sticks.

## Projects (design in docs/projects.md)
- [ ] Rust storage: read and write `projects/<id>/project.json` and `windows.json`.
- [ ] Default project made from the current layout, on first launch.
- [ ] Project switcher in the bottom-left corner, with search and groups.
- [ ] Idle timer (15 min, 1 h, 4 h, never), toast with Look, Keep, Kill.
- [ ] Resource usage per terminal in the toast, then busy detection and Kill confirmation.
- [ ] Browser window, its per-project data store, and its size cap.
- Data layer is done: `wm/projects.ts` with parsing, id safety, and idle logic, and tests.

## Toolbar and window follow-ups
- [ ] Verify the glass style and the "Keluarkan dari workspace" checkbox on screen.
- [ ] Top bar overflow: tab strip and logo priority, verified on a narrow window.
- [ ] Row edit and add in the details panel: confirm the flow on a real PostgreSQL table.
- [ ] Zoom: verify the PTY size changes with ⌘+ and ⌘-.
- [ ] Table and terminal zoom values persist across restarts.

## Next session: update system
- [ ] In-app update badge at the bottom right ("Update Available: <version>"), with a popover: version, size, release date, Skip, Later, Install and Relaunch, View Release Notes. Reference: screenshot in the chat on 2026-10-28.
- [ ] Phase 1: UI and state machine (none, available, skipped, later, downloading, ready), fed by a stub source behind a dev flag.
- [ ] Phase 2: real check with `tauri-plugin-updater`. Needs a GitHub remote for the repo, a release pipeline that publishes signed artifacts and `latest.json`, and an updater key pair (private key kept as a CI secret, never in the repo).
- [ ] macOS signing and notarization (Developer ID). Without it Gatekeeper may block an updated app. Ties to the code-signing item above.
- [ ] Decide whether "Skip" is per version and "Later" resets on the next launch.

## Preferences style (with the theme pass)
- [ ] Restyle the Preferences dialog to the squircle language: rounded dialog with frosted background, squircle nav items with the shared active state, round close button, tinted section cards, bolder headings. See docs/eg-designs/theme-ui.md "Revision 5".
