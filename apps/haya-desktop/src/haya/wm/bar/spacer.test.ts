import { describe, expect, test } from "bun:test";
import { isSpacerId, parseSpacer, spacerId } from "./spacer";

describe("spacer ids", () => {
  test("plain spacer fills the free space", () => {
    expect(parseSpacer("spacer")).toEqual({ px: null });
    expect(spacerId(null)).toBe("spacer");
  });

  test("a sized spacer carries its px in the id", () => {
    expect(parseSpacer("spacer:120")).toEqual({ px: 120 });
    expect(spacerId(120)).toBe("spacer:120");
  });

  test("bad sizes fall back to fill", () => {
    expect(parseSpacer("spacer:0")).toEqual({ px: null });
    expect(parseSpacer("spacer:abc")).toEqual({ px: null });
  });

  test("other ids are not spacers", () => {
    expect(isSpacerId("tabs")).toBe(false);
    expect(parseSpacer("tabs")).toBeNull();
  });
});
