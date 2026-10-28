import { describe, expect, test } from "bun:test";
import { toNumbering, workspaceLabel } from "./numbering";

describe("workspaceLabel", () => {
  test("arabic keeps the shortcut digit, with 10 shown as 0", () => {
    expect(workspaceLabel(1, "arabic", "")).toBe("1");
    expect(workspaceLabel(10, "arabic", "")).toBe("0");
  });

  test("kanji maps 1 to 10", () => {
    expect(workspaceLabel(1, "kanji", "")).toBe("一");
    expect(workspaceLabel(10, "kanji", "")).toBe("十");
  });

  test("aksara uses Javanese digits, and 10 is two digits", () => {
    expect(workspaceLabel(1, "aksara", "")).toBe("꧑");
    expect(workspaceLabel(10, "aksara", "")).toBe("꧑꧐");
  });

  test("custom shows the name, or the number when the name is empty", () => {
    expect(workspaceLabel(2, "custom", "  dev  ")).toBe("dev");
    expect(workspaceLabel(2, "custom", "   ")).toBe("2");
  });

  test("unknown values fall back to arabic", () => {
    expect(toNumbering("roman")).toBe("arabic");
    expect(toNumbering("kanji")).toBe("kanji");
  });
});
