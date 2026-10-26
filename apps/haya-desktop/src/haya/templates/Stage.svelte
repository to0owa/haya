<script lang="ts">
  import type { Snippet } from "svelte";
  // Rounded inset panel that holds the workspace tiles.
  let { children }: { children: Snippet } = $props();
</script>

<div class="haya-stage">{@render children()}</div>
