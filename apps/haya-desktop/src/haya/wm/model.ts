// Pure workspace model: no runes, no DOM, so it can be tested with `bun test`.

export type WindowKind =
  | "terminal" | "connections" | "table" | "query" | "details"
  | "editor" | "explorer" | "changes" | "chats";

export const WINDOW_KINDS: WindowKind[] = [
  "terminal", "connections", "table", "query", "details",
  "editor", "explorer", "changes", "chats",
];

export type LayoutName = "tile" | "bstack" | "monocle" | "grid" | "ide";
export const LAYOUT_NAMES: LayoutName[] = ["tile", "bstack", "monocle", "grid", "ide"];

export type Region = "left" | "center" | "bottom";

/**
 * Which way a full grid is cut first. "rows" cuts into rows, then each row into cells, so the line between rows spans the
 * whole grid and each row has its own line between columns. "cols" is the same turned over. Dragging a spanning line
 * turns the grid over, so the part you hold moves alone.
 */
export type GridFlow = "rows" | "cols";

export interface Workspace {
  id: number;
  name: string;
  windows: number[];
  focus: number | null;
  layout: LayoutName;
  masterCount: number;
  masterRatio: number;
  /** Ratios the user dragged, keyed by split path in the layout tree. Missing keys use each split's default. */
  ratios: Record<string, number>;
  /** How the grid layout is cut first. A grid whose last row has at least 2 windows can be "cols". */
  gridFlow: GridFlow;
  /**
   * By columns, in a grid whose last row is short (3, 3, 2 windows): the column lines that the last row's lines were matched
   * to, by index from the first. They cut the grid into regions, and each region has its own lines between rows.
   * Empty when the grid is full, or not cut by columns.
   */
  gridCuts: number[];
  /**
   * By columns: the row lines that cut the grid across its whole width, by index from the first. They cut it into bands.
   * Each band has its own column lines, so a column line only runs through the rows of its band. A cut is made at a row line
   * that is lined up across the columns, as near as possible to the window the user grabbed.
   */
  gridBands: number[];
  /** File name inside the wallpapers folder, or null for no wallpaper. */
  wallpaper: string | null;
}

export interface Config {
  version: 1;
  workspaces: Workspace[];
  active: number;
  rules: Record<WindowKind, Region>;
  nextWindowId: number;
  windows: Record<number, WindowKind>;
  /** Per-widget settings, keyed by widget id then setting key. Edited in Preferences → Toolbar. */
  widgetSettings: Record<string, Record<string, string>>;
  /** Widgets the user has hidden from the toolbars. Chosen from the toolbar's right-click menu. */
  hiddenWidgets: string[];
  /** Widget ids per toolbar, in order. A missing bar uses the default placement. */
  barLayout: Record<string, string[]>;
  /** Glass look for each surface: tile windows, the outer frame, and Preferences. */
  glass: Record<GlassSurface, GlassLook>;
  /** Blur in px (0 to 40) for an expanded wallpaper. */
  wallpaperBlur: number;
  /** Key overrides by action id. An empty string turns that action's key off. */
  keymap: Record<string, string>;
  /** Put the active workspace's wallpaper behind the whole window, not only behind the stage. */
  wallpaperWholeApp: boolean;
}

export const WORKSPACE_COUNT = 10;

/** Where a window kind belongs: a workspace tile, or a side panel. */
export type WindowTag = "workspace" | "sidebar";

export const WINDOW_TAGS: Record<WindowKind, WindowTag> = {
  terminal: "workspace",
  editor: "workspace",
  query: "workspace",
  table: "workspace",
  chats: "workspace",
  explorer: "sidebar",
  changes: "sidebar",
  connections: "sidebar",
  details: "sidebar",
};

export const DEFAULT_RULES: Record<WindowKind, Region> = {
  connections: "left",
  explorer: "left",
  table: "center",
  query: "center",
  editor: "center",
  changes: "left",
  chats: "left",
  terminal: "bottom",
  details: "left",
};

