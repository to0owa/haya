// Windows the Add button can open. Preferences > Toolbar chooses which of these the button lists.
import type { WindowKind } from "../model";

export interface AddItem {
  kind: WindowKind;
  label: string;
  icon: "terminal" | "file" | "database" | "chat" | "git";
}

// Only workspace-tagged windows with a renderer in Tiles.svelte. Editor and Query are not built yet.
export const ADD_ITEMS: AddItem[] = [
  { kind: "terminal", label: "Terminal", icon: "terminal" },
];
