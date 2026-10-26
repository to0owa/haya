<script lang="ts">
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";

  // A single tab in a strip. Parents decide what selecting and closing do.
  let {
    label,
    selected = false,
    onselect,
    onclose,
  }: { label: string; selected?: boolean; onselect: () => void; onclose?: () => void } = $props();
</script>

<div class="haya-tab" class:is-selected={selected} role="tab" aria-selected={selected} tabindex="0" onclick={onselect} onkeydown={(e) => e.key === "Enter" && onselect()}>
  <span class="haya-tab-label">{label}</span>
  {#if onclose}
    <span class="haya-tab-close" role="presentation" onclick={(e) => { e.stopPropagation(); onclose(); }}>
      <Icon name="close" />
    </span>
  {/if}
</div>
