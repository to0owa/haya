<script lang="ts">
  import Terminal from "../windows/TerminalWindow.svelte";
  import Table from "../windows/TableWindow.svelte";
  import Connections from "../windows/ConnectionsWindow.svelte";
  import Details from "../windows/DetailsWindow.svelte";
  import { activeWorkspace } from "./model";
  import { close, dragSeam, flipGrid, focus, setRatio, wm, zoomOf } from "./store.svelte";
  import { computeLayout, seamAfterFlip, type Rect, type Seam } from "./layouts";
  import EmptyState from "../components/EmptyState.svelte";

  // Gap between windows and between windows and the stage edge.
  const GAP = 2;

  /**
   * Shrinks a tile by half the gap on each side that faces another tile, so neighbours are GAP apart.
   * A side that lies on the area's edge is not shrunk: the tile meets the stage edge with no gap.
   */
  function inset(rect: Rect, area: Rect): Rect {
    const h = GAP / 2;
    const eps = 0.5;
    const left = rect.x <= area.x + eps ? 0 : h;
    const top = rect.y <= area.y + eps ? 0 : h;
    const right = rect.x + rect.w >= area.x + area.w - eps ? 0 : h;
    const bottom = rect.y + rect.h >= area.y + area.h - eps ? 0 : h;
    // Snap to whole pixels. A fractional edge leaves a half-lit column of the window colour outside the frame.
    const x = Math.round(rect.x + left);
    const y = Math.round(rect.y + top);
    const right2 = Math.round(rect.x + rect.w - right);
    const bottom2 = Math.round(rect.y + rect.h - bottom);
    return { x, y, w: Math.max(0, right2 - x), h: Math.max(0, bottom2 - y) };
  }

  let width = $state(0);
  let height = $state(0);

  const area = $derived<Rect>({ x: 0, y: 0, w: Math.max(0, width), h: Math.max(0, height) });

  // Tiles and dividers come from the same split tree, so every layout resizes the same way.
  const layout = $derived(
    computeLayout({
      workspace: activeWorkspace(wm.config),
      kinds: wm.config.windows,
      rules: wm.config.rules,
      area,
    }),
  );
  const tiles = $derived(layout.tiles);

  // Where each visible window goes. Windows not listed here stay mounted but hidden.
  const placement = $derived.by(() => {
    const map: Record<number, Rect> = {};
    for (const tile of tiles) {
      if (tile.active !== null) map[tile.active] = inset(tile.rect, area);
    }
    return map;
  });

  const windowIds = $derived(Object.keys(wm.config.windows).map(Number));

  // Dividers between tiles. Drag one to resize the split it belongs to. Double-click puts that split back.
  const seams = $derived(layout.seams);
  let areaEl: HTMLDivElement | undefined = $state();
  // Path of the split being dragged, or null. The area holds the pointer capture, not the divider:
  // a divider can disappear mid-drag when a grid turns over, and a capture on a removed element is lost.
  let drag = $state<string | null>(null);
  // A grid divider that spans the grid turns the grid over on the first real move, not on the press,
  // so a plain click or double-click changes nothing.
  let pendingFlip: { seam: Seam; x: number; y: number } | null = null;
  const FLIP_SLOP = 3;

  function startDrag(event: PointerEvent, seam: Seam) {
    if (event.button !== 0 || !areaEl) return;
    event.preventDefault();
    areaEl.setPointerCapture(event.pointerId);
    drag = seam.path;
    pendingFlip = seam.flip ? { seam, x: event.clientX, y: event.clientY } : null;
  }

  function moveDrag(event: PointerEvent) {
    if (drag === null || !areaEl) return;
    const box = areaEl.getBoundingClientRect();
    if (pendingFlip) {
      if (Math.hypot(event.clientX - pendingFlip.x, event.clientY - pendingFlip.y) < FLIP_SLOP) return;
      const { seam: held } = pendingFlip;
      // Where it was grabbed, as a share of the area. A crossing line in parts keeps its part nearest this point.
      const near = { x: (pendingFlip.x - box.left) / Math.max(1, box.width), y: (pendingFlip.y - box.top) / Math.max(1, box.height) };
      pendingFlip = null;
      // Turn the grid over, then carry on with the part of the divider under the pointer. It alone moves from here.
      if (held.flip && flipGrid(held.flip, near)) {
        settle();
        const next = seamAfterFlip(layout.seams, held, { x: event.clientX - box.left, y: event.clientY - box.top });
        if (next) drag = next.path;
      }
    }
    const seam = layout.seams.find((s) => s.path === drag);
    if (!seam) return;
    // The split's own area is what the pointer is measured against, so the ratio is the pointer's share of it.
    const share = seam.axis === "x"
      ? (event.clientX - box.left - seam.origin.x) / seam.size.w
      : (event.clientY - box.top - seam.origin.y) / seam.size.h;
    dragSeam(seam.path, share, { w: Math.max(1, width), h: Math.max(1, height) });
  }

  // Set for a moment after a grid turns over mid-drag, so the windows ease into the new shape instead of jumping.
  let settling = $state(false);
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  function settle() {
    settling = true;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => (settling = false), 320);
  }

  function endDrag(event: PointerEvent) {
    drag = null;
    pendingFlip = null;
    // While the area held the pointer, no divider heard it leave. Work out which one it is over now.
    const box = areaEl?.getBoundingClientRect();
    const x = event.clientX - (box?.left ?? 0);
    const y = event.clientY - (box?.top ?? 0);
    hovered = layout.seams.find((s) => x >= s.rect.x && x <= s.rect.x + s.rect.w && y >= s.rect.y && y <= s.rect.y + s.rect.h)?.path ?? null;
  }

  // The grabber is one element that sits on the divider being held, or else the one under the pointer.
  // It keeps its last place while it fades out, so it shrinks where it was instead of jumping away.
  let hovered = $state<string | null>(null);
  const hot = $derived.by(() => {
    const path = drag ?? hovered;
    return path === null ? null : layout.seams.find((s) => s.path === path) ?? null;
  });
  let grab = $state({ x: 0, y: 0, axis: "x" as "x" | "y" });
  // Where the pointer is inside the area. The grabber slides along its divider to stay under it, like a thumb on a slider.
  let pointer = $state({ x: 0, y: 0 });
  // Length of the grabber along its divider, in px. Matches the CSS, so it can be kept inside the divider's ends.
  const GRAB_LEN = 52;
  const within = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
  function trackPointer(event: PointerEvent) {
    if (!areaEl) return;
    const box = areaEl.getBoundingClientRect();
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  // It glides only when it moves from one divider to another, such as when a grid turns over mid-drag.
  // Otherwise it would trail behind the pointer, or slide in from wherever it last was.
  let gliding = $state(false);
  let lastPath: string | null = null;
  let glideTimer: ReturnType<typeof setTimeout> | undefined;
  // Shown is one frame behind hot when the grabber appears: it first takes the divider's place and direction while
  // still hidden, and only then starts to fill. Doing both at once made it turn from upright to flat as it grew.
  let shown = $state(false);
  let snapping = $state(false);
  let showFrame = 0;
  $effect(() => {
    const seam = hot;
    if (!seam) {
      lastPath = null;
      shown = false;
      snapping = false;
      cancelAnimationFrame(showFrame);
      showFrame = 0;
      return;
    }
    if (!shown && !showFrame) {
      snapping = true;
      showFrame = requestAnimationFrame(() => {
        showFrame = requestAnimationFrame(() => {
          showFrame = 0;
          snapping = false;
          shown = true;
        });
      });
    }
    // Along the divider it follows the pointer, kept clear of the ends. Across it, it sits on the divider itself.
    const half = GRAB_LEN / 2;
    grab = {
      x: seam.axis === "y" ? within(pointer.x, seam.rect.x + half, seam.rect.x + seam.rect.w - half) : seam.rect.x + seam.rect.w / 2,
      y: seam.axis === "x" ? within(pointer.y, seam.rect.y + half, seam.rect.y + seam.rect.h - half) : seam.rect.y + seam.rect.h / 2,
      axis: seam.axis,
    };
    if (lastPath !== null && lastPath !== seam.path) {
      gliding = true;
      clearTimeout(glideTimer);
      glideTimer = setTimeout(() => (gliding = false), 300);
    }
    lastPath = seam.path;
  });

  function resetSplit(path: string) {
    setRatio(path, null);
  }

  // One opacity for every window. 1 is fully opaque.
  const look = $derived(wm.config.glass.window);
  const opacity = $derived(look.opacity);
  const focusedId = $derived(activeWorkspace(wm.config).focus);
  // The active outline only means something when there is more than one visible window to choose between.
  const showFocus = $derived(Object.keys(placement).length > 1);

  // After three seconds on the same window, the focus dot fades to 20%. Each focus change restarts the count.
  let dotFaded = $state(false);
  $effect(() => {
    void focusedId;
    dotFaded = false;
    const timer = setTimeout(() => (dotFaded = true), 3000);
    return () => clearTimeout(timer);
  });

</script>

<div
  class="wm-area"
  bind:this={areaEl}
  bind:clientWidth={width}
  bind:clientHeight={height}
  class:is-dragging={drag !== null}
  class:is-settling={settling}
  onpointermove={(event) => {
    trackPointer(event);
    moveDrag(event);
  }}
  onpointerup={endDrag}
  onpointercancel={endDrag}
  role="presentation"
>
  {#each tiles as tile, index (index)}
  {/each}

  {#each windowIds as id (id)}
    {@const rect = placement[id]}
    {@const kind = wm.config.windows[id]}
    {@const inst = wm.instances[id]}
    <div
      class="wm-window"
      class:is-focused={showFocus && focusedId === id}
      style={rect ? `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;--alpha:${opacity};--blur:${look.blur}px;--glass-highlight:${look.highlight};--glass-sheen-strength:${look.sheen};--glass-saturation:${look.saturation}%` : "display:none"}
      onmousedown={() => focus(id)}
      role="presentation"
    >
      {#if kind === "terminal"}
        <Terminal alpha={opacity} zoom={zoomOf(id, "terminal")} />
      {:else if kind === "table" && inst?.schema && inst?.table}
        <Table schema={inst.schema} table={inst.table} zoom={zoomOf(id, "table")} />
      {:else if kind === "connections"}
        <Connections />
      {:else if kind === "details"}
        <Details />
      {:else}
        <EmptyState text={`${kind} is not built yet.`} />
      {/if}
      <span
        class="wm-focus-dot"
        class:is-active={showFocus && focusedId === id}
        class:is-faded={dotFaded}
        aria-hidden="true"
      ></span>
    </div>
  {/each}

  {#each seams as seam (seam.path)}
    <div
      class="wm-seam is-{seam.axis}"
      style={`left:${seam.rect.x}px;top:${seam.rect.y}px;width:${seam.rect.w}px;height:${seam.rect.h}px`}
      role="separator"
      aria-orientation={seam.axis === "x" ? "vertical" : "horizontal"}
      aria-label="Resize the split between windows"
      onpointerdown={(event) => startDrag(event, seam)}
      onpointerenter={() => (hovered = seam.path)}
      onpointerleave={() => (hovered = hovered === seam.path ? null : hovered)}
      ondblclick={() => resetSplit(seam.path)}
    ></div>
  {/each}

  <div
    class="wm-grabber is-{grab.axis}"
    class:is-on={shown}
    class:is-snapping={snapping}
    class:is-held={drag !== null}
    class:is-gliding={gliding}
    style="--gx:{grab.x}px;--gy:{grab.y}px"
    aria-hidden="true"
  >
    <span></span>
  </div>
</div>
