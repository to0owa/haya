// Layouts as split trees. A layout only decides how the tree is built. Dividers come from the tree,
// so every layout resizes the same way: drag the divider, and the ratio of that one split is stored.

import { limitRatio, type GridFlow, type LayoutName, type Region, type Workspace, type WindowKind } from "./model";

export interface Rect { x: number; y: number; w: number; h: number }

/** A tile holds one or more windows shown as tabs; `active` is the visible one. */
export interface Tile { rect: Rect; windows: number[]; active: number | null }

export interface LayoutInput {
  workspace: Workspace;
  kinds: Record<number, WindowKind>;
  rules: Record<WindowKind, Region>;
  area: Rect;
}

/**
 * A divider between the two sides of one split. `path` names that split in the tree, so a drag
 * stores its ratio under that name. `origin` and `size` are the split's own area: a drag measures
 * the pointer against them, so the ratio is right for nested splits too.
 */
export interface Seam {
  path: string;
  axis: "x" | "y";
  origin: { x: number; y: number };
  size: { w: number; h: number };
  rect: Rect;
  /** On a grid: which row or column boundary this divider sits on, counted from the first. */
  boundary?: number;
  /** On a grid: the row this divider belongs to, when it is a line between cells of one row. Not set for lines that span rows. */
  row?: number;
  /** Set on a grid divider that spans the whole grid. Dragging it turns the grid over to this flow, so the part held moves alone. */
  flip?: GridFlow;
}

export interface LayoutResult { tiles: Tile[]; seams: Seam[] }

/** Width of the hit area around a divider, in px. Wider than the 2px gap so it is easy to grab. */
export const SEAM_HIT = 8;

type Node =
  | { kind: "leaf"; windows: number[] }
  | { kind: "split"; axis: "x" | "y"; path: string; fallback: number; boundary?: number; row?: number; band?: number; region?: number; a: Node; b: Node };

/** One item of a chain: its weight counts toward the split default, and make builds it at a path. */
interface Item { weight: number; make: (path: string) => Node }

const leaf = (windows: number[]): Node => ({ kind: "leaf", windows });
const sum = (items: Item[]) => items.reduce((total, item) => total + item.weight, 0);

/**
 * Binary chain of items. Each split defaults to its side's share of the weight, so equal items get equal space.
 * `base` is the index of the first item in the whole line, so each split knows which boundary it is. `at` maps an item
 * index to its boundary, for a line whose items do not sit one boundary apart. `row` is set for a line inside one row.
 */
function chain(items: Item[], axis: "x" | "y", path: string, base = 0, row?: number, at?: number[], tag?: { band?: number; region?: number }): Node {
  if (items.length === 1) return items[0].make(path);
  const mid = Math.floor(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);
  const wl = sum(left);
  const wr = sum(right);
  return {
    kind: "split",
    axis,
    path,
    boundary: at ? at[base + mid] : base + mid,
    row,
    band: tag?.band,
    region: tag?.region,
    fallback: wl / (wl + wr),
    a: chain(left, axis, path + "0", base, row, at, tag),
    b: chain(right, axis, path + "1", base + mid, row, at, tag),
  };
}

/** Master and stack. The masters are tabs in one side; the rest are tabs in the other. */
function masterStack(ids: number[], ws: Workspace, axis: "x" | "y"): Node {
  const masters = ids.slice(0, Math.min(ws.masterCount, ids.length));
  const stack = ids.slice(masters.length);
  if (stack.length === 0) return leaf(masters);
  return { kind: "split", axis, path: "", fallback: ws.masterRatio, a: leaf(masters), b: leaf(stack) };
}

/**
 * Size of the grid for a window count: as many columns as the square root, the rows that takes, and how many windows the
 * last row holds. It can turn over (be cut by columns) when there are at least 2 rows and the last row has at least 2 windows.
 */
export function gridDims(count: number): { cols: number; rows: number; last: number; full: boolean; flippable: boolean } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const last = count - (rows - 1) * cols;
  return { cols, rows, last, full: last === cols, flippable: cols > 1 && rows > 1 && last >= 2 };
}

/** The flow a workspace's grid really uses. A grid that cannot turn over is always cut by rows. */
export function gridFlowOf(ws: Workspace): GridFlow {
  return ws.gridFlow === "cols" && gridDims(ws.windows.length).flippable ? "cols" : "rows";
}