export function createDefaultConfig(): Config {
  const workspaces: Workspace[] = Array.from({ length: WORKSPACE_COUNT }, (_, i) => ({
    id: i + 1,
    name: String(i + 1),
    windows: [],
    focus: null,
    layout: "ide",
    masterCount: 1,
    ratios: {},
    gridFlow: "rows",
    gridCuts: [],
    gridBands: [],
    masterRatio: DEFAULT_MASTER_RATIO,
    wallpaper: null,
  }));
  return {
    version: 1,
    workspaces,
    active: 1,
    rules: { ...DEFAULT_RULES },
    nextWindowId: 1,
    windows: {},
    widgetSettings: {},
    // The status line stays out of the bottom bar by default. Right-click the toolbar to show it again.
    hiddenWidgets: ["status"],
    barLayout: {},
    wallpaperWholeApp: false,
    keymap: {},
    wallpaperBlur: 12,
    glass: flatGlass(),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Repairs a saved or hand-edited config. Unknown windows and bad fields are dropped or defaulted. */
export function normalize(raw: unknown): Config {
  const base = createDefaultConfig();
  if (!isObject(raw) || raw.version !== 1 || !Array.isArray(raw.workspaces)) return base;

  const windows: Record<number, WindowKind> = {};
  if (isObject(raw.windows)) {
    for (const [key, kind] of Object.entries(raw.windows)) {
      const id = Number(key);
      if (Number.isInteger(id) && id > 0 && WINDOW_KINDS.includes(kind as WindowKind)) {
        windows[id] = kind as WindowKind;
      }
    }
  }

  const savedList: unknown[] = Array.isArray(raw.workspaces) ? raw.workspaces : [];
  const workspaces = base.workspaces.map((fallback) => {
    const saved = savedList.find((w: unknown) => isObject(w) && w.id === fallback.id);
    if (!isObject(saved)) return fallback;
    const ids = Array.isArray(saved.windows)
      ? saved.windows.filter((id): id is number => typeof id === "number" && id in windows)
      : [];
    const layout = LAYOUT_NAMES.includes(saved.layout as LayoutName) ? (saved.layout as LayoutName) : fallback.layout;
    const masterCount = Number.isInteger(saved.masterCount) && (saved.masterCount as number) >= 1 ? (saved.masterCount as number) : 1;
    const ratio = typeof saved.masterRatio === "number" ? saved.masterRatio : fallback.masterRatio;
    return {
      id: fallback.id,
      name: typeof saved.name === "string" && saved.name.trim() ? saved.name.trim().slice(0, 24) : fallback.name,
      windows: ids,
      focus: ids.includes(saved.focus as number) ? (saved.focus as number) : ids[0] ?? null,
      layout,
      masterCount,
      masterRatio: Math.min(0.9, Math.max(0.1, ratio)),
      ratios: parseRatios(saved.ratios),
      gridFlow: (saved.gridFlow === "cols" ? "cols" : "rows") as GridFlow,
      gridCuts: Array.isArray(saved.gridCuts) ? saved.gridCuts.filter((k): k is number => Number.isInteger(k) && k >= 1 && k <= 63) : [],
      gridBands: Array.isArray(saved.gridBands) ? saved.gridBands.filter((k): k is number => Number.isInteger(k) && k >= 1 && k <= 63) : [],
      wallpaper: isSafeWallpaperName(saved.wallpaper) ? saved.wallpaper : null,
    };
  });

  const rules = { ...base.rules };
  if (isObject(raw.rules)) {
    for (const kind of WINDOW_KINDS) {
      const region = raw.rules[kind];
      if (region === "left" || region === "center" || region === "bottom") rules[kind] = region;
    }
  }

  const maxId = Math.max(0, ...Object.keys(windows).map(Number));
  const active = Number.isInteger(raw.active) && (raw.active as number) >= 1 && (raw.active as number) <= WORKSPACE_COUNT
    ? (raw.active as number)
    : 1;
  const nextWindowId = Math.max(maxId + 1, Number.isInteger(raw.nextWindowId) ? (raw.nextWindowId as number) : 1);

  const widgetSettings: Record<string, Record<string, string>> = {};
  if (isObject(raw.widgetSettings)) {
    for (const [widget, values] of Object.entries(raw.widgetSettings)) {
      if (!isObject(values)) continue;
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (typeof value === "string") clean[key] = value;
      }
      widgetSettings[widget] = clean;
    }
  }

  const hiddenWidgets = Array.isArray(raw.hiddenWidgets)
    ? raw.hiddenWidgets.filter((id): id is string => typeof id === "string")
    : [];

  const barLayout: Record<string, string[]> = {};
  if (isObject(raw.barLayout)) {
    for (const [part, ids] of Object.entries(raw.barLayout)) {
      if (Array.isArray(ids)) barLayout[part] = ids.filter((id): id is string => typeof id === "string");
    }
  }

  // Glass is saved per surface. Older configs kept one window look at the top level, which moves to the window surface.
  const g = isObject(raw.glass) ? raw.glass : {};
  const isLegacy = !GLASS_SURFACES.some((s) => s in g);
  // The old default look (0.85 / 0.34 / 180) was saved before the flat default existed.
  // Those untouched values move to flat; any other saved values are kept as the user set them.
  const oldGlassDefault = g.highlight === 0.85 && g.sheen === 0.34 && g.saturation === 180;
  const glass: Record<GlassSurface, GlassLook> = isLegacy
    ? { window: normalizeLook({ opacity: raw.windowOpacity, blur: raw.windowBlur, ...(oldGlassDefault ? {} : g) }), prefs: normalizeLook(undefined) }
    : { window: normalizeLook(g.window), prefs: normalizeLook(g.prefs) };

  const wallpaperWholeApp = raw.wallpaperWholeApp === true;
  const keymap: Record<string, string> = {};
  if (isObject(raw.keymap)) {
    for (const [id, key] of Object.entries(raw.keymap)) if (typeof key === "string") keymap[id] = key;
  }
  const wallpaperBlur = typeof raw.wallpaperBlur === "number" && Number.isFinite(raw.wallpaperBlur) ? Math.min(40, Math.max(0, raw.wallpaperBlur)) : 12;

  return { version: 1, workspaces, active, rules, nextWindowId, windows, widgetSettings, hiddenWidgets, barLayout, glass, wallpaperBlur, wallpaperWholeApp, keymap };
}

export function workspace(config: Config, id: number): Workspace {
  return config.workspaces.find((w) => w.id === id) ?? config.workspaces[0];
}

export function activeWorkspace(config: Config): Workspace {
  return workspace(config, config.active);
}

function withWorkspace(config: Config, id: number, update: (w: Workspace) => Workspace): Config {
  return { ...config, workspaces: config.workspaces.map((w) => (w.id === id ? update(w) : w)) };
}

/** Creates a window instance on the active workspace and focuses it. */
export function openWindow(config: Config, kind: WindowKind, workspaceId = config.active): { config: Config; id: number } {
  const id = config.nextWindowId;
  const next: Config = {
    ...config,
    nextWindowId: id + 1,
    windows: { ...config.windows, [id]: kind },
  };
  return {
    config: withWorkspace(next, workspaceId, (w) => ({ ...w, windows: [...w.windows, id], focus: id })),
    id,
  };
}

/** Removes a window instance from every workspace. */
export function closeWindow(config: Config, id: number): Config {
  const windows = { ...config.windows };
  delete windows[id];
  return {
    ...config,
    windows,
    workspaces: config.workspaces.map((w) => {
      if (!w.windows.includes(id)) return w;
      const remaining = w.windows.filter((x) => x !== id);
      const index = w.windows.indexOf(id);
      const focus = w.focus === id ? remaining[Math.max(0, index - 1)] ?? remaining[0] ?? null : w.focus;
      return { ...w, windows: remaining, focus };
    }),
  };
}

export function setActiveWorkspace(config: Config, id: number): Config {
  if (id < 1 || id > WORKSPACE_COUNT) return config;
  return { ...config, active: id };
}

export function focusWindow(config: Config, id: number, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => (w.windows.includes(id) ? { ...w, focus: id } : w));
}

