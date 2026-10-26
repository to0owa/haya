// Every command the palette lists. Shortcuts are shown for reference; handleKey does the actual binding.
import { closeFocused, masters, nextLayout, open, promote, ratio, step, switchWorkspace, toggleConnections, toggleExplorer, toggleRight } from "../wm/store.svelte";
import { openPreferences } from "../preferences/prefs-state.svelte";
import { toggleEdit } from "../toolbar/edit.svelte";

export interface Command {
  label: string;
  shortcut?: string;
  run: () => void;
}

const WORKSPACE_COMMANDS: Command[] = Array.from({ length: 10 }, (_, i) => {
  const id = i + 1;
  return { label: `Switch to Workspace ${id === 10 ? 0 : id}`, shortcut: `⌘ ${id === 10 ? 0 : id}`, run: () => switchWorkspace(id) };
});

export const COMMANDS: Command[] = [
  { label: "New Terminal", shortcut: "⌘ T", run: () => open("terminal") },
  { label: "Close Window", shortcut: "⌘ W", run: closeFocused },
  { label: "Next Window", shortcut: "⌘ J", run: () => step(1) },
  { label: "Previous Window", shortcut: "⌘ K", run: () => step(-1) },
  { label: "Promote to Master", shortcut: "⌘ ↩", run: promote },
  { label: "Change Layout", shortcut: "⌘ \\", run: nextLayout },
  { label: "Grow Master Area", shortcut: "⌘ ]", run: () => ratio(0.05) },
  { label: "Shrink Master Area", shortcut: "⌘ [", run: () => ratio(-0.05) },
  { label: "Add Master Window", shortcut: "⌘ =", run: () => masters(1) },
  { label: "Remove Master Window", shortcut: "⌘ -", run: () => masters(-1) },
  { label: "Toggle Explorer", shortcut: "⌘ B", run: toggleExplorer },
  { label: "Toggle Connections", run: toggleConnections },
  { label: "Toggle Details", shortcut: "⇧ ⌘ B", run: toggleRight },
  ...WORKSPACE_COMMANDS,
  { label: "Edit Toolbar", shortcut: "⇧ ⌘ ,", run: toggleEdit },
  { label: "Preferences: Color Theme", run: () => openPreferences("interface") },
  { label: "Preferences: Toolbar", run: () => openPreferences("toolbar") },
  { label: "Preferences: Keyboard Shortcuts", run: () => openPreferences("shortcuts") },
  // Reloading the webview does not stop the shells. See the PTY note before using this.
  { label: "Reload Window", run: () => window.location.reload() },
];
