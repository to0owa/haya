// Every keyboard action in one place. Each action has a default key and can be remapped in
// Preferences > Keyboard shortcuts. Stored overrides live in config.keymap; "" means no key.
//
// Key strings name physical keys by event.code, so layouts and Shift do not change them:
//   "Mod+KeyB" is Command-B on macOS. "Mod" is ⌘ (metaKey), "Ctrl" is ⌃, "Alt" is ⌥, "Shift" is ⇧.
import { wm, closeFocused, masters, nextLayout, open, promote, ratio, sendFocusedTo, step, switchWorkspace, toggleConnections, toggleExplorer, toggleRight, zoomFocused } from "./store.svelte";
import { togglePalette } from "../commands/palette.svelte";
import { formatKey, keyFromEvent, matches, parseKey } from "./keys";
import { toggleEdit } from "../toolbar/edit.svelte";
import { openPreferences } from "../preferences/prefs-state.svelte";

export interface Action {
  id: string;
  label: string;
  group: string;
  /** Default key. null means the action has no key until one is recorded. */
  key: string | null;
  run: () => void;
}

/** Set while Preferences is recording a new key. handleKey stands aside so the recording is not also an action. */
export const keyRecording = $state({ id: null as string | null });

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const digitCode = (n: number) => `Digit${n === 10 ? 0 : n}`;

export const ACTIONS: Action[] = [
  { id: "terminal.new", label: "New terminal", group: "Windows", key: "Mod+KeyT", run: () => open("terminal") },
  { id: "window.close", label: "Close focused window", group: "Windows", key: "Mod+KeyW", run: closeFocused },
  { id: "connections.toggle", label: "Toggle connections", group: "Windows", key: "Mod+Shift+KeyC", run: toggleConnections },
  { id: "explorer.toggle", label: "Toggle explorer", group: "Windows", key: "Mod+KeyB", run: toggleExplorer },
  { id: "details.toggle", label: "Toggle details", group: "Windows", key: "Mod+Shift+KeyB", run: toggleRight },

  { id: "window.next", label: "Focus next window", group: "Focus and layout", key: "Mod+KeyJ", run: () => step(1) },
  { id: "window.previous", label: "Focus previous window", group: "Focus and layout", key: "Mod+KeyK", run: () => step(-1) },
  { id: "window.promote", label: "Promote to master", group: "Focus and layout", key: "Mod+Enter", run: promote },
  { id: "layout.next", label: "Change layout", group: "Focus and layout", key: "Mod+Backslash", run: nextLayout },
  { id: "master.grow", label: "Grow master area", group: "Focus and layout", key: "Mod+BracketRight", run: () => ratio(0.05) },
  { id: "master.shrink", label: "Shrink master area", group: "Focus and layout", key: "Mod+BracketLeft", run: () => ratio(-0.05) },
  { id: "master.add", label: "Add master window", group: "Focus and layout", key: "Mod+Shift+Equal", run: () => masters(1) },
  { id: "master.remove", label: "Remove master window", group: "Focus and layout", key: "Mod+Shift+Minus", run: () => masters(-1) },

  { id: "zoom.in", label: "Zoom in (focused window)", group: "Zoom", key: "Mod+Equal", run: () => zoomFocused(1) },
  { id: "zoom.out", label: "Zoom out (focused window)", group: "Zoom", key: "Mod+Minus", run: () => zoomFocused(-1) },

  ...DIGITS.map((n): Action => ({
    id: `workspace.switch.${n}`, label: `Switch to workspace ${n === 10 ? 0 : n}`, group: "Workspaces",
    key: `Mod+${digitCode(n)}`, run: () => switchWorkspace(n),
  })),
  ...DIGITS.map((n): Action => ({
    id: `workspace.move.${n}`, label: `Move focused window to workspace ${n === 10 ? 0 : n}`, group: "Workspaces",
    key: `Mod+Shift+${digitCode(n)}`, run: () => sendFocusedTo(n),
  })),

  { id: "palette.toggle", label: "Command palette", group: "Toolbar and app", key: "Mod+Shift+KeyP", run: togglePalette },
  { id: "toolbar.edit", label: "Edit toolbar", group: "Toolbar and app", key: "Mod+Shift+Comma", run: toggleEdit },
  { id: "preferences.open", label: "Preferences", group: "Toolbar and app", key: "Mod+Comma", run: () => openPreferences() },
];

export const GROUPS = [...new Set(ACTIONS.map((a) => a.group))];

export { formatKey, keyFromEvent, matches, parseKey } from "./keys";

/** The key an action uses now: its override if one is saved, otherwise its default. */
export function effectiveKey(action: Action): string | null {
  const saved = wm.config.keymap[action.id];
  if (saved !== undefined) return saved || null;
  return action.key;
}

export function isOverridden(action: Action): boolean {
  return wm.config.keymap[action.id] !== undefined;
}

/** Another action that already uses this action's key, or null. */
export function conflictOf(action: Action): Action | null {
  const key = effectiveKey(action);
  if (!key) return null;
  return ACTIONS.find((other) => other !== action && effectiveKey(other) === key) ?? null;
}

/** Saves a key for an action. "" turns the action's key off. */
export function setKey(id: string, key: string) {
  wm.config = { ...wm.config, keymap: { ...wm.config.keymap, [id]: key } };
}

/** Drops the saved override, so the action goes back to its default key. */
export function resetKey(id: string) {
  const { [id]: _removed, ...rest } = wm.config.keymap;
  wm.config = { ...wm.config, keymap: rest };
}

/** Shortcut text for the command palette, or undefined when the action has no key. */
export function shortcutOf(id: string): string | undefined {
  const action = ACTIONS.find((a) => a.id === id);
  const key = action ? effectiveKey(action) : null;
  return key ? formatKey(key) : undefined;
}

/** Runs the action bound to this keydown. Returns true when one was handled. */
export function handleKey(event: KeyboardEvent): boolean {
  if (keyRecording.id) return false;
  const action = ACTIONS.find((a) => {
    const key = effectiveKey(a);
    return key !== null && matches(key, event);
  });
  if (!action) return false;
  event.preventDefault();
  action.run();
  return true;
}
