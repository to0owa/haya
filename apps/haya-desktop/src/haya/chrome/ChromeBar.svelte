<script lang="ts">
  import type { Snippet } from "svelte";

  // One component for every toolbar band. Size, padding, and spacing come from the chrome tokens in haya.css.
  let {
    edge,
    label,
    children,
  }: { edge: "top" | "bottom" | "left" | "right"; label: string; children: Snippet } = $props();
</script>

<div class="haya-chrome haya-chrome-{edge}" role="toolbar" aria-label={label} data-tauri-drag-region={edge === "top" ? "" : undefined}>
  {@render children()}
</div>
