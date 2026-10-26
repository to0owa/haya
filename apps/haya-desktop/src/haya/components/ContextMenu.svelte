<script lang="ts">
  export interface MenuItem {
    label: string;
    checked: boolean;
    /** Optional group heading. A heading appears above the first item of each group. */
    section?: string;
    onselect: () => void;
  }

  // A small menu at a point on screen. Closes after a choice, on a click outside, or on Escape.
  let {
    x,
    y,
    title,
    items,
    onclose,
  }: { x: number; y: number; title: string; items: MenuItem[]; onclose: () => void } = $props();

  function onkey(event: KeyboardEvent) {
    if (event.key === "Escape") onclose();
  }

  function onpointer(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest(".haya-menu")) onclose();
  }
</script>

<svelte:window onkeydown={onkey} onmousedown={onpointer} />

<div class="haya-menu" role="menu" aria-label={title} style="left:{x}px;top:{y}px">
  <div class="haya-menu-title">{title}</div>
  {#each items as item, i (i)}
    {#if item.section && (i === 0 || items[i - 1].section !== item.section)}
      <div class="haya-menu-section">{item.section}</div>
    {/if}
    <button
      class="haya-menu-item"
      class:is-on={item.checked}
      role="menuitemradio"
      aria-checked={item.checked}
      onclick={() => {
        item.onselect();
        onclose();
      }}
    >
      <span class="haya-menu-check">{item.checked ? "✓" : ""}</span>
      <span>{item.label}</span>
    </button>
  {/each}
</div>
