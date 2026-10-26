import { beforeEach, describe, expect, test } from "bun:test";
import { hideRenderer, resetRenderers, showRenderer, type Renderer } from "./terminal-pool";

function fake(log: string[], name: string): Renderer {
  return {
    activate: () => log.push(`+${name}`),
    deactivate: () => log.push(`-${name}`),
  };
}

describe("terminal renderer pool", () => {
  beforeEach(() => resetRenderers());

  test("evicts the least recently shown renderer when the limit is reached", () => {
    const log: string[] = [];
    const renderers = ["a", "b", "c"].map((name) => fake(log, name));
    for (const r of renderers) showRenderer(r, 2);
    expect(log).toEqual(["+a", "+b", "-a", "+c"]);
  });

  test("showing a renderer again makes it the most recent", () => {
    const log: string[] = [];
    const [a, b, c] = ["a", "b", "c"].map((name) => fake(log, name));
    showRenderer(a, 2);
    showRenderer(b, 2);
    showRenderer(a, 2);
    showRenderer(c, 2);
    expect(log).toEqual(["+a", "+b", "+a", "-b", "+c"]);
  });

  test("hiding releases the renderer and frees a slot", () => {
    const log: string[] = [];
    const [a, b, c] = ["a", "b", "c"].map((name) => fake(log, name));
    showRenderer(a, 2);
    showRenderer(b, 2);
    hideRenderer(a);
    showRenderer(c, 2);
    expect(log).toEqual(["+a", "+b", "-a", "+c"]);
  });

  test("hiding a renderer that is not live does nothing", () => {
    const log: string[] = [];
    hideRenderer(fake(log, "x"));
    expect(log).toEqual([]);
  });
});
