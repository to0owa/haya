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
import RowAddButton from "./widgets/RowAddButton.svelte";
import SpacerWidget from "./widgets/SpacerWidget.svelte";
import { ADD_ITEMS } from "./add-items";
import { pluginWidgets } from "../../plugins/host";
import type { Component } from "svelte";

export type BarPosition = "top" | "bottom" | "left" | "right";

// Core widgets. Plugin widgets are merged in below.
const CORE_WIDGETS = {
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
  rowAdd: RowAddButton,
  spacer: SpacerWidget,
} as const;

export function isWidget(id: string): id is WidgetId {
  return id in WIDGETS;
}

export type WidgetId = string;



/** Names shown in the toolbar's right-click menu. */
const CORE_LABELS: Record<string, string> = {
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
  rowAdd: "Add row",
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
  /** Several values can be on at once. Stored as comma-separated text. */
  multi?: boolean;
}

/** Settings each widget exposes in Preferences → Toolbar. Widgets not listed here have no settings. */
export const WIDGET_SETTINGS: Partial<Record<WidgetId, { title: string; settings: SettingDef[] }>> = {
  actions: {
    title: "Window actions",
    settings: [
      {
        key: "items",
        label: "Add",
        fallback: "terminal",
        multi: true,
        options: ADD_ITEMS.map((item) => ({ value: item.kind, label: item.label })),
      },
    ],
  },
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
      {
        key: "numbering",
        label: "Numbering",
        fallback: "arabic",
        options: [
          { value: "arabic", label: "1 2 3" },
          { value: "kanji", label: "一 二 三" },
          { value: "aksara", label: "꧑ ꧒ ꧓" },
          { value: "custom", label: "Custom names" },
        ],
      },
    ],
  },
};

/** Default placement. Side strips hold views (explorer, details); the top bar holds the panel collapse toggles. */
export const DEFAULT_BARS: Record<BarPosition, WidgetId[]> = {
  top: ["logo", "tabs", "actions", "layout"],
  bottom: ["config", "theme", "status", "waveform", "workspaces"],
  left: ["explorer", "connections"],
  right: ["rowAdd", "details"],
};

// Plugin widgets join the core ones. An id that is already taken is an error, not a silent override.
function merge<T>(core: Record<string, T>, pick: (w: (typeof pluginWidgets)[number]) => T): Record<string, T> {
  const out: Record<string, T> = { ...core };
  for (const widget of pluginWidgets) {
    if (widget.id in core) throw new Error(`Plugin widget "${widget.id}" clashes with a core widget`);
    out[widget.id] = pick(widget);
  }
  return out;
}

export const WIDGETS: Record<string, Component<any>> = merge<Component<any>>(CORE_WIDGETS, (w) => w.component);
export const WIDGET_LABELS: Record<string, string> = merge(CORE_LABELS, (w) => w.label);
