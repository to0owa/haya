<script lang="ts">
  import type { Snippet } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import TrafficLightArea from "./TrafficLightArea.svelte";
  import { activeWorkspace } from "../wm/model";
  import { wm } from "../wm/store.svelte";
  import { wallpaperUrl } from "../wm/wallpaper.svelte";
  // The whole-window wallpaper sits under every band; bands turn translucent so it shows through.
  const appUrl = $derived(wm.config.wallpaperWholeApp ? wallpaperUrl(activeWorkspace(wm.config).wallpaper) : null);

  // The window frame: titlebar on top, body (edges, panels, stage) in the middle, status bar at the bottom.
  let { titlebar, leftEdge, leftPanel, stage, rightPanel, rightEdge, bottom }: {
    titlebar: Snippet; leftEdge: Snippet; leftPanel?: Snippet; stage: Snippet; rightPanel?: Snippet; rightEdge: Snippet; bottom: Snippet;
  } = $props();

  // Drag from any titlebar spot that is not a control. Double-click toggles maximize.
  function onTitlebarDown(event: MouseEvent) {
    // Buttons and tabs handle their own clicks. Everything else in the titlebar drags the window.
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, [role='tab']")) return;
    if (event.detail === 2) getCurrentWindow().toggleMaximize();
    else getCurrentWindow().startDragging();
  }
</script>

<div class="app" class:has-app-wallpaper={appUrl !== null} style={appUrl ? `--wp-url:url("${appUrl}");--wp-blur:${wm.config.wallpaperBlur}px` : undefined}>
  <div class="haya-titlebar" onmousedown={onTitlebarDown} role="presentation">
    <TrafficLightArea />
    {@render titlebar()}
  </div>
  <div class="haya-body">
    {@render leftEdge()}
    {#if leftPanel}{@render leftPanel()}{/if}
    {@render stage()}
    {#if rightPanel}{@render rightPanel()}{/if}
    {@render rightEdge()}
  </div>
  {@render bottom()}
</div>