/** Column lines that an even short last row would sit on: each of its lines goes to the nearest column line, left first on a tie. */
function evenCuts(cols: number, last: number): number[] {
  const cuts: number[] = [];
  for (let j = 1; j < last; j++) {
    const nearestLine = Math.min(cols - 1, Math.max(1, Math.round((j * cols) / last - 1e-9)));
    cuts.push(Math.max(nearestLine, (cuts[j - 2] ?? 0) + 1));
  }
  return cuts;
}

/** The column lines that cut a grid into regions when it is cut by columns: the stored ones if they fit, else the even ones. */
export function gridCutsOf(ws: Workspace): number[] {
  const { cols, last } = gridDims(ws.windows.length);
  const saved = ws.gridCuts;
  const fits = saved.length === last - 1 && saved.every((k, i) => k >= 1 && k <= cols - 1 && (i === 0 || k > saved[i - 1]));
  return fits ? saved : evenCuts(cols, last);
}

/** The row lines that cut a grid into bands when it is cut by columns: the stored ones if they make sense, else none. */
export function gridBandsOf(ws: Workspace): number[] {
  const { rows } = gridDims(ws.windows.length);
  const saved = ws.gridBands;
  return saved.every((k, i) => k >= 1 && k <= rows - 1 && (i === 0 || k > saved[i - 1])) ? saved : [];
}

/**
 * Even grid, cell (r, c) holding window r * cols + c.
 * By rows: each row is a line of cells, and the rows stack, so the line between rows spans the grid.
 * By columns: the `bands` cut the grid across its width into bands of rows, and in each band the `cuts` split it into regions
 * side by side. Each region stacks its rows, so its lines between rows are its own. A region holds the cells of its columns,
 * and the last row's one cell for that region. A full grid has a cut at every column line, so each region is one column.
 * With no bands the grid is one band, so a column line runs through every row. With bands it runs only through its band.
 */
function gridTree(ids: number[], flow: GridFlow, cuts: number[], bands: number[]): Node {
  const { cols, rows } = gridDims(ids.length);
  if (flow === "cols") {
    const colEdges = [0, ...cuts, cols];
    const rowEdges = [0, ...bands, rows];
    const bandItems: Item[] = [];
    for (let b = 0; b < rowEdges.length - 1; b++) {
      const r0 = rowEdges[b];
      const r1 = rowEdges[b + 1];
      const regions: Item[] = [];
      for (let g = 0; g < colEdges.length - 1; g++) {
        const from = colEdges[g];
        const to = colEdges[g + 1];
        const lines: Item[] = [];
        for (let r = r0; r < r1; r++) {
          const cellIds = r === rows - 1 ? [ids[r * cols + g]] : Array.from({ length: to - from }, (_, i) => ids[r * cols + from + i]);
          const cells: Item[] = cellIds.map((id) => ({ weight: 1, make: () => leaf([id]) }));
          lines.push({ weight: 1, make: (path) => chain(cells, "x", path, from, r) });
        }
        regions.push({ weight: to - from, make: (path) => chain(lines, "y", path, r0, undefined, undefined, { band: b, region: g }) });
      }
      bandItems.push({ weight: r1 - r0, make: (path) => chain(regions, "x", path, 0, undefined, colEdges, { band: b }) });
    }
    return chain(bandItems, "y", "", 0, undefined, rowEdges);
  }
  const lines: Item[] = [];
  for (let i = 0, r = 0; i < ids.length; i += cols, r++) {
    const cells: Item[] = ids.slice(i, i + cols).map((id) => ({ weight: 1, make: () => leaf([id]) }));
    lines.push({ weight: 1, make: (path) => chain(cells, "x", path, 0, r) });
  }
  return chain(lines, "y", "");
}

