<script lang="ts">
  import { DEFAULT_BARS, WIDGETS, type BarPosition } from "./bar/registry";

  let { part }: { part: BarPosition } = $props();

  const widgets = $derived(DEFAULT_BARS[part]);
</script>

{#if part === "top"}
  <div class="haya-bar haya-bar-top" role="toolbar" aria-label="Workspaces and layout" data-tauri-drag-region>
    {#each widgets as id (id)}
      {@const Widget = WIDGETS[id]}
      <Widget />
    {/each}
  </div>
{:else}
  <div class="haya-bar haya-bar-bottom" aria-label="Status">
    {#each widgets as id (id)}
      {@const Widget = WIDGETS[id]}
      <Widget />
    {/each}
  </div>
{/if}