/** Moves focus to the next or previous window in the workspace order (wraps). */
export function focusStep(config: Config, step: 1 | -1, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => {
    if (w.windows.length === 0) return w;
    const index = w.focus === null ? -1 : w.windows.indexOf(w.focus);
    const next = (index + step + w.windows.length) % w.windows.length;
    return { ...w, focus: w.windows[next] };
  });
}

/** dwm "zoom": the focused window becomes the first (master) window. */
export function promoteToMaster(config: Config, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => {
    if (w.focus === null) return w;
    const rest = w.windows.filter((id) => id !== w.focus);
    return { ...w, windows: [w.focus, ...rest] };
  });
}

/** Moves the focused window to another workspace and keeps it focused there. */
export function moveToWorkspace(config: Config, targetId: number, workspaceId = config.active): Config {
  const source = workspace(config, workspaceId);
  if (targetId === workspaceId || source.focus === null) return config;
  const id = source.focus;
  const remaining = source.windows.filter((x) => x !== id);
  const moved = withWorkspace(config, workspaceId, (w) => ({ ...w, windows: remaining, focus: remaining[0] ?? null }));
  return withWorkspace(moved, targetId, (w) => ({ ...w, windows: [...w.windows, id], focus: id }));
}

/** Reads saved ratios. Keys must be split paths (0s and 1s); values are clamped. */
function parseRatios(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [path, value] of Object.entries(raw)) {
    if (/^[01]*$/.test(path) && typeof value === "number" && Number.isFinite(value)) out[path] = limitRatio(value);
  }
  return out;
}

export function setLayout(config: Config, layout: LayoutName, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => ({ ...w, layout, ratios: {}, gridFlow: "rows", gridCuts: [], gridBands: [] }));
}

export function cycleLayout(config: Config, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => {
    const index = LAYOUT_NAMES.indexOf(w.layout);
    return { ...w, layout: LAYOUT_NAMES[(index + 1) % LAYOUT_NAMES.length], ratios: {}, gridFlow: "rows", gridCuts: [], gridBands: [] };
  });
}

