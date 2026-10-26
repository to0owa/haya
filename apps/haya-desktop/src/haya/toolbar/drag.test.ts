import { describe, expect, test } from "bun:test";
import { findDropTarget, indicatorRect, moveWidget, type BoxedSlot, type ToolbarBox } from "./drag";

const bar: ToolbarBox = { part: "top", rect: { left: 0, top: 0, right: 300, bottom: 30 } };

// Three items, 100px wide each, left to right.
const slots: BoxedSlot[] = [0, 1, 2].map((index) => ({
  part: "top",
  index,
  rect: { left: index * 100, top: 0, right: index * 100 + 100, bottom: 30 },
}));

describe("findDropTarget", () => {
  test("inserts before the item whose middle is past the pointer", () => {
    expect(findDropTarget(20, 15, [bar], slots)).toEqual({ part: "top", index: 0 });
    expect(findDropTarget(130, 15, [bar], slots)).toEqual({ part: "top", index: 1 });
  });

  test("appends after the last item when the pointer is past every middle", () => {
    expect(findDropTarget(290, 15, [bar], slots)).toEqual({ part: "top", index: 3 });
  });

  test("returns null outside every toolbar", () => {
    expect(findDropTarget(20, 500, [bar], slots)).toBeNull();
  });

  test("uses the vertical axis for side toolbars", () => {
    const left: ToolbarBox = { part: "left", rect: { left: 0, top: 0, right: 40, bottom: 300 } };
    const items: BoxedSlot[] = [0, 1].map((index) => ({
      part: "left",
      index,
      rect: { left: 0, top: index * 100, right: 40, bottom: index * 100 + 100 },
    }));
    expect(findDropTarget(20, 120, [left], items)).toEqual({ part: "left", index: 1 });
  });
});

describe("moveWidget", () => {
  test("moves an item forward within one bar", () => {
    const layouts = { top: ["a", "b", "c"] };
    expect(moveWidget(layouts, { part: "top", index: 0 }, { part: "top", index: 3 }).top).toEqual(["b", "c", "a"]);
  });

  test("moves an item backward within one bar", () => {
    const layouts = { top: ["a", "b", "c"] };
    expect(moveWidget(layouts, { part: "top", index: 2 }, { part: "top", index: 0 }).top).toEqual(["c", "a", "b"]);
  });

  test("moves an item to another bar", () => {
    const layouts = { top: ["a", "b"], left: ["x"] };
    const next = moveWidget(layouts, { part: "top", index: 1 }, { part: "left", index: 0 });
    expect(next).toEqual({ top: ["a"], left: ["b", "x"] });
  });

  test("dropping an item where it already is changes nothing", () => {
    const layouts = { top: ["a", "b"] };
    expect(moveWidget(layouts, { part: "top", index: 1 }, { part: "top", index: 1 }).top).toEqual(["a", "b"]);
    expect(moveWidget(layouts, { part: "top", index: 1 }, { part: "top", index: 2 }).top).toEqual(["a", "b"]);
  });
});

describe("indicatorRect", () => {
  test("draws the line in front of the slot it would take", () => {
    const rect = indicatorRect({ part: "top", index: 1 }, [bar], slots);
    expect(rect?.left).toBeCloseTo(99, 0);
    expect(rect?.right).toBeCloseTo(101, 0);
  });

  test("draws the line after the last slot when dropping at the end", () => {
    const rect = indicatorRect({ part: "top", index: 3 }, [bar], slots);
    expect(rect?.left).toBeCloseTo(299, 0);
  });

  test("returns null for a toolbar that is not on screen", () => {
    expect(indicatorRect({ part: "left", index: 0 }, [bar], slots)).toBeNull();
  });
});
