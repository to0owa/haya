// Bar widgets and where each bar shows them. Adding a widget is one entry here.
import WorkspaceSwitch from "./widgets/WorkspaceSwitch.svelte";
import WindowActions from "./widgets/WindowActions.svelte";
import LayoutButton from "./widgets/LayoutButton.svelte";
import StatusInfo from "./widgets/StatusInfo.svelte";
import ThemeToggle from "../../theme/ThemeToggle.svelte";
import ConfigButton from "./widgets/ConfigButton.svelte";
import WindowTabs from "./widgets/WindowTabs.svelte";
import ShortcutsButton from "./widgets/ShortcutsButton.svelte";
import CommandButton from "../../commands/CommandButton.svelte";
import ExplorerToggle from "./widgets/ExplorerToggle.svelte";
import LogoWidget from "./widgets/LogoWidget.svelte";
import ConnectionsToggle from "./widgets/ConnectionsToggle.svelte";
import DetailsToggle from "./widgets/DetailsToggle.svelte";
import LeftLayoutToggle from "./widgets/LeftLayoutToggle.svelte";
import RightLayoutToggle from "./widgets/RightLayoutToggle.svelte";
import SpacerWidget from "./widgets/SpacerWidget.svelte";

export type BarPosition = "top" | "bottom" | "left" | "right";

export const WIDGETS = {
  workspaces: WorkspaceSwitch,
  tabs: WindowTabs,
  actions: WindowActions,
  layout: LayoutButton,
  status: StatusInfo,
  config: ConfigButton,
  theme: ThemeToggle,
  shortcuts: ShortcutsButton,
  commands: CommandButton,
  explorer: ExplorerToggle,
  logo: LogoWidget,
  connections: ConnectionsToggle,
  details: DetailsToggle,
  layoutLeft: LeftLayoutToggle,
  layoutRight: RightLayoutToggle,
  spacer: SpacerWidget,
} as const;

export function isWidget(id: string): id is WidgetId {
  return id in WIDGETS;
}

export type WidgetId = keyof typeof WIDGETS;

/** Names shown in the toolbar's right-click menu. */
export const WIDGET_LABELS: Record<WidgetId, string> = {
  workspaces: "Workspaces",
  tabs: "Window tabs",
  actions: "Window actions",
  layout: "Layout",
  status: "Status",
  config: "Preferences",
  theme: "Color theme",
  shortcuts: "Keyboard shortcuts",
  commands: "Command palette",
  explorer: "Explorer",
  logo: "Logo",
  connections: "Connections",
  details: "Details",
  layoutLeft: "Left panel toggle",
  layoutRight: "Right panel toggle",
  spacer: "Spacer",
};

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

/** Settings each widget exposes in Preferences → Toolbar. Widgets not listed here have no settings. */
export const WIDGET_SETTINGS: Partial<Record<WidgetId, { title: string; settings: SettingDef[] }>> = {
  logo: {
    title: "Logo",
    settings: [
      {
        key: "variant",
        label: "Style",
        fallback: "compact",
        options: [
          { value: "compact", label: "Compact" },
          { value: "full", label: "Full" },
        ],
      },
    ],
  },
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

/** Default placement. Side strips hold views (explorer, details); the top bar holds the panel collapse toggles. */
export const DEFAULT_BARS: Record<BarPosition, WidgetId[]> = {
  top: ["logo", "tabs", "actions", "layout", "layoutLeft", "layoutRight"],
  bottom: ["config", "theme", "shortcuts", "commands", "status", "workspaces"],
  left: ["explorer", "connections"],
  right: ["details"],
};
