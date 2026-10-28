<script lang="ts">
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";
  import Icon from "./Icon.svelte";

  // A settings card that shows only its title until opened. Long lists stay out of the way until needed.
  let { title, open = $bindable(false), children }: { title: string; open?: boolean; children: Snippet } = $props();

  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>

<section class="haya-prefs-card haya-disclosure" class:is-open={open}>
  <button class="haya-disclosure-head" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="haya-prefs-card-title">{title}</span>
    <span class="haya-disclosure-chevron"><Icon name="chevron-down" /></span>
  </button>
  {#if open}
    <div class="haya-disclosure-body" transition:slide={{ duration: reduceMotion ? 0 : 200 }}>
      {@render children()}
    </div>
  {/if}
</section>