/** IDE: connections and similar on the left, the centre on the right, and a bottom row. */
function ideTree(ids: number[], input: LayoutInput): Node {
  const { workspace: ws, kinds, rules } = input;
  const groups: Record<Region, number[]> = { left: [], center: [], bottom: [] };
  for (const id of ids) groups[kinds[id] ? rules[kinds[id]] : "center"].push(id);

  const hasBottom = groups.bottom.length > 0;
  const topPath = hasBottom ? "0" : "";
  let top: Node | null = null;
  if (groups.left.length && groups.center.length) {
    top = { kind: "split", axis: "x", path: topPath, fallback: 0.25, a: leaf(groups.left), b: leaf(groups.center) };
  } else if (groups.left.length) {
    top = leaf(groups.left);
  } else if (groups.center.length) {
    top = leaf(groups.center);
  }

  if (!hasBottom) return top ?? leaf(ids);
  if (!top) return leaf(groups.bottom);
  return { kind: "split", axis: "y", path: "", fallback: ws.masterRatio, a: top, b: leaf(groups.bottom) };
}

function buildTree(input: LayoutInput): Node | null {
  const ids = input.workspace.windows;
  if (ids.length === 0) return null;
  switch (input.workspace.layout) {
    case "tile": return masterStack(ids, input.workspace, "x");
    case "bstack": return masterStack(ids, input.workspace, "y");
    case "monocle": return leaf(ids);
    case "grid": return gridTree(ids, gridFlowOf(input.workspace), gridCutsOf(input.workspace), gridBandsOf(input.workspace));
    case "ide": return ideTree(ids, input);
  }
  return leaf(ids);
}

/** The ratio a split uses: the dragged value if there is one, otherwise its default. */
function ratioOf(node: { path: string; fallback: number }, ws: Workspace): number {
  return limitRatio(ws.ratios[node.path] ?? node.fallback);
}

function activeIn(windows: number[], focus: number | null): number | null {
  return focus !== null && windows.includes(focus) ? focus : windows[0] ?? null;
}

function seamAt(node: { path: string; axis: "x" | "y"; boundary?: number; row?: number }, rect: Rect, at: number): Seam {
  const half = SEAM_HIT / 2;
  const hit = node.axis === "x"
    ? { x: at - half, y: rect.y, w: SEAM_HIT, h: rect.h }
    : { x: rect.x, y: at - half, w: rect.w, h: SEAM_HIT };
  return { path: node.path, axis: node.axis, origin: { x: rect.x, y: rect.y }, size: { w: rect.w, h: rect.h }, rect: hit, boundary: node.boundary, row: node.row };
}

function place(node: Node, rect: Rect, ws: Workspace, out: LayoutResult) {
  if (node.kind === "leaf") {
    out.tiles.push({ rect, windows: node.windows, active: activeIn(node.windows, ws.focus) });
    return;
  }
  const r = ratioOf(node, ws);
  if (node.axis === "x") {
    const aw = rect.w * r;
    out.seams.push(seamAt(node, rect, rect.x + aw));
    place(node.a, { x: rect.x, y: rect.y, w: aw, h: rect.h }, ws, out);
    place(node.b, { x: rect.x + aw, y: rect.y, w: rect.w - aw, h: rect.h }, ws, out);
  } else {
    const ah = rect.h * r;
    out.seams.push(seamAt(node, rect, rect.y + ah));
    place(node.a, { x: rect.x, y: rect.y, w: rect.w, h: ah }, ws, out);
    place(node.b, { x: rect.x, y: rect.y + ah, w: rect.w, h: rect.h - ah }, ws, out);
  }
}

/** Tiles and dividers for the current layout. Tiles come out in window order, left to right, top to bottom. */
export function computeLayout(input: LayoutInput): LayoutResult {
  const out: LayoutResult = { tiles: [], seams: [] };
  const tree = buildTree(input);
  if (tree) place(tree, input.area, input.workspace, out);
  markSpanning(out.seams, input.workspace);
  return out;
}

/**
 * In a grid that can turn over, the dividers that run the whole length of the grid are marked: dragging one turns the grid
 * over, so each of its parts becomes a divider of its own. By rows those are the lines between rows. By columns they are
 * the lines between regions; the lines between rows inside a region belong to that region and need no turn.
 */
function markSpanning(seams: Seam[], ws: Workspace) {
  if (ws.layout !== "grid" || !gridDims(ws.windows.length).flippable) return;
  const flow = gridFlowOf(ws);
  for (const seam of seams) {
    const spans = flow === "rows" ? seam.axis === "y" : seam.axis === "x" && seam.row === undefined;
    if (spans) seam.flip = flow === "rows" ? "cols" : "rows";
  }
}

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

