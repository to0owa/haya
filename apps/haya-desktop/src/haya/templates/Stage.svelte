<script lang="ts">
  import type { Snippet } from "svelte";
  import { activeWorkspace } from "../wm/model";
  import { wm } from "../wm/store.svelte";
  import { wallpaperUrl } from "../wm/wallpaper.svelte";

  // Rounded inset panel that holds the workspace tiles. The active workspace's wallpaper sits behind them.
  let { children }: { children: Snippet } = $props();

  // When the wallpaper covers the whole window, the app shell paints it and the stage stays clear.
  const url = $derived(wm.config.wallpaperWholeApp ? null : wallpaperUrl(activeWorkspace(wm.config).wallpaper));
</script>

<div class="haya-stage" class:has-wallpaper={url !== null} style={url ? `background-image:url("${url}")` : undefined}>
  {@render children()}
</div>
