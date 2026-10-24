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

  let { schema, table, onselect }: { schema: string; table: string; onselect?: (columns: string[], row: (string | null)[]) => void } = $props();

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

<div class="haya-grid">
  <div class="haya-grid-bar">
    {#if error}<span class="is-error">{error}</span>
    {:else if result}{result.rows.length} rows{result.truncated ? " (capped)" : ""} · {result.elapsed_ms} ms · rows {offset + 1}–{offset + result.rows.length}
      <span class="spacer"></span><button class="haya-button" onclick={() => load(Math.max(0, offset - PAGE))} disabled={offset === 0}>Prev</button>
      <button class="haya-button" onclick={() => load(offset + PAGE)} disabled={result.rows.length < PAGE}>Next</button>
    {:else}Loading…{/if}
  </div>

  {#if result}
    {@const total = GUTTER + widths.reduce((a, b) => a + b, 0)}
    <div class="haya-scroll" bind:clientHeight={viewportH} onscroll={(e) => (scrollTop = (e.currentTarget as HTMLElement).scrollTop)}>
      <div class="haya-inner" style="min-width: {total}px;">
        <div class="haya-head">
          <div class="haya-gutter"></div>
          {#each result.columns as name, c (c)}
            <div class="haya-cell" class:is-fill={c === result.columns.length - 1} style="{c === result.columns.length - 1 ? `min-width: ${widths[c]}px;` : `width: ${widths[c]}px;`}">{name}</div>
          {/each}
        </div>
        <div class="haya-body" style="height: {result.rows.length * ROW_H}px;">
          {#each result.rows.slice(first, last) as row, i (first + i)}
            {@const index = first + i}
            <div
              class="haya-line"
              class:is-alt={index % 2 === 1}
              class:is-selected={selected === index}
              style="top: {index * ROW_H}px; height: {ROW_H}px;"
              onclick={() => {
                selected = index;
                if (result) onselect?.(result.columns, result.rows[index]);
              }}
              role="row"
              tabindex="-1"
            >
              <div class="haya-gutter">{offset + index + 1}</div>
              {#each row as cell, c (c)}
                <div
                  class="haya-cell"
                  class:is-num={numeric[c]}
                  class:is-null={cell === null}
                  class:is-fill={c === row.length - 1}
                  style="{c === row.length - 1 ? `min-width: ${widths[c]}px;` : `width: ${widths[c]}px;`}"
                >{cell ?? "NULL"}</div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>


