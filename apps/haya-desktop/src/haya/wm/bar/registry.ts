// Bar widgets and where each bar shows them. Adding a widget is one entry here.
import WorkspaceSwitch from "./widgets/WorkspaceSwitch.svelte";
import WindowActions from "./widgets/WindowActions.svelte";
import LayoutButton from "./widgets/LayoutButton.svelte";
import StatusInfo from "./widgets/StatusInfo.svelte";
import ThemeToggle from "../../theme/ThemeToggle.svelte";
import ConfigButton from "./widgets/ConfigButton.svelte";
import WindowTabs from "./widgets/WindowTabs.svelte";
import ShortcutsButton from "./widgets/ShortcutsButton.svelte";

export type BarPosition = "top" | "bottom";

export const WIDGETS = {
  workspaces: WorkspaceSwitch,
  tabs: WindowTabs,
  actions: WindowActions,
  layout: LayoutButton,
  status: StatusInfo,
  config: ConfigButton,
  theme: ThemeToggle,
  shortcuts: ShortcutsButton,
} as const;

export type WidgetId = keyof typeof WIDGETS;

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingDef {
  key: string;
  /** Heading shown in the context menu. */
  label: string;
  fallback: string;
  options: SettingOption[];
}

/** Settings each widget exposes in its right-click menu. Widgets not listed here have no menu. */
export const WIDGET_SETTINGS: Partial<Record<WidgetId, { title: string; settings: SettingDef[] }>> = {
  workspaces: {
    title: "Workspaces",
    settings: [
      {
        key: "mode",
        label: "Show",
        fallback: "all",
        options: [
          { value: "all", label: "All ten" },
          { value: "active", label: "Active only" },
          { value: "label", label: "Label, list on hover" },
        ],
      },
    ],
  },
};

/** Default placement: the top bar carries tabs and window actions; the bottom bar carries settings, status, and workspaces. */
export const DEFAULT_BARS: Record<BarPosition, WidgetId[]> = {
  top: ["tabs", "actions", "layout"],
  bottom: ["config", "theme", "shortcuts", "status", "workspaces"],
};
