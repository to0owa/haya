// Bar widgets and where each bar shows them. Adding a widget is one entry here.
import WorkspaceSwitch from "./widgets/WorkspaceSwitch.svelte";
import WindowActions from "./widgets/WindowActions.svelte";
import LayoutButton from "./widgets/LayoutButton.svelte";
import StatusInfo from "./widgets/StatusInfo.svelte";
import ThemeToggle from "../../theme/ThemeToggle.svelte";
import ConfigButton from "./widgets/ConfigButton.svelte";
import ShortcutsButton from "./widgets/ShortcutsButton.svelte";

export type BarPosition = "top" | "bottom";

export const WIDGETS = {
  workspaces: WorkspaceSwitch,
  actions: WindowActions,
  layout: LayoutButton,
  status: StatusInfo,
  config: ConfigButton,
  theme: ThemeToggle,
  shortcuts: ShortcutsButton,
} as const;

export type WidgetId = keyof typeof WIDGETS;

/** Default placement: the titlebar carries the controls, the bottom bar carries status. */
export const DEFAULT_BARS: Record<BarPosition, WidgetId[]> = {
  top: ["workspaces", "actions", "layout"],
  bottom: ["config", "theme", "shortcuts", "status"],
};
