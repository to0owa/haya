import { describe, expect, test } from "bun:test";
import { formatKey, keyFromEvent, matches } from "./keys";

const press = (code: string, mods: { meta?: boolean; shift?: boolean; ctrl?: boolean; alt?: boolean } = {}) => ({
  code,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  ctrlKey: !!mods.ctrl,
  altKey: !!mods.alt,
});

describe("key strings", () => {
  test("formats keys the way macOS menus do", () => {
    expect(formatKey("Mod+KeyB")).toBe("⌘B");
    expect(formatKey("Mod+Shift+KeyB")).toBe("⇧⌘B");
    expect(formatKey("Mod+Digit1")).toBe("⌘1");
    expect(formatKey("Mod+Backquote")).toBe("⌘`");
    expect(formatKey("Mod+Shift+Comma")).toBe("⇧⌘,");
    expect(formatKey("Ctrl+Alt+Enter")).toBe("⌃⌥↩");
    expect(formatKey("")).toBe("");
  });

  test("records the modifiers and physical code of a press", () => {
    expect(keyFromEvent(press("KeyT", { meta: true }))).toBe("Mod+KeyT");
    expect(keyFromEvent(press("KeyB", { meta: true, shift: true }))).toBe("Mod+Shift+KeyB");
    expect(keyFromEvent(press("KeyA", { ctrl: true }))).toBe("Ctrl+KeyA");
  });

  test("a modifier pressed alone is not a key", () => {
    expect(keyFromEvent(press("MetaLeft", { meta: true }))).toBeNull();
    expect(keyFromEvent(press("ShiftRight", { shift: true }))).toBeNull();
  });

  test("matches only when every modifier is exactly right", () => {
    expect(matches("Mod+KeyT", press("KeyT", { meta: true }))).toBe(true);
    expect(matches("Mod+KeyT", press("KeyT", { meta: true, shift: true }))).toBe(false);
    expect(matches("Mod+KeyT", press("KeyT", { ctrl: true }))).toBe(false);
    expect(matches("Mod+KeyT", press("KeyT"))).toBe(false);
    expect(matches("Mod+Shift+KeyB", press("KeyB", { meta: true }))).toBe(false);
  });

  test("matches by physical code, so the typed letter does not matter", () => {
    expect(matches("Mod+Equal", press("Equal", { meta: true, shift: true }))).toBe(false);
    expect(matches("Mod+Shift+Equal", press("Equal", { meta: true, shift: true }))).toBe(true);
  });
});
