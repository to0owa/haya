<script lang="ts">
  import Terminal from "../Terminal.svelte";

  // alpha comes from the global window opacity. zoom is this window's font size. Both must reach the terminal.
  let { alpha = 1, zoom = 13 }: { alpha?: number; zoom?: number } = $props();
</script>

<Terminal {alpha} {zoom} />
