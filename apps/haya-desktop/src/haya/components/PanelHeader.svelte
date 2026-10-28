<script lang="ts">
  import type { Snippet } from "svelte";

  // Title row for a side panel. Same height and type everywhere. Optional actions sit on the right.
  let { title, actions }: { title: string; actions?: Snippet } = $props();
</script>

<div class="haya-panel-header">
  <span>{title}</span>
  {#if actions}<span class="haya-panel-actions">{@render actions()}</span>{/if}
</div>
