import { describe, expect, test } from "bun:test";
import { computeTiles } from "./layouts";
import { createDefaultConfig, DEFAULT_RULES, openWindow, setLayout } from "./model";

const AREA = { x: 0, y: 0, w: 1000, h: 800 };

function build(kinds: Array<"terminal" | "table" | "connections" | "query">, layout: "tile" | "bstack" | "monocle" | "grid" | "ide") {
  let config = createDefaultConfig();
  for (const kind of kinds) config = openWindow(config, kind).config;
  config = setLayout(config, layout);
  const ws = config.workspaces[0];
  return computeTiles({ workspace: ws, kinds: config.windows, rules: DEFAULT_RULES, area: AREA });
}

describe("tile", () => {
  test("one window fills the area", () => {
    const tiles = build(["terminal"], "tile");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].rect).toEqual(AREA);
  });

  test("master takes masterRatio of the width, the rest stack on the right", () => {
    const tiles = build(["terminal", "table", "query"], "tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[0].rect.w).toBeCloseTo(550);
    expect(tiles[1].rect.x).toBeCloseTo(550);
    expect(tiles[1].windows).toHaveLength(2);
  });
});

describe("bstack", () => {
  test("master takes masterRatio of the height, the rest sit below", () => {
    const tiles = build(["terminal", "table"], "bstack");
    expect(tiles[0].rect.h).toBeCloseTo(440);
    expect(tiles[1].rect.y).toBeCloseTo(440);
  });
});

describe("monocle", () => {
  test("all windows are tabs in one tile", () => {
    const tiles = build(["terminal", "table", "query"], "monocle");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].windows).toHaveLength(3);
    expect(tiles[0].rect).toEqual(AREA);
  });
});

describe("grid", () => {
  test("four windows form a 2 by 2 grid", () => {
    const tiles = build(["terminal", "table", "query", "connections"], "grid");
    expect(tiles).toHaveLength(4);
    expect(tiles[3].rect.x).toBeCloseTo(500);
    expect(tiles[3].rect.y).toBeCloseTo(400);
  });
});

describe("ide", () => {
  test("windows go to regions by kind: connections left, table center, terminal bottom", () => {
    const tiles = build(["connections", "table", "terminal"], "ide");
    const left = tiles.find((t) => t.windows.some((id) => id === 1));
    const center = tiles.find((t) => t.windows.some((id) => id === 2));
    const bottom = tiles.find((t) => t.windows.some((id) => id === 3));
    expect(left?.rect.x).toBe(0);
    expect(center?.rect.x).toBeGreaterThan(0);
    expect(bottom?.rect.y).toBeGreaterThan(0);
    expect(bottom?.rect.w).toBe(1000);
  });

  test("with no bottom window the center uses the full height", () => {
    const tiles = build(["table"], "ide");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].rect.h).toBe(800);
  });
});

describe("empty workspace", () => {
  test("every layout returns no tiles", () => {
    for (const layout of ["tile", "bstack", "monocle", "grid", "ide"] as const) {
      expect(build([], layout)).toEqual([]);
    }
  });
});
