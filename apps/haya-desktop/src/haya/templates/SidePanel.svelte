<script lang="ts">
  import type { Snippet } from "svelte";
  // Explorer (left) or Details (right): borderless, transparent, sits beside the stage.
  let { side, label, children }: { side: "left" | "right"; label: string; children: Snippet } = $props();
</script>

<aside class="haya-side-panel haya-side-{side}" aria-label={label}>{@render children()}</aside>
