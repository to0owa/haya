<script lang="ts">
  import type { Snippet } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  // The window frame: titlebar on top, body (edges, panels, stage) in the middle, status bar at the bottom.
  let { titlebar, leftEdge, leftPanel, stage, rightPanel, rightEdge, bottom }: {
    titlebar: Snippet; leftEdge: Snippet; leftPanel?: Snippet; stage: Snippet; rightPanel?: Snippet; rightEdge: Snippet; bottom: Snippet;
  } = $props();

  // Drag from any titlebar spot that is not a control. Double-click toggles maximize.
  function onTitlebarDown(event: MouseEvent) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    if (event.detail === 2) getCurrentWindow().toggleMaximize();
    else getCurrentWindow().startDragging();
  }
</script>

<div class="app">
  <div class="haya-titlebar" onmousedown={onTitlebarDown} role="presentation">{@render titlebar()}</div>
  <div class="haya-body">
    {@render leftEdge()}
    {#if leftPanel}{@render leftPanel()}{/if}
    {@render stage()}
    {#if rightPanel}{@render rightPanel()}{/if}
    {@render rightEdge()}
  </div>
  {@render bottom()}
</div>
