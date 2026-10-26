import { describe, expect, test } from "bun:test";
import {
  adjustRatio, changeMasterCount, closeWindow, createDefaultConfig, cycleLayout, focusStep,
  moveToWorkspace, normalize, openWindow, promoteToMaster, setActiveWorkspace, WORKSPACE_COUNT,
} from "./model";

describe("createDefaultConfig", () => {
  test("has ten workspaces, active 1, ide layout", () => {
    const config = createDefaultConfig();
    expect(config.workspaces.length).toBe(WORKSPACE_COUNT);
    expect(config.active).toBe(1);
    expect(config.workspaces[0].layout).toBe("ide");
  });
});

describe("openWindow and closeWindow", () => {
  test("openWindow focuses the new window on the active workspace", () => {
    const first = openWindow(createDefaultConfig(), "terminal");
    const second = openWindow(first.config, "table");
    const ws = second.config.workspaces[0];
    expect(ws.windows).toEqual([first.id, second.id]);
    expect(ws.focus).toBe(second.id);
  });

  test("closeWindow removes the window and moves focus to a neighbour", () => {
    const a = openWindow(createDefaultConfig(), "terminal");
    const b = openWindow(a.config, "table");
    const c = openWindow(b.config, "query");
    const closed = closeWindow(c.config, b.id);
    const ws = closed.workspaces[0];
    expect(ws.windows).toEqual([a.id, c.id]);
    expect(closed.windows[b.id]).toBeUndefined();
  });
});

describe("focus and master", () => {
  test("focusStep wraps in both directions", () => {
    let config = createDefaultConfig();
    config = openWindow(config, "terminal").config;
    config = openWindow(config, "table").config;
    expect(focusStep(config, 1).workspaces[0].focus).toBe(1);
    expect(focusStep(focusStep(config, 1), 1).workspaces[0].focus).toBe(2);
    expect(focusStep(config, -1).workspaces[0].focus).toBe(1);
  });

  test("promoteToMaster moves the focused window to the front", () => {
    let config = createDefaultConfig();
    config = openWindow(config, "terminal").config;
    const b = openWindow(config, "table");
    expect(promoteToMaster(b.config).workspaces[0].windows[0]).toBe(b.id);
  });
});

describe("workspaces", () => {
  test("moveToWorkspace sends the focused window and keeps it focused there", () => {
    const a = openWindow(createDefaultConfig(), "terminal");
    const moved = moveToWorkspace(a.config, 3);
    expect(moved.workspaces[0].windows).toEqual([]);
    expect(moved.workspaces[2].windows).toEqual([a.id]);
    expect(moved.workspaces[2].focus).toBe(a.id);
  });

  test("window instances survive switching the active workspace", () => {
    const a = openWindow(createDefaultConfig(), "terminal");
    const switched = setActiveWorkspace(a.config, 2);
    expect(switched.windows[a.id]).toBe("terminal");
    expect(switched.workspaces[0].windows).toEqual([a.id]);
  });

  test("setActiveWorkspace ignores out-of-range ids", () => {
    expect(setActiveWorkspace(createDefaultConfig(), 11).active).toBe(1);
  });
});

describe("layout controls", () => {
  test("cycleLayout goes through every layout and wraps", () => {
    let config = createDefaultConfig();
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      config = cycleLayout(config);
      seen.push(config.workspaces[0].layout);
    }
    expect(seen).toEqual(["tile", "bstack", "monocle", "grid", "ide"]);
  });

  test("adjustRatio is clamped between 0.1 and 0.9", () => {
    let config = createDefaultConfig();
    for (let i = 0; i < 20; i++) config = adjustRatio(config, 0.05);
    expect(config.workspaces[0].masterRatio).toBe(0.9);
  });

  test("changeMasterCount never goes below one", () => {
    expect(changeMasterCount(createDefaultConfig(), -3).workspaces[0].masterCount).toBe(1);
  });
});

describe("normalize", () => {
  test("returns defaults for garbage input", () => {
    expect(normalize(null)).toEqual(createDefaultConfig());
    expect(normalize({ version: 2 })).toEqual(createDefaultConfig());
  });

  test("drops unknown window kinds and dangling window ids", () => {
    const raw = {
      version: 1,
      active: 2,
      nextWindowId: 3,
      windows: { "1": "terminal", "2": "not-a-kind" },
      workspaces: [{ id: 1, windows: [1, 2, 99], focus: 99, layout: "bogus", masterCount: 0, masterRatio: 5 }],
      rules: {},
    };
    const config = normalize(raw);
    expect(config.windows).toEqual({ 1: "terminal" });
    const ws = config.workspaces[0];
    expect(ws.windows).toEqual([1]);
    expect(ws.focus).toBe(1);
    expect(ws.layout).toBe("ide");
    expect(ws.masterCount).toBe(1);
    expect(ws.masterRatio).toBe(0.9);
    expect(config.active).toBe(2);
  });

  test("keeps nextWindowId above every existing window id", () => {
    const config = normalize({
      version: 1, active: 1, nextWindowId: 1, windows: { "7": "chats" }, workspaces: [], rules: {},
    });
    expect(config.nextWindowId).toBeGreaterThan(7);
  });
});

describe("widget settings", () => {
  test("keeps string settings and drops anything else", () => {
    const config = normalize({
      version: 1,
      workspaces: [],
      widgetSettings: { workspaces: { mode: "active", bad: 3 }, status: "nope" },
    });
    expect(config.widgetSettings).toEqual({ workspaces: { mode: "active" } });
  });

  test("defaults to no settings", () => {
    expect(createDefaultConfig().widgetSettings).toEqual({});
  });

  test("keeps only string widget ids in hiddenWidgets", () => {
    const config = normalize({ version: 1, workspaces: [], hiddenWidgets: ["status", 3, "theme"] });
    expect(config.hiddenWidgets).toEqual(["status", "theme"]);
  });
});

describe("toolbar layout", () => {
  test("keeps string widget ids per bar and drops anything else", () => {
    const config = normalize({ version: 1, workspaces: [], barLayout: { top: ["tabs", 2, "spacer"], left: "nope" } });
    expect(config.barLayout).toEqual({ top: ["tabs", "spacer"] });
  });

  test("defaults to no custom layout", () => {
    expect(createDefaultConfig().barLayout).toEqual({});
  });
});
