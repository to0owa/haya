import { describe, expect, test } from "bun:test";
import { isIdle, isSafeProjectId, parseProject } from "./projects";

describe("parseProject", () => {
  test("repairs a hand-edited project file and keeps only valid fields", () => {
    const project = parseProject(JSON.stringify({
      version: 1,
      meta: { id: "office-a", name: "  Office A  ", group: 7, folder: "/work", lastSeen: "x" },
      config: { version: 1, workspaces: [] },
    }));
    expect(project?.meta.name).toBe("Office A");
    expect(project?.meta.group).toBe("");
    expect(project?.meta.folder).toBe("/work");
    expect(project?.meta.lastSeen).toBe(0);
    expect(project?.config.workspaces.length).toBe(10);
  });

  test("returns null for garbage and wrong versions", () => {
    expect(parseProject("not json")).toBeNull();
    expect(parseProject(JSON.stringify({ version: 2, meta: { id: "x" } }))).toBeNull();
  });
});

describe("isSafeProjectId", () => {
  test("accepts slugs and rejects paths", () => {
    expect(isSafeProjectId("office-a")).toBe(true);
    expect(isSafeProjectId("../etc")).toBe(false);
    expect(isSafeProjectId("Office A")).toBe(false);
  });
});

describe("isIdle", () => {
  const meta = { id: "a", name: "a", group: "", folder: null, profile: null, lastSeen: 1_000_000 };
  test("counts from last seen and respects the setting", () => {
    expect(isIdle(meta, 1_000_000 + 59 * 60_000, 60)).toBe(false);
    expect(isIdle(meta, 1_000_000 + 60 * 60_000, 60)).toBe(true);
  });
  test("never reminds when the setting is 0", () => {
    expect(isIdle(meta, 1_000_000 + 999 * 60_000, 0)).toBe(false);
  });
});
