<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  type Query = {
    columns: string[];
    rows: (string | null)[][];
    truncated: boolean;
    rows_affected: number | null;
    elapsed_ms: number;
  };

  let { schema, table }: { schema: string; table: string } = $props();

  const PAGE = 200;
  const ROW_H = 26;
  const HEADER_H = 28;
  const GUTTER = 56;
  const CHAR_W = 7.4;

  let result = $state<Query | null>(null);
  let error = $state<string | null>(null);
  let selected = $state<number | null>(null);
  let scrollTop = $state(0);
  let viewportH = $state(400);
  let offset = $state(0);

  let widths = $derived(result ? result.columns.map((name, c) => {
    const widest = result!.rows.slice(0, 200).reduce((m, row) => Math.max(m, (row[c] ?? "").length), 0);
    return Math.min(360, Math.max(80, Math.max(name.length, widest) * CHAR_W + 24));
  }) : []);

  let numeric = $derived(result ? result.columns.map((_, c) => {
    let seen = false;
    for (const row of result!.rows.slice(0, 200)) {
      const cell = row[c];
      if (cell === null) continue;
      seen = true;
      if (Number.isNaN(Number(cell))) return false;
    }
    return seen;
  }) : []);

  let first = $derived(Math.max(0, Math.floor(scrollTop / ROW_H) - 5));
  let last = $derived(result ? Math.min(result.rows.length, first + Math.ceil(viewportH / ROW_H) + 10) : 0);

  async function load(nextOffset: number) {
    error = null;
    selected = null;
    try {
      result = await invoke<Query>("db_page", { schema, table, offset: nextOffset, limit: PAGE });
      offset = nextOffset;
    } catch (e) {
      error = String(e);
    }
  }

  onMount(() => load(0));
</script>

<div class="wrap">
  <div class="status">
    {#if error}<span class="err">{error}</span>
    {:else if result}{result.rows.length} rows{result.truncated ? " (capped)" : ""} · {result.elapsed_ms} ms · rows {offset + 1}–{offset + result.rows.length}
      <button onclick={() => load(Math.max(0, offset - PAGE))} disabled={offset === 0}>Prev</button>
      <button onclick={() => load(offset + PAGE)} disabled={result.rows.length < PAGE}>Next</button>
    {:else}Loading…{/if}
  </div>

  {#if result}
    {@const total = GUTTER + widths.reduce((a, b) => a + b, 0)}
    <div class="scroll" bind:clientHeight={viewportH} onscroll={(e) => (scrollTop = (e.currentTarget as HTMLElement).scrollTop)}>
      <div class="inner" style="min-width: {total}px;">
        <div class="head" style="height: {HEADER_H}px;">
          <div class="gutter"></div>
          {#each result.columns as name, c (c)}
            <div class="cell" style="width: {widths[c]}px;">{name}</div>
          {/each}
        </div>
        <div class="body" style="height: {result.rows.length * ROW_H}px;">
          {#each result.rows.slice(first, last) as row, i (first + i)}
            {@const index = first + i}
            <div
              class="line"
              class:alt={index % 2 === 1}
              class:sel={selected === index}
              style="top: {index * ROW_H}px; height: {ROW_H}px;"
              onclick={() => (selected = index)}
              role="row"
              tabindex="-1"
            >
              <div class="gutter num">{offset + index + 1}</div>
              {#each row as cell, c (c)}
                <div
                  class="cell"
                  class:num={numeric[c]}
                  class:null={cell === null}
                  style="width: {widths[c]}px;"
                >{cell ?? "NULL"}</div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #1c1c1e; font-size: 12px; }
  .status { padding: 6px 12px; color: #8e8e93; font-size: 11px; border-bottom: 1px solid #2e2e33; display: flex; gap: 8px; align-items: center; }
  .status button { background: none; border: 1px solid #333338; color: #d4d4d4; border-radius: 4px; padding: 2px 8px; font: inherit; cursor: pointer; }
  .status button:disabled { opacity: 0.4; cursor: default; }
  .err { color: #ff6b6b; }
  .scroll { flex: 1; min-height: 0; overflow: auto; }
  .inner { position: relative; height: 100%; }
  .head, .line { display: flex; font-family: Menlo, monospace; }
  .head { position: sticky; top: 0; z-index: 1; background: #26262a; border-bottom: 1px solid #333338; color: #8e8e93; font-family: inherit; }
  .body { position: relative; }
  .line { position: absolute; left: 0; right: 0; align-items: center; color: #d4d4d4; background: #1c1c1e; }
  .line.alt { background: #202024; }
  .line.sel { background: #2a5bd7; color: #fff; }
  .gutter { width: 56px; flex-shrink: 0; padding: 0 8px; text-align: right; color: #6e6e76; border-right: 1px solid #333338; box-sizing: border-box; display: flex; align-items: center; justify-content: flex-end; }
  .head .gutter { justify-content: flex-start; }
  .cell { padding: 0 8px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid #333338; box-sizing: border-box; height: 100%; display: flex; align-items: center; }
  .cell.num { justify-content: flex-end; }
  .cell.null { color: #6e6e76; }
  .line.sel .cell.null { color: #dfe7ff; }
</style>
