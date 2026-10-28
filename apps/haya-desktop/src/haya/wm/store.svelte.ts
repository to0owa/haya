// Runtime store for the workspace shell. The pure model lives in model.ts; this file holds the
// reactive state and the operations the UI calls. Window instances stay mounted in every workspace
// so terminals and database sessions keep running while another workspace is shown.

import { togglePalette } from "../commands/palette.svelte";
import { toggleEdit } from "../toolbar/edit.svelte";
import { flipGrid as flipGridRatios, localizeGrid, moveSeam } from "./layouts";
import {
  activeWorkspace, changeMasterCount, closeWindow, createDefaultConfig, cycleLayout, focusStep, focusWindow,
  moveToWorkspace, openWindow, promoteToMaster, setActiveWorkspace, setLayout, adjustRatio, withRatio, withRatios, withGridFlow, MIN_TILE_SHARE,
  type Config, type GlassLook, type GlassSurface, type GridFlow, type LayoutName, type WindowKind,
  clampOpacity,
  MAX_BLUR,
} from "./model";

export interface Instance {
  title: string;
  schema?: string;
  table?: string;
  /** Font size of this window's content, set with ⌘+ and ⌘-. Missing means the kind's default. */
  zoom?: number;
}

export const ZOOM_LIMITS: Record<"terminal" | "table", { min: number; max: number; default: number }> = {
  terminal: { min: 8, max: 32, default: 13 },
  table: { min: 10, max: 20, default: 12 },
};

export function zoomOf(id: number, kind: "terminal" | "table"): number {
  return wm.instances[id]?.zoom ?? ZOOM_LIMITS[kind].default;
}

/** Zooms the focused window by one step (+1 or -1 px). Only terminals and tables zoom. */
export function zoomFocused(step: 1 | -1 | 0) {
  const id = activeWorkspace(wm.config).focus;
  if (id === null) return;
  const kind = wm.config.windows[id];
  if (kind !== "terminal" && kind !== "table") return;
  const limits = ZOOM_LIMITS[kind];
  const next = step === 0 ? limits.default : Math.min(limits.max, Math.max(limits.min, zoomOf(id, kind) + step));
  if (wm.instances[id]) wm.instances[id] = { ...wm.instances[id], zoom: next };
}

export interface DetailsRow {
  schema: string;
  table: string;
  columns: string[];
  /** The row as read from the database. Kept unchanged so its primary key still matches the table. */
  row: (string | null)[];
}

/** What the details panel shows: a read-only row, a row being edited, or a new row. */
export type DetailsMode = "view" | "edit" | "add";

export type LeftView = "explorer" | "connections";

export const wm = $state({
  config: createDefaultConfig() as Config,
  instances: {} as Record<number, Instance>,
  details: null as DetailsRow | null,
  detailsMode: "view" as DetailsMode,
  leftView: null as LeftView | null,
  lastLeftView: "explorer" as LeftView,
  rightOpen: false,
});

/** Activity-bar behaviour: the active view's icon collapses the panel, another view's icon switches to it. */
export function selectLeft(view: LeftView) {
  if (wm.leftView === view) {
    wm.leftView = null;
    return;
  }
  wm.leftView = view;
  wm.lastLeftView = view;
}

export function toggleExplorer() {
  selectLeft("explorer");
}

export function toggleConnections() {
  selectLeft("connections");
}

/** Collapses the left panel, or restores the view it last showed. */
export function toggleLeftPanel() {
  wm.leftView = wm.leftView ? null : wm.lastLeftView;
}

export function toggleRight() {
  wm.rightOpen = !wm.rightOpen;
}


/** Opens a window of `kind` on the active workspace. Singleton kinds are focused instead of duplicated. */
export function open(kind: WindowKind, extra: Partial<Instance> = {}): number {
  const singleton = kind === "connections" || kind === "details";
  if (singleton) {
    const existing = Object.keys(wm.config.windows).map(Number).find((id) => wm.config.windows[id] === kind);
    if (existing !== undefined) {
      wm.config = focusWindow(wm.config, existing);
      return existing;
    }
  }
  const title = extra.title ?? defaultTitle(kind);
  const result = openWindow(wm.config, kind);
  wm.config = result.config;
  wm.instances[result.id] = { title, ...extra };
  return result.id;
}

