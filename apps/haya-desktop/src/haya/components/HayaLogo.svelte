<script lang="ts">
  // Brand lockup: the two-stroke mark, and for "full" the wordmark beside it. The square and strokes keep fixed colours
  // in both themes, so the mark reads the same everywhere. The wordmark uses the app font at one weight.
  let { variant = "compact" }: { variant?: "compact" | "full" } = $props();
</script>

<span class="haya-logo haya-logo-{variant}" role="img" aria-label="Haya">
  <svg class="haya-logo-mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#17191b" />
    <path d="M11.5 24 L15.5 9.5" stroke="#e6edf5" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M19 24 L23 9.5" stroke="#cbaa70" stroke-width="3" stroke-linecap="round" fill="none" />
  </svg>
  {#if variant === "full"}<span class="haya-logo-word">Haya</span>{/if}
</span>