/**
 * How far apart, as a share of the grid, the parts of a line may be and still count as lined up. A grid only turns over
 * when every line it has to join is lined up, so joining them moves no window by more than this. Lines further apart stay
 * as they are, and the line being dragged moves whole.
 */
export const FLIP_ALIGN = 0.02;

/**
 * The same, for cutting a grid into bands. A cut only joins row lines across the columns, and it keeps the part next to the
 * window the user grabbed. The windows that shift are in other columns, so a wider tolerance buys more than it costs.
 */
export const LOCALIZE_ALIGN = 0.05;

/**
 * The value whose anchor is nearest `target`, or the mean when there is no target. Used when parts of a line are joined into
 * one: the part beside the window the user grabbed keeps its place, and the ones further away shift to meet it.
 */
const beside = (values: number[], anchors: number[], target: number | undefined) => {
  if (target === undefined) return mean(values);
  let best = 0;
  anchors.forEach((a, i) => {
    if (Math.abs(a - target) < Math.abs(anchors[best] - target)) best = i;
  });
  return values[best];
};

/** The value nearest to `target`, or the mean when there is no target. */
const nearest = (values: number[], target: number | undefined) =>
  target === undefined ? mean(values) : values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best));

/** Where the lines of a grid sit, as shares of the grid. */
interface Lines {
  /** Row lines that span the grid: every row line when cut by rows, and the lines between bands when cut by columns. */
  ys: number[];
  /** Row lines inside a region (cut by columns), by region and row boundary. */
  regionY: number[][];
  /** Column lines that cut a band into regions (cut by columns), by band and column boundary. */
  cutX: Record<number, number>[];
  /** Column lines inside a row, by row and column boundary. */
  inRow: number[][];
}

/** Walks a tree and records the ratio that puts each split on its line. */
function fit(node: Node, rect: Rect, lines: Lines, out: Record<string, number>) {
  if (node.kind === "leaf") return;
  const k = node.boundary ?? 0;
  const at = node.axis === "y"
    ? node.region !== undefined ? lines.regionY[node.region][k] : lines.ys[k]
    : node.row !== undefined ? lines.inRow[node.row][k] : lines.cutX[node.band ?? 0][k];
  const start = node.axis === "x" ? rect.x : rect.y;
  const size = node.axis === "x" ? rect.w : rect.h;
  const ratio = limitRatio((at - start) / size);
  out[node.path] = ratio;
  if (node.axis === "x") {
    const aw = rect.w * ratio;
    fit(node.a, { x: rect.x, y: rect.y, w: aw, h: rect.h }, lines, out);
    fit(node.b, { x: rect.x + aw, y: rect.y, w: rect.w - aw, h: rect.h }, lines, out);
  } else {
    const ah = rect.h * ratio;
    fit(node.a, { x: rect.x, y: rect.y, w: rect.w, h: ah }, lines, out);
    fit(node.b, { x: rect.x, y: rect.y + ah, w: rect.w, h: rect.h - ah }, lines, out);
  }
}

export interface GridFlip { flow: GridFlow; ratios: Record<string, number>; cuts: number[]; bands: number[] }

/** Every window's rectangle on the unit square, and a way to read the cell at a row and column. */
function cellsOf(input: LayoutInput) {
  const ws = input.workspace;
  const { cols, rows, last } = gridDims(ws.windows.length);
  const unit: Rect = { x: 0, y: 0, w: 1, h: 1 };
  const rectOf = new Map<number, Rect>();
  for (const tile of computeLayout({ ...input, area: unit }).tiles) {
    if (tile.windows[0] !== undefined) rectOf.set(tile.windows[0], tile.rect);
  }
  const cell = (r: number, c: number) => rectOf.get(ws.windows[r * cols + c])!;
  const width = (r: number) => (r === rows - 1 ? last : cols);
  // Column lines inside each row, where every window stands now.
  const inRow = Array.from({ length: rows }, (_, r) => [0, ...Array.from({ length: width(r) - 1 }, (_, i) => cell(r, i + 1).x)]);
  return { unit, rectOf, cell, inRow };
}