export const DEFAULT_MASTER_RATIO = 0.55;
export const MIN_MASTER_RATIO = 0.1;
export const MAX_MASTER_RATIO = 0.9;

/** How close a stored split may sit to the edge of its area, as a share. This only keeps ratios sane: a drag also holds each window to a minimum size in pixels. */
export const RATIO_FLOOR = 0.01;

/** Keeps a split ratio inside the allowed range, at full precision. Stored ratios use this, so lines never snap to steps. */
export function limitRatio(value: number): number {
  return Math.min(1 - RATIO_FLOOR, Math.max(RATIO_FLOOR, value));
}

/**
 * The smallest a window may be made by dragging a divider, as a share of the area's width and height. When more windows
 * sit side by side than that leaves room for (seven columns at 15%), the minimum shrinks just enough for them all to fit.
 */
export const MIN_TILE_SHARE = 0.15;

/** Clamps a split ratio to the allowed range, rounded to two decimals. */
export function clampRatio(value: number): number {
  return Math.min(MAX_MASTER_RATIO, Math.max(MIN_MASTER_RATIO, Math.round(value * 100) / 100));
}

/** Sets or clears (null) the dragged ratio of one split. Used by divider drags. */
export function withRatio(config: Config, path: string, value: number | null, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => {
    const ratios = { ...w.ratios };
    if (value === null) delete ratios[path];
    else ratios[path] = limitRatio(value);
    return { ...w, ratios };
  });
}

/** Replaces the dragged ratios of a workspace in one step. Used when moving one divider has to retarget those below it. */
export function withRatios(config: Config, ratios: Record<string, number>, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => ({ ...w, ratios }));
}

/** Turns a grid over to the other flow. The ratios replace the old ones, since a path means something else in the other flow. */
export function withGridFlow(
  config: Config,
  flow: GridFlow,
  ratios: Record<string, number>,
  cuts: number[] = [],
  bands: number[] = [],
  workspaceId = config.active,
): Config {
  return withWorkspace(config, workspaceId, (w) => ({ ...w, gridFlow: flow, ratios, gridCuts: cuts, gridBands: bands }));
}

/** Keyboard resize of the main split. Moves the root split, and drops any dragged root ratio so it follows. */
export function adjustRatio(config: Config, delta: number, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => {
    const { [""]: _root, ...ratios } = w.ratios;
    const base = w.ratios[""] ?? w.masterRatio;
    return { ...w, ratios, masterRatio: clampRatio(base + delta) };
  });
}

export function changeMasterCount(config: Config, delta: number, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => ({
    ...w,
    masterCount: Math.max(1, Math.min(w.windows.length || 1, w.masterCount + delta)),
  }));
}

export const MIN_OPACITY = 0.3;
export const MAX_BLUR = 40;

/** Each surface that can be glass. Every one has its own look in Preferences. */
export const GLASS_SURFACES = ["window", "prefs"] as const;
export type GlassSurface = (typeof GLASS_SURFACES)[number];

/** One surface's look. Opacity MIN_OPACITY to 1, blur 0 to MAX_BLUR px, highlight and sheen 0 to 1, saturation 100 to 200 percent. */
export interface GlassLook {
  opacity: number;
  blur: number;
  highlight: number;
  sheen: number;
  saturation: number;
}

/** A fresh flat look for every surface: solid, no blur, no glass. */
export function flatGlass(): Record<GlassSurface, GlassLook> {
  const flat = (): GlassLook => ({ opacity: 1, blur: 0, highlight: 0, sheen: 0, saturation: 100 });
  return { window: flat(), prefs: flat() };
}

/** Reads one surface's look from saved data. Missing or bad values fall back to the flat look. */
function normalizeLook(raw: unknown): GlassLook {
  const g = isObject(raw) ? raw : {};
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return {
    opacity: clampOpacity(num(g.opacity, 1)),
    blur: Math.min(MAX_BLUR, Math.max(0, num(g.blur, 0))),
    highlight: Math.min(1, Math.max(0, num(g.highlight, 0))),
    sheen: Math.min(1, Math.max(0, num(g.sheen, 0))),
    saturation: Math.min(200, Math.max(100, num(g.saturation, 100))),
  };
}

/** Keeps an opacity inside the allowed range. */
export function clampOpacity(value: number): number {
  return Math.min(1, Math.max(MIN_OPACITY, value));
}

/**
 * A wallpaper name must be a plain file name: no path parts, no leading dot, and an image extension.
 * This keeps a hand-edited config from pointing outside the wallpapers folder.
 */
export function isSafeWallpaperName(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8,64}\.(png|jpe?g|webp|gif)$/i.test(value);
}
