<script lang="ts">
  import Tiles from "../haya/wm/Tiles.svelte";
  import Toasts from "../haya/Toasts.svelte";
  import { activeWorkspace, LAYOUT_NAMES } from "../haya/wm/model";
  import { handleKey, open, wm } from "../haya/wm/store.svelte";

  const current = $derived(activeWorkspace(wm.config));

  function onKey(event: KeyboardEvent) {
    handleKey(event);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="app">
  <div class="haya-titlebar" data-tauri-drag-region></div>

  <div class="haya-main-column">
    <section class="surface-head haya-toolbar">
      <div class="surface-heading">
        <div class="surface-title">Workspace {current.name}</div>
        <span class="surface-state">· {current.layout}</span>
      </div>
      <div class="surface-tools chrome-controls" aria-label="Windows">
        <button class="haya-button" title="New terminal (⌘T)" onclick={() => open("terminal")}>+ Terminal</button>
        <button class="haya-button" title="Connections" onclick={() => open("connections")}>Connections</button>
      </div>
    </section>

    <Tiles />
  </div>

  <Toasts />
</div>

<style>
  :global(body) { overflow: hidden; }
  .haya-main-column { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; margin: 0 8px 8px 8px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); overflow: hidden; }
  .haya-toolbar { flex-shrink: 0; min-height: var(--control-size); padding: 0 var(--space-3); border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: var(--space-2); }
  .haya-toolbar .surface-tools { display: flex; gap: var(--space-1); margin-left: auto; }
</style>
