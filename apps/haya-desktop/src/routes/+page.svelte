<script lang="ts">
  import { onMount } from "svelte";
  import Tiles from "../haya/wm/Tiles.svelte";
  import Bar from "../haya/wm/Bar.svelte";
  import Toasts from "../haya/Toasts.svelte";
  import { handleKey, snapshot, wm } from "../haya/wm/store.svelte";
  import { loadWorkspaces, scheduleSave } from "../haya/wm/persist";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  // Drag the window from any titlebar spot that is not a button. Double-click toggles maximize.
  function onTitlebarDown(event: MouseEvent) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    if (event.detail === 2) {
      getCurrentWindow().toggleMaximize();
    } else {
      getCurrentWindow().startDragging();
    }
  }

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
  <div class="haya-titlebar" onmousedown={onTitlebarDown} role="presentation">
    <Bar part="top" />
  </div>

  <div class="haya-body">
    <!-- Side edges sit outside the stage, in the frame's gutter. Future left and right toolbars go here. -->
    <div class="haya-edge haya-edge-left" aria-label="Left toolbar"></div>

    <div class="haya-stage">
      <Tiles />
      <Bar part="bottom" />
    </div>

    <div class="haya-edge haya-edge-right" aria-label="Right toolbar"></div>
  </div>

  <Toasts />
</div>

<style>
  :global(body) { overflow: hidden; }
  .haya-body { flex: 1; min-width: 0; min-height: 0; display: flex; padding: 0 8px 8px 0; box-sizing: border-box; }
</style>
