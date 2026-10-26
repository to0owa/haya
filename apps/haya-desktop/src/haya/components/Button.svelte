<script lang="ts">
  import type { Snippet } from "svelte";

  // The only button in the app. Variants: icon (toolbar glyph), text (action), chip (workspace number).
  let {
    variant = "text",
    label,
    active = false,
    disabled = false,
    onclick,
    children,
  }: {
    variant?: "icon" | "text" | "chip";
    label: string;
    active?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  } = $props();
</script>

<button class="haya-btn haya-btn-{variant}" class:is-on={active} aria-label={label} aria-pressed={variant === "icon" ? active : undefined} title={label} {disabled} {onclick}>
  {@render children()}
</button>
