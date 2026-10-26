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

export interface Workspace {
  id: number;
  name: string;
  windows: number[];
  focus: number | null;
  layout: LayoutName;
  masterCount: number;
  masterRatio: number;
}

export interface Config {
  version: 1;
  workspaces: Workspace[];
  active: number;
  rules: Record<WindowKind, Region>;
  nextWindowId: number;
  windows: Record<number, WindowKind>;
  /** Per-widget settings chosen from the widget's context menu, keyed by widget id then setting key. */
  widgetSettings: Record<string, Record<string, string>>;
}

export const WORKSPACE_COUNT = 10;

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
    masterRatio: 0.55,
  }));
  return {
    version: 1,
    workspaces,
    active: 1,
    rules: { ...DEFAULT_RULES },
    nextWindowId: 1,
    windows: {},
    widgetSettings: {},
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

  const workspaces = base.workspaces.map((fallback) => {
    const saved = raw.workspaces.find((w: unknown) => isObject(w) && w.id === fallback.id);
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

  return { version: 1, workspaces, active, rules, nextWindowId, windows, widgetSettings };
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

export function setLayout(config: Config, layout: LayoutName, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => ({ ...w, layout }));
}

export function cycleLayout(config: Config, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => {
    const index = LAYOUT_NAMES.indexOf(w.layout);
    return { ...w, layout: LAYOUT_NAMES[(index + 1) % LAYOUT_NAMES.length] };
  });
}

export function adjustRatio(config: Config, delta: number, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => ({
    ...w,
    masterRatio: Math.min(0.9, Math.max(0.1, Math.round((w.masterRatio + delta) * 100) / 100)),
  }));
}

export function changeMasterCount(config: Config, delta: number, workspaceId = config.active): Config {
  return withWorkspace(config, workspaceId, (w) => ({
    ...w,
    masterCount: Math.max(1, Math.min(w.windows.length || 1, w.masterCount + delta)),
  }));
}
