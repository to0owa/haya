<script lang="ts">
  import { onMount } from "svelte";
  import Tiles from "../haya/wm/Tiles.svelte";
  import Bar from "../haya/wm/Bar.svelte";
  import Toasts from "../haya/Toasts.svelte";
  import { handleKey, snapshot, toggleExplorer, toggleRight, wm } from "../haya/wm/store.svelte";
  import Explorer from "../haya/Explorer.svelte";
  import Details from "../haya/windows/DetailsWindow.svelte";
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
    <nav class="haya-edge haya-edge-left" aria-label="Left toolbar">
      <button class="chrome-control" class:is-on={wm.explorerOpen} aria-label="Explorer" aria-pressed={wm.explorerOpen} title="Explorer (⌘B)" onclick={toggleExplorer}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
      </button>
    </nav>

    {#if wm.explorerOpen}
      <Explorer />
    {/if}

    <div class="haya-stage">
      <Tiles />
    </div>

    <nav class="haya-edge haya-edge-right" aria-label="Right toolbar">
      <button class="chrome-control" class:is-on={wm.rightOpen} aria-label="Details" aria-pressed={wm.rightOpen} title="Details (⇧⌘B)" onclick={toggleRight}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>
      </button>
    </nav>

    {#if wm.rightOpen}
      <aside class="haya-right" aria-label="Details panel">
        <Details />
      </aside>
    {/if}
  </div>

  <!-- Status bar lives in the frame, below the stage, not inside it. -->
  <Bar part="bottom" />

  <Toasts />
</div>

<style>
  :global(body) { overflow: hidden; }
  .haya-body { flex: 1; min-width: 0; min-height: 0; display: flex; padding: 0 8px 0 0; box-sizing: border-box; }
  /* Side toolbars share the chrome thickness: 32px, the same as the titlebar and status bar. */
  .haya-edge-left { display: flex; flex-direction: column; align-items: center; }

  .haya-edge-right { display: flex; flex-direction: column; align-items: center; }
  .is-on { background: var(--selected); color: var(--text); }
</style>
