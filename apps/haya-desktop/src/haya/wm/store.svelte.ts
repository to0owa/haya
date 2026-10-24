// Runtime store for the workspace shell. The pure model lives in model.ts; this file holds the
// reactive state and the operations the UI calls. Window instances stay mounted in every workspace
// so terminals and database sessions keep running while another workspace is shown.

import {
  activeWorkspace, changeMasterCount, closeWindow, createDefaultConfig, cycleLayout, focusStep, focusWindow,
  moveToWorkspace, openWindow, promoteToMaster, setActiveWorkspace, setLayout, adjustRatio,
  type Config, type LayoutName, type WindowKind,
} from "./model";

export interface Instance {
  title: string;
  schema?: string;
  table?: string;
}

export interface DetailsRow {
  columns: string[];
  row: (string | null)[];
}

export const wm = $state({
  config: createDefaultConfig() as Config,
  instances: {} as Record<number, Instance>,
  details: null as DetailsRow | null,
});

let terminalCount = 0;

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

function defaultTitle(kind: WindowKind): string {
  switch (kind) {
    case "terminal": terminalCount += 1; return `Terminal ${terminalCount}`;
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

export function masters(delta: number) {
  wm.config = changeMasterCount(wm.config, delta);
}

export function closeFocused() {
  const focused = activeWorkspace(wm.config).focus;
  if (focused !== null) close(focused);
}

export function showDetails(columns: string[], row: (string | null)[]) {
  wm.details = { columns, row };
  open("details");
}

/** Keyboard map in the spirit of dwm. Returns true when the key was handled. */
export function handleKey(event: KeyboardEvent): boolean {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return false;
  const digit = /^[0-9]$/.test(event.key) ? Number(event.key) : null;
  const workspaceId = digit === null ? null : digit === 0 ? 10 : digit;

  if (workspaceId !== null) {
    event.preventDefault();
    if (event.shiftKey) sendFocusedTo(workspaceId);
    else switchWorkspace(workspaceId);
    return true;
  }
  const actions: Record<string, () => void> = {
    t: () => open("terminal"),
    w: closeFocused,
    j: () => step(1),
    k: () => step(-1),
    Enter: promote,
    "\\": nextLayout,
    "]": () => ratio(0.05),
    "[": () => ratio(-0.05),
    "=": () => masters(1),
    "-": () => masters(-1),
  };
  const key = event.key === "]" && event.shiftKey ? "]" : event.key;
  const action = actions[key];
  if (!action) return false;
  event.preventDefault();
  action();
  return true;
}

// First launch: start with the windows the default ide layout places (connections left, terminal bottom).
if (Object.keys(wm.config.windows).length === 0) {
  open("connections");
  open("terminal");
}