/**
 * What it takes to turn a grid over to the other flow, or null when it cannot: it cannot turn over, already uses that flow,
 * or a line it would have to join is in parts that are not lined up (more than FLIP_ALIGN apart). Then no window changes,
 * and the line being dragged moves whole, or `localizeGrid` may confine it to a few rows.
 * The ratios replace all the old ones; `cuts` are the column lines that cut the grid into regions, for the new flow.
 * Tiles stay where they are, with two exceptions:
 * - A line that was in parts, lined up to within FLIP_ALIGN, becomes one line. It keeps the part nearest to `near`, the
 *   point the user grabbed (a share of the area). Without `near` it takes the mean.
 * - When the last row is short (3, 3, 2 windows), each of its column lines goes to the nearest column line of the full rows,
 *   and a tie goes to the one nearer `near`. The last row's windows change width to match.
 * It is measured on a unit square, since every split is a share of its own area.
 */
export function flipGrid(input: LayoutInput, to: GridFlow, near?: { x: number; y: number }): GridFlip | null {
  const ws = input.workspace;
  const { cols, rows, last, full, flippable } = gridDims(ws.windows.length);
  if (ws.layout !== "grid" || !flippable || gridFlowOf(ws) === to) return null;
  const { unit, cell, inRow } = cellsOf(input);

  let cuts: number[] = [];
  const cutLines: Record<number, number> = {};
  const ys: number[] = [0];
  if (to === "cols") {
    // A full grid has no short row: every row agrees on its lines. With a short last row, only the rows above it do.
    const agreeing = full ? rows : rows - 1;
    const lines = [0];
    for (let k = 1; k < cols; k++) {
      const parts = Array.from({ length: agreeing }, (_, r) => cell(r, k).x);
      if (spread(parts) > FLIP_ALIGN) return null;
      const middles = Array.from({ length: agreeing }, (_, r) => cell(r, k).y + cell(r, k).h / 2);
      lines[k] = beside(parts, middles, near?.y);
    }
    for (let j = 1; j < last; j++) {
      const target = cell(rows - 1, j).x;
      const from = (cuts[j - 2] ?? 0) + 1;
      const until = cols - 1 - (last - 1 - j);
      let pick = from;
      for (let k = from; k <= until; k++) {
        const closer = Math.abs(lines[k] - target) - Math.abs(lines[pick] - target);
        const tie = Math.abs(closer) < 1e-9 && near !== undefined && Math.abs(lines[k] - near.x) < Math.abs(lines[pick] - near.x);
        if (closer < -1e-9 || tie) pick = k;
      }
      cuts.push(pick);
      cutLines[pick] = lines[pick];
    }
    for (let k = 1; k < rows; k++) ys[k] = cell(k, 0).y;
    const regionY = Array.from({ length: cuts.length + 1 }, () => ys);
    const out: Record<string, number> = {};
    fit(gridTree(ws.windows, "cols", cuts, []), unit, { ys, regionY, cutX: [cutLines], inRow }, out);
    return { flow: "cols", ratios: out, cuts, bands: [] };
  }

  // Back to rows: one line between rows, taken from the region beside the one the user grabbed.
  const edges = [0, ...gridCutsOf(ws), cols];
  const regionMiddles = Array.from({ length: edges.length - 1 }, (_, g) => (cell(0, edges[g]).x + cell(0, edges[g + 1] - 1).x + cell(0, edges[g + 1] - 1).w) / 2);
  for (let k = 1; k < rows; k++) {
    const parts = Array.from({ length: edges.length - 1 }, (_, g) => (k === rows - 1 ? cell(k, g).y : cell(k, edges[g]).y));
    if (spread(parts) > FLIP_ALIGN) return null;
    ys[k] = beside(parts, regionMiddles, near?.x);
  }
  const out: Record<string, number> = {};
  fit(gridTree(ws.windows, "rows", [], []), unit, { ys, regionY: [], cutX: [], inRow }, out);
  return { flow: "rows", ratios: out, cuts: [], bands: [] };
}

/**
 * Confines the column lines of a grid cut by columns to a few rows, so dragging one does not move windows far from the one
 * grabbed. It cuts the grid across its width at the row line above the grabbed window and the one below it, each as near as
 * can be that is lined up across the columns (the top and bottom of the grid, and the cuts already there, always are).
 * The windows between those lines become a band of their own. A column line then runs only through that band.
 * Returns null when no cut is possible, which is when the grabbed window already is a whole band, or the row lines around it
 * are not lined up (within LOCALIZE_ALIGN). The line then moves through all the rows of its band.
 * `near` is where the line was grabbed, a share of the area. A cut line keeps the part beside it.
 */