/** The lowest "Terminal N" that no open terminal uses. Closing Terminal 2 means the next one is Terminal 2 again. */
function nextTerminalTitle(): string {
  const used = new Set(
    Object.entries(wm.config.windows)
      .filter(([, kind]) => kind === "terminal")
      .map(([id]) => wm.instances[Number(id)]?.title),
  );
  let n = 1;
  while (used.has(`Terminal ${n}`)) n += 1;
  return `Terminal ${n}`;
}

function defaultTitle(kind: WindowKind): string {
  switch (kind) {
    case "terminal": return nextTerminalTitle();
    case "connections": return "Connections";
    case "details": return "Details";
    default: return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

export function openTable(schema: string, table: string): number {
  const existing = Object.entries(wm.instances).find(
    ([id, inst]) => wm.config.windows[Number(id)] === "table" && inst.schema === schema && inst.table === table,
  );
  if (existing) {
    wm.config = focusWindow(wm.config, Number(existing[0]));
    return Number(existing[0]);
  }
  return open("table", { title: `${schema}.${table}`, schema, table });
}

export function close(id: number) {
  wm.config = closeWindow(wm.config, id);
  delete wm.instances[id];
}

export function focus(id: number) {
  wm.config = focusWindow(wm.config, id);
}

export function switchWorkspace(id: number) {
  wm.config = setActiveWorkspace(wm.config, id);
}

export function sendFocusedTo(id: number) {
  wm.config = moveToWorkspace(wm.config, id);
}

export function step(delta: 1 | -1) {
  wm.config = focusStep(wm.config, delta);
}

export function promote() {
  wm.config = promoteToMaster(wm.config);
}

export function layout(name: LayoutName) {
  wm.config = setLayout(wm.config, name);
}

export function nextLayout() {
  wm.config = cycleLayout(wm.config);
}

export function ratio(delta: number) {
  wm.config = adjustRatio(wm.config, delta);
}

/**
 * Turns the grid over to the other flow, keeping every tile where it is, so a divider that spanned the grid becomes
 * one divider per row or column. `near` is where the divider was grabbed, as a share of the area: a crossing line in parts
 * keeps the part nearest to it. Returns false when the grid cannot turn over.
 */
export function flipGrid(to: GridFlow, near?: { x: number; y: number }): boolean {
  const input = { workspace: activeWorkspace(wm.config), kinds: wm.config.windows, rules: wm.config.rules, area: { x: 0, y: 0, w: 1, h: 1 } };
  // Turning the whole grid over is the cleaner result. When the lines it would join are not lined up, a column line can still
  // be confined to the rows around the grabbed window, so it does not move windows far from it.
  const flip = flipGridRatios(input, to, near) ?? (to === "rows" && near ? localizeGrid(input, near) : null);
  if (!flip) return false;
  wm.config = withGridFlow(wm.config, flip.flow, flip.ratios, flip.cuts, flip.bands);
  return true;
}

/**
 * Drags a divider to a share of its own area. The dividers below it keep their place, so only the window across the divider
 * changes size and the other windows do not move.
 */
export function dragSeam(path: string, share: number, area: { w: number; h: number }) {
  const ratios = moveSeam({ workspace: activeWorkspace(wm.config), kinds: wm.config.windows, rules: wm.config.rules, area: { x: 0, y: 0, ...area } }, path, share, { w: area.w * MIN_TILE_SHARE, h: area.h * MIN_TILE_SHARE });
  wm.config = withRatios(wm.config, ratios);
}

/** Sets the split to an exact value. Used to put a split back to its default. */
export function setRatio(path: string, value: number | null) {
  wm.config = withRatio(wm.config, path, value);
}

export function masters(delta: number) {
  wm.config = changeMasterCount(wm.config, delta);
}

export function closeFocused() {
  const focused = activeWorkspace(wm.config).focus;
  if (focused !== null) close(focused);
}

/** Details live in the right panel, next to the workspace, rather than as a tile. */
/** Stores the row for the details panel. The panel only opens from its toolbar button. */
export function showDetails(schema: string, table: string, columns: string[], row: (string | null)[]) {
  wm.details = { schema, table, columns, row };
  wm.detailsMode = "view";
}

/** Opens the details panel in add mode for the focused table. Needs the table's columns, so a row must have been read first. */
export function startAddRow() {
  if (!wm.details) return false;
  wm.detailsMode = "add";
  wm.rightOpen = true;
  return true;
}


/** Opens the windows the default ide layout places (connections left, terminal bottom) on first launch. */
export function ensureDefaultWindows() {
  if (Object.keys(wm.config.windows).length === 0) {
    open("connections");
    open("terminal");
  }
}

/** Reads one widget setting, or the fallback when the user has not chosen one. */
export function widgetSetting(widget: string, key: string, fallback: string): string {
  return wm.config.widgetSettings[widget]?.[key] ?? fallback;
}

/** Reads a multi-choice widget setting as a list. Stored as comma-separated values. */
export function widgetList(widget: string, key: string, fallback: string): string[] {
  return widgetSetting(widget, key, fallback).split(",").filter(Boolean);
}

export function setWidgetSetting(widget: string, key: string, value: string) {
  wm.config.widgetSettings[widget] = { ...wm.config.widgetSettings[widget], [key]: value };
}

/** Shows or hides a toolbar widget. Hidden widgets stay hidden after a restart, because they are saved in the config. */
export function setWidgetHidden(widget: string, hidden: boolean) {
  const rest = wm.config.hiddenWidgets.filter((id) => id !== widget);
  wm.config.hiddenWidgets = hidden ? [...rest, widget] : rest;
}

/** Sets or clears the wallpaper of one workspace. The file itself is managed by wallpaper.ts. */
export function setWorkspaceWallpaper(id: number, name: string | null) {
  wm.config = {
    ...wm.config,
    workspaces: wm.config.workspaces.map((w) => (w.id === id ? { ...w, wallpaper: name } : w)),
  };
}

/** Sets or clears the wallpaper of every workspace at once. */
export function setAllWorkspaceWallpapers(name: string | null) {
  wm.config = {
    ...wm.config,
    workspaces: wm.config.workspaces.map((w) => ({ ...w, wallpaper: name })),
  };
}

/** Sets the name of one workspace, used as its label in custom numbering. */
export function setWorkspaceName(id: number, name: string) {
  wm.config = {
    ...wm.config,
    workspaces: wm.config.workspaces.map((w) => (w.id === id ? { ...w, name: name.slice(0, 24) } : w)),
  };
}


/** Sets the blur of an expanded wallpaper, 0 to 40 px. */
export function setWallpaperBlur(value: number) {
  wm.config.wallpaperBlur = Math.min(40, Math.max(0, value));
}

/** Puts the wallpaper behind the whole window, or only behind the stage. */
export function setWallpaperWholeApp(value: boolean) {
  wm.config.wallpaperWholeApp = value;
}

/** Sets one value of one glass surface. The value is clamped to that value's range here. */
export function setGlass(surface: GlassSurface, key: keyof GlassLook, value: number) {
  const clamped = key === "opacity" ? clampOpacity(value)
    : key === "blur" ? Math.min(MAX_BLUR, Math.max(0, value))
    : key === "saturation" ? Math.min(200, Math.max(100, value))
    : Math.min(1, Math.max(0, value));
  wm.config.glass = { ...wm.config.glass, [surface]: { ...wm.config.glass[surface], [key]: clamped } };
}

/** Replaces the order of widgets in one toolbar. */
export function setBarLayout(part: string, ids: string[]) {
  wm.config.barLayout = { ...wm.config.barLayout, [part]: ids };
}

/** Drops every custom toolbar layout, back to the default placement. */
export function resetBarLayout() {
  wm.config.barLayout = {};
}

/** Replaces the state with a saved snapshot. Instances without a window are dropped. */
export function hydrate(config: Config, instances: Record<number, Instance>) {
  wm.config = config;
  const kept: Record<number, Instance> = {};
  for (const id of Object.keys(config.windows).map(Number)) {
    kept[id] = instances[id] ?? { title: defaultTitle(config.windows[id]) };
  }
  wm.instances = kept;
}

export function snapshot(): string {
  return JSON.stringify({ config: wm.config, instances: wm.instances });
}
