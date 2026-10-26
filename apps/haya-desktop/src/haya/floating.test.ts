import { describe, expect, test } from "bun:test";
import { placeInside } from "./floating";

const WINDOW = { w: 800, h: 600 };

describe("placeInside", () => {
  test("opens below and right of the anchor when there is room", () => {
    expect(placeInside({ x: 100, y: 100 }, { w: 50, h: 40 }, WINDOW)).toEqual({ x: 100, y: 100 });
  });

  test("flips to the left and up at the bottom-right corner", () => {
    expect(placeInside({ x: 790, y: 590 }, { w: 100, h: 80 }, WINDOW)).toEqual({ x: 690, y: 510 });
  });

  test("keeps a margin from the window edge", () => {
    expect(placeInside({ x: 0, y: 0 }, { w: 50, h: 40 }, WINDOW)).toEqual({ x: 4, y: 4 });
  });

  test("never goes past the window when the box is larger than the window", () => {
    expect(placeInside({ x: 10, y: 10 }, { w: 900, h: 700 }, WINDOW)).toEqual({ x: 4, y: 4 });
  });
});
