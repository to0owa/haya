import { describe, expect, test } from "bun:test";
import { computeLayout, flipGrid, gridFlowOf, localizeGrid, moveSeam, seamAfterFlip, SEAM_HIT } from "./layouts";
import { clampRatio, createDefaultConfig, DEFAULT_RULES, MIN_TILE_SHARE, normalize, RATIO_FLOOR, openWindow, setLayout, withGridFlow, withRatio, withRatios } from "./model";

const AREA = { x: 0, y: 0, w: 1000, h: 800 };

function build(count: number, layout: "tile" | "bstack" | "monocle" | "grid" | "ide") {
  let config = createDefaultConfig();
  for (let i = 0; i < count; i++) config = openWindow(config, "terminal").config;
  config = setLayout(config, layout);
  return config;
}

function layoutOf(config = build(3, "tile")) {
  return computeLayout({ workspace: config.workspaces[0], kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
}

describe("dividers", () => {
  test("tile has a vertical divider at the master split", () => {
    const [seam] = layoutOf(build(3, "tile")).seams;
    expect(seam.axis).toBe("x");
    expect(seam.rect.x + SEAM_HIT / 2).toBeCloseTo(1000 * 0.55);
    expect(seam.rect.h).toBe(800);
  });

  test("bstack has a horizontal divider at the master split", () => {
    const [seam] = layoutOf(build(3, "bstack")).seams;
    expect(seam.axis).toBe("y");
    expect(seam.rect.y + SEAM_HIT / 2).toBeCloseTo(800 * 0.55);
  });

  test("grid has dividers too: one between rows and one per row between columns", () => {
    // Four windows make two rows of two: three splits, so three dividers.
    const seams = layoutOf(build(4, "grid")).seams;
    expect(seams).toHaveLength(3);
    expect(seams.filter((s) => s.axis === "y")).toHaveLength(1);
    expect(seams.filter((s) => s.axis === "x")).toHaveLength(2);
    expect(new Set(seams.map((s) => s.path)).size).toBe(3);
  });

  test("a single window and monocle have no divider", () => {
    expect(layoutOf(build(1, "tile")).seams).toEqual([]);
    expect(layoutOf(build(3, "monocle")).seams).toEqual([]);
  });
});

describe("split ratios", () => {
  test("a stored ratio moves its divider and the tiles on either side", () => {
    let config = build(3, "tile");
    config = withRatio(config, "", 0.3);
    const { tiles, seams } = layoutOf(config);
    expect(tiles[0].rect.w).toBeCloseTo(300);
    expect(seams[0].rect.x + SEAM_HIT / 2).toBeCloseTo(300);
  });

  test("a grid divider stores its own path, so one row can change without touching the others", () => {
    let config = build(4, "grid");
    const rowSeam = layoutOf(config).seams.find((s) => s.axis === "y")!;
    config = withRatio(config, rowSeam.path, 0.25);
    const tiles = layoutOf(config).tiles;
    expect(tiles[0].rect.h).toBeCloseTo(200);
    expect(tiles[2].rect.h).toBeCloseTo(600);
  });

  test("ratios are clamped and clearing one restores the default", () => {
    const config = build(3, "tile");
    expect(withRatio(config, "", 2).workspaces[0].ratios[""]).toBe(1 - RATIO_FLOOR);
    expect(withRatio(config, "", -1).workspaces[0].ratios[""]).toBe(RATIO_FLOOR);
    expect(clampRatio(0.4321)).toBe(0.43);
    const cleared = withRatio(withRatio(config, "", 0.3), "", null);
    expect(cleared.workspaces[0].ratios).toEqual({});
  });

  test("changing layout clears dragged ratios, since they belong to the old shape", () => {
    const dragged = withRatio(build(4, "grid"), "", 0.3);
    expect(setLayout(dragged, "tile").workspaces[0].ratios).toEqual({});
  });
});

describe("grid turns over so every divider part moves alone", () => {
  const input = (config: ReturnType<typeof build>) => ({ workspace: config.workspaces[0], kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
  /** Turns the grid over and returns the new config. */
  const flipped = (config: ReturnType<typeof build>, to: "rows" | "cols", near?: { x: number; y: number }) => {
    const flip = flipGrid(input(config), to, near)!;
    return withGridFlow(config, to, flip.ratios, flip.cuts);
  };
  /** The tile that holds window `id`, wherever it ended up. */
  const tileOf = (config: ReturnType<typeof build>, id: number) => layoutOf(config).tiles.find((t) => t.windows[0] === id)!.rect;

  test("by rows, the divider between rows spans the grid and is marked to turn it over", () => {
    const seams = layoutOf(build(4, "grid")).seams;
    const between = seams.filter((s) => s.axis === "y");
    expect(between).toHaveLength(1);
    expect(between[0].flip).toBe("cols");
    expect(seams.filter((s) => s.axis === "x").every((s) => s.flip === undefined)).toBe(true);
  });

  test("turning over keeps every tile where it is", () => {
    const config = build(4, "grid");
    // Tiles come out column by column after the turn, so they are compared window by window.
    const turned = flipped(config, "cols");
    for (const id of config.workspaces[0].windows) {
      const before = tileOf(config, id);
      const after = tileOf(turned, id);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
      expect(after.w).toBeCloseTo(before.w);
      expect(after.h).toBeCloseTo(before.h);
    }
  });

  test("by columns, the line between rows is one divider per column, so one column can change alone", () => {
    const turned = flipped(build(4, "grid"), "cols");
    const seams = layoutOf(turned).seams;
    const rowLines = seams.filter((s) => s.axis === "y");
    expect(rowLines).toHaveLength(2);
    expect(new Set(rowLines.map((s) => s.path)).size).toBe(2);

    const left = rowLines.find((s) => s.origin.x === 0)!;
    const moved = withRatio(turned, left.path, 0.25);
    const [a, b] = [0, 2].map((id) => tileOf(moved, turned.workspaces[0].windows[id]));
    // Left column: the top window is short, the bottom one is tall.
    expect(a.h).toBeCloseTo(200);
    expect(b.h).toBeCloseTo(600);
    // Right column is untouched.
    const [c, d] = [1, 3].map((id) => tileOf(moved, turned.workspaces[0].windows[id]));
    expect(c.h).toBeCloseTo(400);
    expect(d.h).toBeCloseTo(400);
  });

  test("a line in parts that are close together becomes one line at their mean", () => {
    let config = build(4, "grid");
    const [top, bottom] = layoutOf(config).seams.filter((s) => s.axis === "x");
    config = withRatio(withRatio(config, top.path, 0.495), bottom.path, 0.505);
    const turned = flipped(config, "cols");
    const columnLine = layoutOf(turned).seams.find((s) => s.axis === "x")!;
    expect(columnLine.rect.x + SEAM_HIT / 2).toBeCloseTo(500, 0);
  });

  test("lines that are not lined up keep the grid as it is, so no other window moves", () => {
    // Top row split at 0.3, bottom at 0.7: joining them would move every window in both rows.
    let config = build(4, "grid");
    const [top, bottom] = layoutOf(config).seams.filter((s) => s.axis === "x");
    config = withRatio(withRatio(config, top.path, 0.3), bottom.path, 0.7);
    expect(flipGrid(input(config), "cols", { x: 0.2, y: 0.5 })).toBeNull();
    expect(flipGrid(input(config), "cols")).toBeNull();
  });

  test("lines that are lined up to within the tolerance join at the part beside the grab", () => {
    let config = build(4, "grid");
    const [top, bottom] = layoutOf(config).seams.filter((s) => s.axis === "x");
    config = withRatio(withRatio(config, top.path, 0.495), bottom.path, 0.505);
    const columnLineAt = (near: { x: number; y: number }) => {
      const turned = flipped(config, "cols", near);
      const line = layoutOf(turned).seams.find((s) => s.axis === "x")!;
      return line.rect.x + SEAM_HIT / 2;
    };
    // The row nearest the grab keeps its line: grabbed beside the top row, that row's line stays; beside the bottom, that one.
    expect(columnLineAt({ x: 0.5, y: 0.1 })).toBeCloseTo(495, 0);
    expect(columnLineAt({ x: 0.5, y: 0.9 })).toBeCloseTo(505, 0);
  });

  test("turning back to rows is refused while the row lines differ between regions", () => {
    const config = build(4, "grid");
    const cols = flipped(config, "cols");
    const left = layoutOf(cols).seams.find((x) => x.axis === "y" && x.origin.x === 0)!;
    const staggered = withRatio(cols, left.path, 0.3);
    expect(flipGrid(input(staggered), "rows")).toBeNull();
  });

  test("turning back to rows also keeps the tiles", () => {
    const config = build(9, "grid");
    const cols = flipped(config, "cols");
    const rows = flipped(cols, "rows");
    for (const id of config.workspaces[0].windows) {
      const before = tileOf(cols, id);
      const after = tileOf(rows, id);
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
    }
  });

  test("a grid turns over when it has two rows and its last row has at least two windows", () => {
    // 1, 2: one row. 3 and 7: the last row has one window, which spans the grid, so there is no line to match.
    for (const count of [1, 2, 3, 7]) expect(flipGrid(input(build(count, "grid")), "cols")).toBeNull();
    expect(flipGrid(input(build(4, "tile")), "cols")).toBeNull();
    expect(flipGrid(input(build(4, "grid")), "rows")).toBeNull(); // already by rows
    for (const count of [4, 5, 6, 8, 9]) expect(flipGrid(input(build(count, "grid")), "cols")).not.toBeNull();
  });

  test("a grid that cannot turn over keeps its rows even if it was saved by columns", () => {
    const config = withGridFlow(build(3, "grid"), "cols", {});
    expect(gridFlowOf(config.workspaces[0])).toBe("rows");
  });

  test("the drag carries on with the divider part under the pointer", () => {
    const config = build(4, "grid");
    const held = layoutOf(config).seams.find((s) => s.axis === "y")!;
    const turned = flipped(config, "cols");
    const seams = layoutOf(turned).seams;
    expect(seamAfterFlip(seams, held, { x: 100, y: 400 })?.origin.x).toBe(0);
    expect(seamAfterFlip(seams, held, { x: 900, y: 400 })?.origin.x).toBeCloseTo(500);
  });

  test("changing layout, or loading a config with no flow saved, uses rows", () => {
    const turned = flipped(build(4, "grid"), "cols");
    expect(setLayout(turned, "tile").workspaces[0].gridFlow).toBe("rows");
    expect(normalize({ version: 1, workspaces: [] }).workspaces[0].gridFlow).toBe("rows");
    expect(normalize({ version: 1, workspaces: [{ id: 1, layout: "grid", gridFlow: "cols" }] }).workspaces[0].gridFlow).toBe("cols");
  });
});

describe("a grid whose last row is short", () => {
  const input = (config: ReturnType<typeof build>) => ({ workspace: config.workspaces[0], kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
  const flipped = (config: ReturnType<typeof build>, near?: { x: number; y: number }) => {
    const flip = flipGrid(input(config), "cols", near)!;
    return withGridFlow(config, "cols", flip.ratios, flip.cuts);
  };
  const rectOf = (config: ReturnType<typeof build>, index: number) =>
    layoutOf(config).tiles.find((t) => t.windows[0] === config.workspaces[0].windows[index])!.rect;

  test("the last row's line goes to the nearest column line, and a tie goes to the one nearer the grab", () => {
    // 8 windows: rows of 3, 3 and 2. The last row's line is at 1/2, the full rows' lines at 1/3 and 2/3: a tie.
    const config = build(8, "grid");
    const left = flipGrid(input(config), "cols", { x: 0.1, y: 0.5 })!;
    const right = flipGrid(input(config), "cols", { x: 0.9, y: 0.5 })!;
    expect(left.cuts).toEqual([1]);
    expect(right.cuts).toEqual([2]);
  });

  test("the full rows do not move, and the last row's windows meet the matched line", () => {
    const config = build(8, "grid");
    const turned = flipped(config, { x: 0.1, y: 0.5 });
    for (const index of [0, 1, 2, 3, 4, 5]) {
      const before = rectOf(config, index);
      const after = rectOf(turned, index);
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.w).toBeCloseTo(before.w, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
    }
    // Window 6 was half the width. It is now one column wide, since its line moved from 1/2 to 1/3.
    expect(rectOf(turned, 6).w).toBeCloseTo(1000 / 3, 0);
    expect(rectOf(turned, 7).w).toBeCloseTo((1000 * 2) / 3, 0);
  });

  test("each region's line between rows is its own, so one side can move without the other", () => {
    const config = build(8, "grid");
    const turned = flipped(config, { x: 0.1, y: 0.5 });
    const heights = (c: ReturnType<typeof build>) => [0, 3, 6, 1, 4, 7].map((i) => Math.round(rectOf(c, i).h));
    // The line between the middle row and the last row, in the left region (a column wide) and the right region (two wide).
    const lines = layoutOf(turned).seams.filter((s) => s.axis === "y" && s.boundary === 2);
    expect(lines).toHaveLength(2);
    const leftLine = lines.find((s) => s.origin.x === 0)!;
    const moved = withRatio(turned, leftLine.path, 0.3);
    // The left region's rows changed. The right region's did not.
    expect(rectOf(moved, 3).h).not.toBeCloseTo(rectOf(turned, 3).h, 0);
    expect(rectOf(moved, 4).h).toBeCloseTo(rectOf(turned, 4).h, 0);
    expect(rectOf(moved, 7).h).toBeCloseTo(rectOf(turned, 7).h, 0);
    expect(heights(turned)).toHaveLength(6);
  });

  test("turning back to rows keeps the tiles, and drops the cuts", () => {
    const config = build(8, "grid");
    const cols = flipped(config, { x: 0.1, y: 0.5 });
    const back = withGridFlow(cols, "rows", flipGrid(input(cols), "rows")!.ratios, []);
    for (let i = 0; i < 8; i++) {
      expect(rectOf(back, i).x).toBeCloseTo(rectOf(cols, i).x, 0);
      expect(rectOf(back, i).w).toBeCloseTo(rectOf(cols, i).w, 0);
    }
    expect(back.workspaces[0].gridCuts).toEqual([]);
  });

  test("five windows (3, 2) turn over too", () => {
    const config = build(5, "grid");
    const turned = flipped(config, { x: 0.9, y: 0.5 });
    expect(turned.workspaces[0].gridCuts).toEqual([2]);
    expect(layoutOf(turned).tiles).toHaveLength(5);
  });
});

describe("dragging one divider changes only the window across it", () => {
  const input = (config: ReturnType<typeof build>) => ({ workspace: config.workspaces[0], kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
  const dragged = (config: ReturnType<typeof build>, path: string, share: number) => withRatios(config, moveSeam(input(config), path, share));
  const rectOf = (config: ReturnType<typeof build>, index: number) =>
    layoutOf(config).tiles.find((t) => t.windows[0] === config.workspaces[0].windows[index])!.rect;

  test("in a row of three, moving the first line leaves the third window alone", () => {
    const config = build(9, "grid"); // 3 by 3, by rows
    const firstLine = layoutOf(config).seams.find((s) => s.axis === "x" && s.row === 0 && s.boundary === 1)!;
    const moved = dragged(config, firstLine.path, 0.2);
    // Window 0 shrinks and window 1 takes the room. Window 2, the neighbour beyond, does not move or resize.
    expect(rectOf(moved, 0).w).toBeCloseTo(200, 3 - 3);
    expect(rectOf(moved, 2).x).toBeCloseTo(rectOf(config, 2).x, 6);
    expect(rectOf(moved, 2).w).toBeCloseTo(rectOf(config, 2).w, 6);
    // The rows below are not touched either.
    for (const index of [3, 4, 5, 6, 7, 8]) expect(rectOf(moved, index)).toEqual(rectOf(config, index));
  });

  test("in a column of three, moving the first line leaves the last window alone", () => {
    const config = flipGridTo(build(9, "grid"));
    const line = layoutOf(config).seams.find((s) => s.axis === "y" && s.boundary === 1 && s.origin.x === 0)!;
    const before = layoutOf(config).tiles.map((t) => t.rect);
    const moved = dragged(config, line.path, 0.2);
    const after = layoutOf(moved).tiles.map((t) => t.rect);
    // Only the two windows on either side of that line, in that column, changed.
    const changed = before.map((r, i) => i).filter((i) => JSON.stringify(before[i]) !== JSON.stringify(after[i]));
    expect(changed).toHaveLength(2);
  });

  test("a divider that has nothing below it behaves as before", () => {
    const config = build(3, "tile");
    const moved = dragged(config, "", 0.3);
    expect(rectOf(moved, 0).w).toBeCloseTo(300, 3 - 3);
  });

  test("ratios are not snapped to steps", () => {
    const config = build(3, "tile");
    expect(dragged(config, "", 0.4321).workspaces[0].ratios[""]).toBeCloseTo(0.4321, 6);
  });

  function flipGridTo(config: ReturnType<typeof build>) {
    const flip = flipGrid(input(config), "cols")!;
    return withGridFlow(config, "cols", flip.ratios, flip.cuts);
  }
});

describe("a column line is confined to the rows around the grabbed window", () => {
  type Config = ReturnType<typeof build>;
  const input = (config: Config) => ({ workspace: config.workspaces[0], kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
  const rectOf = (config: Config, index: number) =>
    layoutOf(config).tiles.find((t) => t.windows[0] === config.workspaces[0].windows[index])!.rect;
  const apply = (config: Config, flip: NonNullable<ReturnType<typeof localizeGrid>>) => withGridFlow(config, flip.flow, flip.ratios, flip.cuts, flip.bands);
  /** 12 windows in 4 columns by 3 rows, turned over to be cut by columns. */
  function byColumns(): Config {
    const config = build(12, "grid");
    return apply(config, flipGrid(input(config), "cols")!);
  }
  /** Moves the row line `boundary` in one region (a column), so it no longer lines up with the others. */
  function stagger(config: Config, boundary: number, regionX: number, share: number): Config {
    const line = layoutOf(config).seams.find((s) => s.axis === "y" && s.boundary === boundary && Math.abs(s.origin.x - regionX) < 1)!;
    // Drag it the way the app does, so the other row lines in that region stay where they are.
    return withRatios(config, moveSeam(input(config), line.path, share));
  }
  const key = (r: { x: number; y: number; w: number; h: number }) => [r.x, r.y, r.w, r.h].map((v) => v.toFixed(4)).join(",");
  const changed = (before: Config, after: Config) =>
    Array.from({ length: 12 }, (_, i) => i).filter((i) => key(rectOf(before, i)) !== key(rectOf(after, i)));
  /** Drags the column line between columns 1 and 2 (boundary 2), where it runs through the row at `y`. */
  function dragColumnLine(config: Config, y: number, share: number): Config {
    const line = layoutOf(config).seams.find((s) => s.axis === "x" && s.boundary === 2 && s.row === undefined && y >= s.origin.y && y <= s.origin.y + s.size.h)!;
    return withRatios(config, moveSeam(input(config), line.path, share));
  }

  test("before, the line runs through every row, so the far windows move too", () => {
    const config = stagger(stagger(byColumns(), 2, 0, 0.8), 2, 750, 0.3); // rows 1 and 2 no longer line up
    const moved = dragColumnLine(config, 0.1, 0.3);
    expect(changed(config, moved).sort((a, b) => a - b)).toEqual([1, 2, 5, 6, 9, 10]);
  });

  test("with the row line below the grabbed row lined up, the line runs through that row only", () => {
    // Only row line 2 is staggered. Row line 1 still lines up, so the top row can be cut off.
    const config = stagger(stagger(byColumns(), 2, 0, 0.8), 2, 750, 0.3);
    const flip = localizeGrid(input(config), { x: 0.5, y: 0.1 })!;
    expect(flip.bands).toEqual([1]);
    const confined = apply(config, flip);
    // Nothing moved by being cut, beyond the tolerance.
    for (let i = 0; i < 12; i++) {
      expect(rectOf(confined, i).h).toBeCloseTo(rectOf(config, i).h, 1);
      expect(rectOf(confined, i).w).toBeCloseTo(rectOf(config, i).w, 1);
    }
    const moved = dragColumnLine(confined, 0.1, 0.3);
    expect(changed(confined, moved).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  test("when the nearest row line does not line up, it goes down to the next one that does", () => {
    // Row line 1 is staggered, row line 2 lines up: the band is two rows tall.
    const config = stagger(stagger(byColumns(), 1, 0, 0.42), 1, 750, 0.25);
    const flip = localizeGrid(input(config), { x: 0.5, y: 0.1 })!;
    expect(flip.bands).toEqual([2]);
    const moved = dragColumnLine(apply(config, flip), 0.1, 0.3);
    expect(changed(apply(config, flip), moved).sort((a, b) => a - b)).toEqual([1, 2, 5, 6]);
  });

  test("a window in the middle row is cut off from above and below", () => {
    const config = byColumns();
    const flip = localizeGrid(input(config), { x: 0.5, y: 0.5 })!;
    expect(flip.bands).toEqual([1, 2]);
  });

  test("nothing is cut when no row line around the grabbed window lines up", () => {
    // Stagger both inner row lines in two regions: only the top and bottom of the grid line up.
    let config = byColumns();
    config = stagger(stagger(config, 1, 0, 0.42), 1, 750, 0.25);
    config = stagger(stagger(config, 2, 0, 0.8), 2, 750, 0.3);
    expect(localizeGrid(input(config), { x: 0.5, y: 0.5 })).toBeNull();
  });

  test("the tree keeps working after a cut: every window is still placed once", () => {
    const config = byColumns();
    const confined = apply(config, localizeGrid(input(config), { x: 0.5, y: 0.5 })!);
    const tiles = layoutOf(confined).tiles;
    expect(tiles).toHaveLength(12);
    expect(new Set(tiles.map((t) => t.windows[0])).size).toBe(12);
    expect(tiles.reduce((total, t) => total + t.rect.w * t.rect.h, 0)).toBeCloseTo(AREA.w * AREA.h, 0);
  });

  test("changing layout drops the bands", () => {
    const config = byColumns();
    const confined = apply(config, localizeGrid(input(config), { x: 0.5, y: 0.5 })!);
    expect(confined.workspaces[0].gridBands).toEqual([1, 2]);
    expect(setLayout(confined, "tile").workspaces[0].gridBands).toEqual([]);
  });
});

describe("how small a window may be dragged", () => {
  const input = (config: ReturnType<typeof build>) => ({ workspace: config.workspaces[0], kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
  const rectOf = (config: ReturnType<typeof build>, index: number) =>
    layoutOf(config).tiles.find((t) => t.windows[0] === config.workspaces[0].windows[index])!.rect;
  /** The minimum, for the 1000 by 800 test area: 150 by 120. */
  const MIN = { w: AREA.w * MIN_TILE_SHARE, h: AREA.h * MIN_TILE_SHARE };

  test("a window stops at 15% of the area", () => {
    const config = build(2, "grid");
    const moved = withRatios(config, moveSeam(input(config), "", 0.97, MIN));
    expect(rectOf(moved, 1).w).toBeCloseTo(150, 3);
    // Just over the minimum is allowed.
    const nearly = withRatios(config, moveSeam(input(config), "", 0.84, MIN));
    expect(rectOf(nearly, 1).w).toBeCloseTo(160, 3);
  });

  test("it works from the other side and for heights too", () => {
    const down = withRatios(build(2, "bstack"), moveSeam(input(build(2, "bstack")), "", 0.99, MIN));
    expect(rectOf(down, 1).h).toBeCloseTo(120, 3);
    const left = withRatios(build(2, "tile"), moveSeam(input(build(2, "tile")), "", 0.001, MIN));
    expect(rectOf(left, 0).w).toBeCloseTo(150, 3);
  });

  test("windows that are pushed by a divider keep the minimum too", () => {
    const config = build(9, "grid"); // 3 by 3, by rows
    const firstLine = layoutOf(config).seams.find((s) => s.axis === "x" && s.row === 0 && s.boundary === 1)!;
    const moved = withRatios(config, moveSeam(input(config), firstLine.path, 0.99, MIN));
    // Three in a row at 15% fit with room to spare, so every window keeps the full 150 px.
    for (const index of [0, 1, 2]) expect(rectOf(moved, index).w).toBeGreaterThanOrEqual(150 - 1e-6);
  });

  test("with more windows in a row than the minimum leaves room for, it shrinks to fit them", () => {
    // Seven in a row: 7 x 150 px is more than the 1000 there is, so there would be nothing to drag. The minimum drops to 1000 / (7 x 1.25).
    const config = build(49, "grid"); // 7 by 7, by rows
    const firstLine = layoutOf(config).seams.find((s) => s.axis === "x" && s.row === 0 && s.boundary === 1)!;
    const moved = withRatios(config, moveSeam(input(config), firstLine.path, 0.99, MIN));
    const widths = [0, 1, 2, 3, 4, 5, 6].map((i) => rectOf(moved, i).w);
    expect(Math.min(...widths)).toBeCloseTo(1000 / (7 * 1.25), 3);
    expect(widths[0]).toBeGreaterThan(rectOf(config, 0).w); // and the line did move
  });
});
