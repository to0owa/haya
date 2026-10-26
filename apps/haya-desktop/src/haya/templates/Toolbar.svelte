<script lang="ts">
  import type { Snippet } from "svelte";
  import Spacer from "../components/Spacer.svelte";

  // One component for every toolbar band. Size, padding, and spacing come from the chrome tokens in haya.css.
  let {
    edge,
    label,
    children,
  }: { edge: "top" | "bottom" | "left" | "right"; label: string; children: Snippet } = $props();
</script>

<div class="haya-chrome haya-chrome-{edge}" role="toolbar" aria-label={label} data-part={edge} data-tauri-drag-region={edge === "top" ? "" : undefined}>
  {#if edge === "left" || edge === "right"}<Spacer axis="y" />{/if}
  {@render children()}
  {#if edge === "left" || edge === "right"}<Spacer axis="y" />{/if}
</div>
