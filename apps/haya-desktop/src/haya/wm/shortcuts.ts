// Keyboard shortcuts as shown in Preferences. Keep in step with handleKey in store.svelte.ts.

export interface Shortcut {
  keys: string;
  action: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: "⌘ 1 … 0", action: "Switch workspace" },
  { keys: "⌘ ⇧ 1 … 0", action: "Move focused window to workspace" },
  { keys: "⌘ T", action: "New terminal" },
  { keys: "⌘ W", action: "Close focused window" },
  { keys: "⌘ J / ⌘ K", action: "Focus next / previous window" },
  { keys: "⌘ ↩", action: "Promote focused window to master" },
  { keys: "⌘ \\", action: "Change layout" },
  { keys: "⌘ [ / ⌘ ]", action: "Shrink / grow master area" },
  { keys: "⌘ = / ⌘ -", action: "Add / remove master window" },
  { keys: "⌘ B", action: "Toggle explorer" },
  { keys: "⇧ ⌘ B", action: "Toggle details" },
];
