<script lang="ts">
  import Terminal from "../windows/TerminalWindow.svelte";
  import Table from "../windows/TableWindow.svelte";
  import Connections from "../windows/ConnectionsWindow.svelte";
  import Details from "../windows/DetailsWindow.svelte";
  import { activeWorkspace } from "./model";
  import { close, focus, wm } from "./store.svelte";
  import { computeTiles, type Rect } from "./layouts";
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

  const tiles = $derived(
    computeTiles({
      workspace: activeWorkspace(wm.config),
      kinds: wm.config.windows,
      rules: wm.config.rules,
      area,
    }),
  );

  // Where each visible window goes. Windows not listed here stay mounted but hidden.
  const placement = $derived.by(() => {
    const map: Record<number, Rect> = {};
    for (const tile of tiles) {
      if (tile.active !== null) map[tile.active] = inset(tile.rect, area);
    }
    return map;
  });

  const windowIds = $derived(Object.keys(wm.config.windows).map(Number));
  const focusedId = $derived(activeWorkspace(wm.config).focus);
  // The active outline only means something when there is more than one visible window to choose between.
  const showFocus = $derived(Object.keys(placement).length > 1);

</script>

<div class="wm-area" bind:clientWidth={width} bind:clientHeight={height}>
  {#each tiles as tile, index (index)}
  {/each}

  {#each windowIds as id (id)}
    {@const rect = placement[id]}
    {@const kind = wm.config.windows[id]}
    {@const inst = wm.instances[id]}
    <div
      class="wm-window"
      class:is-focused={showFocus && focusedId === id}
      style={rect ? `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px` : "display:none"}
      onmousedown={() => focus(id)}
      role="presentation"
    >
      {#if kind === "terminal"}
        <Terminal />
      {:else if kind === "table" && inst?.schema && inst?.table}
        <Table schema={inst.schema} table={inst.table} />
      {:else if kind === "connections"}
        <Connections />
      {:else if kind === "details"}
        <Details />
      {:else}
        <EmptyState text={`${kind} is not built yet.`} />
      {/if}
    </div>
  {/each}
</div>
