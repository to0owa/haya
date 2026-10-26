<script lang="ts">
  import Terminal from "../windows/TerminalWindow.svelte";
  import Table from "../windows/TableWindow.svelte";
  import Connections from "../windows/ConnectionsWindow.svelte";
  import Details from "../windows/DetailsWindow.svelte";
  import { activeWorkspace } from "./model";
  import { close, focus, wm } from "./store.svelte";
  import { computeTiles, type Rect } from "./layouts";

  const TAB_H = 30;
  const GAP = 8;

  /** Shrinks a tile by half the gap on every side, so neighbours are GAP apart and the edges GAP/2 from the frame. */
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
      area: { x: 0, y: 0, w: Math.max(0, width), h: Math.max(0, height) } satisfies Rect,
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

  function label(id: number): string {
    return wm.instances[id]?.title ?? "Window";
  }
</script>

<div class="wm-area" bind:clientWidth={width} bind:clientHeight={height}>
  {#each tiles as tile, index (index)}
    {@const box = inset(tile.rect)}
    <div class="wm-tabs" style="left:{box.x}px;top:{box.y}px;width:{box.w}px;height:{TAB_H}px" role="tablist">
      {#each tile.windows as id (id)}
        <button class="wm-tab" class:is-active={tile.active === id} role="tab" aria-selected={tile.active === id} onclick={() => focus(id)}>
          {label(id)}
          <span class="wm-tab-close" role="button" tabindex="-1" onclick={(e) => { e.stopPropagation(); close(id); }}>×</span>
        </button>
      {/each}
    </div>
  {/each}

  {#each windowIds as id (id)}
    {@const rect = placement[id]}
    {@const kind = wm.config.windows[id]}
    {@const inst = wm.instances[id]}
    <div
      class="wm-window"
      class:is-focused={focusedId === id}
      style={rect ? `left:${rect.x}px;top:${rect.y + TAB_H}px;width:${rect.w}px;height:${Math.max(0, rect.h - TAB_H)}px` : "display:none"}
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
        <div class="wm-placeholder">{kind} — coming soon</div>
      {/if}
    </div>
  {/each}
</div>
