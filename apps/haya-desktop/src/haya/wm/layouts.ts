// Layout algorithms: pure functions from (workspace, window kinds, area) to tiles.

import { type LayoutName, type Region, type Workspace, type WindowKind } from "./model";

export interface Rect { x: number; y: number; w: number; h: number }

/** A tile holds one or more windows shown as tabs; `active` is the visible one. */
export interface Tile { rect: Rect; windows: number[]; active: number | null }

export interface LayoutInput {
  workspace: Workspace;
  kinds: Record<number, WindowKind>;
  rules: Record<WindowKind, Region>;
  area: Rect;
}

const EMPTY: Tile[] = [];

function single(rect: Rect, windows: number[], focus: number | null): Tile {
  return { rect, windows, active: focus !== null && windows.includes(focus) ? focus : windows[0] ?? null };
}

/** dwm `tile`: masters on the left, the rest stacked on the right. */
function tile(input: LayoutInput): Tile[] {
  const { workspace: ws, area } = input;
  const ids = ws.windows;
  if (ids.length === 0) return EMPTY;
  if (ids.length === 1) return [single(area, ids, ws.focus)];
  const masters = ids.slice(0, Math.min(ws.masterCount, ids.length));
  const stack = ids.slice(masters.length);
  if (stack.length === 0) return [single(area, masters, ws.focus)];
  const masterW = area.w * ws.masterRatio;
  return [
    single({ ...area, w: masterW }, masters, ws.focus),
    single({ x: area.x + masterW, y: area.y, w: area.w - masterW, h: area.h }, stack, ws.focus),
  ];
}

/** dwm `bstack`: masters on top, the rest in a row below. */
function bstack(input: LayoutInput): Tile[] {
  const { workspace: ws, area } = input;
  const ids = ws.windows;
  if (ids.length === 0) return EMPTY;
  if (ids.length === 1) return [single(area, ids, ws.focus)];
  const masters = ids.slice(0, Math.min(ws.masterCount, ids.length));
  const stack = ids.slice(masters.length);
  if (stack.length === 0) return [single(area, masters, ws.focus)];
  const masterH = area.h * ws.masterRatio;
  return [
    single({ ...area, h: masterH }, masters, ws.focus),
    single({ x: area.x, y: area.y + masterH, w: area.w, h: area.h - masterH }, stack, ws.focus),
  ];
}

/** dwm `monocle`: every window is a tab in one tile. */
function monocle(input: LayoutInput): Tile[] {
  const { workspace: ws, area } = input;
  if (ws.windows.length === 0) return EMPTY;
  return [single(area, ws.windows, ws.focus)];
}

/** Even grid: as many columns as the square root of the window count. */
function grid(input: LayoutInput): Tile[] {
  const { workspace: ws, area } = input;
  const ids = ws.windows;
  if (ids.length === 0) return EMPTY;
  const cols = Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / cols);
  const cellW = area.w / cols;
  const cellH = area.h / rows;
  return ids.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return single({ x: area.x + col * cellW, y: area.y + row * cellH, w: cellW, h: cellH }, [id], id);
  });
}

/** IDE: regions decided by window kind. left | center | bottom, with the center on the right. */
function ide(input: LayoutInput): Tile[] {
  const { workspace: ws, area, kinds, rules } = input;
  if (ws.windows.length === 0) return EMPTY;

  const groups: Record<Region, number[]> = { left: [], center: [], bottom: [] };
  for (const id of ws.windows) {
    const kind = kinds[id];
    const region = kind ? rules[kind] : "center";
    groups[region].push(id);
  }

  const hasBottom = groups.bottom.length > 0;
  const hasLeft = groups.left.length > 0;
  const mainH = hasBottom ? area.h * ws.masterRatio : area.h;
  const leftW = hasLeft ? area.w * 0.25 : 0;
  const tiles: Tile[] = [];

  if (hasLeft) tiles.push(single({ x: area.x, y: area.y, w: leftW, h: mainH }, groups.left, ws.focus));
  if (groups.center.length) {
    tiles.push(single({ x: area.x + leftW, y: area.y, w: area.w - leftW, h: mainH }, groups.center, ws.focus));
  }
  if (hasBottom) {
    tiles.push(single({ x: area.x, y: area.y + mainH, w: area.w, h: area.h - mainH }, groups.bottom, ws.focus));
  }
  return tiles;
}

const LAYOUTS: Record<LayoutName, (input: LayoutInput) => Tile[]> = {
  tile,
  bstack,
  monocle,
  grid,
  ide,
};

export function computeTiles(input: LayoutInput): Tile[] {
  return LAYOUTS[input.workspace.layout](input);
}
