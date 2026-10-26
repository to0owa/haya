// Limits how many terminals hold a WebGL renderer at once. Browsers cap live WebGL contexts,
// so the terminals the user can see get WebGL and the rest fall back to the DOM renderer.
// The least recently shown terminal gives up its renderer first.

export interface Renderer {
  activate(): void;
  deactivate(): void;
}

export const MAX_LIVE_RENDERERS = 6;

let live: Renderer[] = [];

/** Marks a renderer as visible. Activating twice is harmless. */
export function showRenderer(renderer: Renderer, max = MAX_LIVE_RENDERERS) {
  live = live.filter((r) => r !== renderer);
  while (live.length >= max) live.shift()?.deactivate();
  live.push(renderer);
  renderer.activate();
}

/** Marks a renderer as hidden and releases its WebGL context. */
export function hideRenderer(renderer: Renderer) {
  if (!live.includes(renderer)) return;
  live = live.filter((r) => r !== renderer);
  renderer.deactivate();
}

/** Test helper: forget every renderer. */
export function resetRenderers() {
  live = [];
}