export function localizeGrid(input: LayoutInput, near: { x: number; y: number }): GridFlip | null {
  const ws = input.workspace;
  const { cols, rows, flippable } = gridDims(ws.windows.length);
  if (ws.layout !== "grid" || !flippable || gridFlowOf(ws) !== "cols") return null;
  const { unit, rectOf, cell, inRow } = cellsOf(input);

  const cuts = gridCutsOf(ws);
  const bands = gridBandsOf(ws);
  const colEdges = [0, ...cuts, cols];
  const regions = colEdges.length - 1;
  // Where row line k sits in region g.
  const yIn = (k: number, g: number) => (k === rows - 1 ? cell(k, g).y : cell(k, colEdges[g]).y);

  // The row of the window beside the grabbed line.
  const held = [-0.002, 0.002]
    .map((dx) => ws.windows.findIndex((id) => {
      const r = rectOf.get(id);
      return !!r && near.x + dx >= r.x && near.x + dx <= r.x + r.w && near.y >= r.y && near.y <= r.y + r.h;
    }))
    .find((i) => i >= 0);
  if (held === undefined) return null;
  const grabbedRow = Math.floor(held / cols);

  const rowEdges = [0, ...bands, rows];
  const band = rowEdges.findIndex((e, i) => i < rowEdges.length - 1 && grabbedRow >= e && grabbedRow < rowEdges[i + 1]);
  const r0 = rowEdges[band];
  const r1 = rowEdges[band + 1];
  const partsOf = (k: number) => Array.from({ length: regions }, (_, g) => yIn(k, g));
  const lined = (k: number) => k === r0 || k === r1 || spread(partsOf(k)) <= LOCALIZE_ALIGN;

  let top = grabbedRow;
  while (top > r0 && !lined(top)) top--;
  let bottom = grabbedRow + 1;
  while (bottom < r1 && !lined(bottom)) bottom++;
  if (top === r0 && bottom === r1) return null;

  const newBands = [...bands];
  if (top > r0) newBands.push(top);
  if (bottom < r1) newBands.push(bottom);
  newBands.sort((p, q) => p - q);

  // Cut lines are single lines now. The ones that already were keep their place; the new ones join where the user grabbed.
  const ys: number[] = [0];
  const regionMiddles = Array.from({ length: regions }, (_, g) => (cell(0, colEdges[g]).x + cell(0, colEdges[g + 1] - 1).x + cell(0, colEdges[g + 1] - 1).w) / 2);
  for (let k = 1; k < rows; k++) ys[k] = bands.includes(k) ? yIn(k, 0) : beside(partsOf(k), regionMiddles, near.x);
  const regionY = Array.from({ length: regions }, (_, g) => [0, ...Array.from({ length: rows - 1 }, (_, i) => yIn(i + 1, g))]);

  // Each band keeps the column lines it already has: read from its first row.
  const newEdges = [0, ...newBands, rows];
  const cutX = newEdges.slice(0, -1).map((first) => {
    const lines: Record<number, number> = {};
    cuts.forEach((k, i) => (lines[k] = first === rows - 1 ? cell(first, i + 1).x : cell(first, k).x));
    return lines;
  });

  const out: Record<string, number> = {};
  fit(gridTree(ws.windows, "cols", cuts, newBands), unit, { ys, regionY, cutX, inRow }, out);
  return { flow: "cols", ratios: out, cuts, bands: newBands };
}

/**
 * After a grid turns over, the divider a drag carries on with: the one on the same boundary whose span holds the pointer.
 * `point` is in the same coordinates as the seams.
 */
export function seamAfterFlip(seams: Seam[], from: Seam, point: { x: number; y: number }): Seam | null {
  const same = seams.filter((s) => s.axis === from.axis && s.boundary === from.boundary);
  const p = from.axis === "y" ? point.x : point.y;
  const holds = (s: Seam) => {
    const start = from.axis === "y" ? s.origin.x : s.origin.y;
    const size = from.axis === "y" ? s.size.w : s.size.h;
    return p >= start && p <= start + size;
  };
  return same.find(holds) ?? same[0] ?? null;
}

