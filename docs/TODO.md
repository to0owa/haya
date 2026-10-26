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
