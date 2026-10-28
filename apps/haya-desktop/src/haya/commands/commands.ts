// Every command the palette lists. Shortcuts are shown for reference; handleKey does the actual binding.
import { closeFocused, masters, nextLayout, open, promote, ratio, step, switchWorkspace, toggleConnections, toggleExplorer, toggleRight } from "../wm/store.svelte";
import { openPreferences } from "../preferences/prefs-state.svelte";
import { toggleEdit } from "../toolbar/edit.svelte";
import { zoomFocused } from "../wm/store.svelte";
import { shortcutOf } from "../wm/keymap.svelte";

export interface Command {
  label: string;
  shortcut?: string;
  run: () => void;
}

const WORKSPACE_COMMANDS: Command[] = Array.from({ length: 10 }, (_, i) => {
  const id = i + 1;
  return { label: `Switch to Workspace ${id === 10 ? 0 : id}`, shortcut: shortcutOf(`workspace.switch.${id}`), run: () => switchWorkspace(id) };
});

export const COMMANDS: Command[] = [
  { label: "New Terminal", shortcut: shortcutOf("terminal.new"), run: () => open("terminal") },
  { label: "Close Window", shortcut: shortcutOf("window.close"), run: closeFocused },
  { label: "Next Window", shortcut: shortcutOf("window.next"), run: () => step(1) },
  { label: "Previous Window", shortcut: shortcutOf("window.previous"), run: () => step(-1) },
  { label: "Promote to Master", shortcut: shortcutOf("window.promote"), run: promote },
  { label: "Change Layout", shortcut: shortcutOf("layout.next"), run: nextLayout },
  { label: "Grow Master Area", shortcut: shortcutOf("master.grow"), run: () => ratio(0.05) },
  { label: "Shrink Master Area", shortcut: shortcutOf("master.shrink"), run: () => ratio(-0.05) },
  { label: "Add Master Window", shortcut: shortcutOf("master.add"), run: () => masters(1) },
  { label: "Remove Master Window", shortcut: shortcutOf("master.remove"), run: () => masters(-1) },
  { label: "Toggle Explorer", shortcut: shortcutOf("explorer.toggle"), run: toggleExplorer },
  { label: "Toggle Connections", shortcut: shortcutOf("connections.toggle"), run: toggleConnections },
  { label: "Toggle Details", shortcut: shortcutOf("details.toggle"), run: toggleRight },
  ...WORKSPACE_COMMANDS,
  { label: "Edit Toolbar", shortcut: shortcutOf("toolbar.edit"), run: toggleEdit },
  { label: "Zoom In", shortcut: shortcutOf("zoom.in"), run: () => zoomFocused(1) },
  { label: "Zoom Out", shortcut: shortcutOf("zoom.out"), run: () => zoomFocused(-1) },
  { label: "Reset Zoom", run: () => zoomFocused(0) },
  { label: "Preferences: Color Theme", run: () => openPreferences("interface") },
  { label: "Preferences: Toolbar", run: () => openPreferences("toolbar") },
  { label: "Preferences: Keyboard Shortcuts", run: () => openPreferences("shortcuts") },
  // Reloading the webview does not stop the shells. See the PTY note before using this.
  { label: "Reload Window", run: () => window.location.reload() },
];