/**
 * The ratios after the divider `path` is dragged to `share` of its own area. `minimum` is the smallest either side may get,
 * in the area's units, so a window can be made small but not vanish. Every other divider below it in the tree keeps
 * its place on the screen, so only the window across the divider changes size. Without that, a row of three windows would
 * rescale its second and third windows when the first divider moves, because each ratio is a share of its parent.
 */
export function moveSeam(input: LayoutInput, path: string, share: number, minimum: { w: number; h: number } = { w: 0, h: 0 }): Record<string, number> {
  const ws = input.workspace;
  const tree = buildTree(input);
  if (!tree) return ws.ratios;
  // Everything is measured in the area's own units, so the minimum size is given in the same units as the area.
  const unit: Rect = { x: 0, y: 0, w: input.area.w, h: input.area.h };
  // How many windows sit side by side, or one above the other, in the busiest line. If the minimum leaves no room for them
  // all, with a little to spare to drag in, it is lowered until they fit.
  const count = (node: Node, axis: "x" | "y"): number => {
    if (node.kind === "leaf") return 1;
    const a = count(node.a, axis);
    const b = count(node.b, axis);
    return node.axis === axis ? a + b : Math.max(a, b);
  };
  const least = {
    w: Math.min(minimum.w, input.area.w / (count(tree, "x") * 1.25)),
    h: Math.min(minimum.h, input.area.h / (count(tree, "y") * 1.25)),
  };

  // Where every divider is now, as a share of the whole area.
  const lines: Record<string, number> = {};
  const note = (node: Node, rect: Rect) => {
    if (node.kind === "leaf") return;
    const r = ratioOf(node, ws);
    if (node.axis === "x") {
      lines[node.path] = rect.x + rect.w * r;
      note(node.a, { x: rect.x, y: rect.y, w: rect.w * r, h: rect.h });
      note(node.b, { x: rect.x + rect.w * r, y: rect.y, w: rect.w * (1 - r), h: rect.h });
    } else {
      lines[node.path] = rect.y + rect.h * r;
      note(node.a, { x: rect.x, y: rect.y, w: rect.w, h: rect.h * r });
      note(node.b, { x: rect.x, y: rect.y + rect.h * r, w: rect.w, h: rect.h * (1 - r) });
    }
  };
  note(tree, unit);

  // The least room a subtree needs along an axis: one minimum window, or the sum of its two sides when they sit along that axis.
  const needed = (node: Node, axis: "x" | "y"): number => {
    if (node.kind === "leaf") return axis === "x" ? least.w : least.h;
    const a = needed(node.a, axis);
    const b = needed(node.b, axis);
    return node.axis === axis ? a + b : Math.max(a, b);
  };

  const out = { ...ws.ratios };
  const retarget = (node: Node, rect: Rect, below: boolean) => {
    if (node.kind === "leaf") return;
    const here = node.path === path;
    const start = node.axis === "x" ? rect.x : rect.y;
    const size = node.axis === "x" ? rect.w : rect.h;
    // Below the dragged divider, a divider's ratio is whatever keeps it where it was in its new area.
    // Each side keeps room for every window in it at the minimum size. When the area is too small for that, it is shared in proportion.
    const roomA = needed(node.a, node.axis);
    const roomB = needed(node.b, node.axis);
    const low = roomA / Math.max(size, 1e-9);
    const high = 1 - roomB / Math.max(size, 1e-9);
    const hold = (value: number) => (low > high ? roomA / Math.max(roomA + roomB, 1e-9) : Math.min(high, Math.max(low, limitRatio(value))));
    const r = here ? hold(share) : below ? hold((lines[node.path] - start) / size) : ratioOf(node, ws);
    if (here || below) out[node.path] = r;
    if (node.axis === "x") {
      retarget(node.a, { x: rect.x, y: rect.y, w: rect.w * r, h: rect.h }, below || here);
      retarget(node.b, { x: rect.x + rect.w * r, y: rect.y, w: rect.w * (1 - r), h: rect.h }, below || here);
    } else {
      retarget(node.a, { x: rect.x, y: rect.y, w: rect.w, h: rect.h * r }, below || here);
      retarget(node.b, { x: rect.x, y: rect.y + rect.h * r, w: rect.w, h: rect.h * (1 - r) }, below || here);
    }
  };
  retarget(tree, unit, false);
  return out;
}

export function computeTiles(input: LayoutInput): Tile[] {
  return computeLayout(input).tiles;
}
