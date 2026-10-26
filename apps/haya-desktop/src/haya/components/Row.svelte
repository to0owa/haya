<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  // Sidebar row. "head" is a group title, "group" a sub-group, "item" a selectable entry.
  let {
    kind = "item",
    label,
    meta,
    selected = false,
    expanded,
    badge,
    onclick,
    children,
  }: {
    kind?: "head" | "group" | "item";
    label: string;
    meta?: string;
    selected?: boolean;
    expanded?: boolean;
    badge?: string;
    onclick: () => void;
    children?: Snippet;
  } = $props();
</script>

<button class="haya-row haya-row-{kind}" class:is-selected={selected} aria-expanded={expanded} aria-label={label} onclick={onclick}>
  {#if children}<span class="haya-row-badge">{@render children()}</span>{/if}
  <span class="haya-row-label">{label}</span>
  {#if badge}<span class="haya-row-count">{badge}</span>{/if}
  {#if meta}<span class="haya-row-meta">{meta}</span>{/if}
  {#if expanded !== undefined}<span class="haya-row-chevron" class:is-open={expanded}><Icon name="chevron-right" /></span>{/if}
</button>
