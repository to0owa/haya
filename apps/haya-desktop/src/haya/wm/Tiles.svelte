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

  /** Shrinks a tile by half the gap on every side. The area is pre-shrunk by half the gap, so neighbours and the stage edge are both GAP apart. */
  function inset(rect: Rect): Rect {
    const h = GAP / 2;
    return { x: rect.x + h, y: rect.y + h, w: Math.max(0, rect.w - GAP), h: Math.max(0, rect.h - GAP) };
  }

  let width = $state(0);
  let height = $state(0);

  const tiles = $derived(
    computeTiles({
      workspace: activeWorkspace(wm.config),
      kinds: wm.config.windows,
      rules: wm.config.rules,
      area: { x: GAP / 2, y: GAP / 2, w: Math.max(0, width - GAP), h: Math.max(0, height - GAP) } satisfies Rect,
    }),
  );

  // Where each visible window goes. Windows not listed here stay mounted but hidden.
  const placement = $derived.by(() => {
    const map: Record<number, Rect> = {};
    for (const tile of tiles) {
      if (tile.active !== null) map[tile.active] = inset(tile.rect);
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
