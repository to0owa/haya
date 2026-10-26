<script lang="ts">
  import type { Snippet } from "svelte";

  // A toolbar control. Icon-only buttons use the same box as the bar controls.
  let {
    label,
    active = false,
    disabled = false,
    onclick,
    children,
  }: { label: string; active?: boolean; disabled?: boolean; onclick?: () => void; children: Snippet } = $props();
</script>

<button class="haya-chrome-btn" class:is-on={active} aria-label={label} aria-pressed={active} title={label} {disabled} {onclick}>
  {@render children()}
</button>
