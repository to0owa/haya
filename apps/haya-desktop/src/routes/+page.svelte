<script lang="ts">
  import { onMount } from "svelte";
  import Tiles from "../haya/wm/Tiles.svelte";
  import Bar from "../haya/wm/Bar.svelte";
  import Toasts from "../haya/Toasts.svelte";
  import { handleKey, snapshot, wm } from "../haya/wm/store.svelte";
  import { loadWorkspaces, scheduleSave } from "../haya/wm/persist";

  let ready = $state(false);

  onMount(async () => {
    await loadWorkspaces();
    ready = true;
  });

  // Save after every change to the layout or the window list, once the saved state is loaded.
  $effect(() => {
    snapshot();
    if (ready) scheduleSave();
  });

  function onKey(event: KeyboardEvent) {
    handleKey(event);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="app">
  <div class="haya-titlebar" data-tauri-drag-region>
    <Bar part="top" />
  </div>

  <div class="haya-main-column">
    <Tiles />
    <Bar part="bottom" />
  </div>

  <Toasts />
</div>

<style>
  :global(body) { overflow: hidden; }
  .haya-main-column { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; margin: 0 8px 8px 8px; }
</style>
