<script lang="ts">
  import { tick } from "svelte";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import Tab from "./Tab.svelte";
  import type { IconName } from "./Icon.svelte";

  // A row of tabs. Tabs share the free width, but each stays between --haya-tab-min and --haya-tab-max wide.
  // When they no longer fit, the row scrolls with arrow buttons on both sides, or with the mouse wheel.
  let {
    items,
    selectedId,
    label,
    onselect,
    onclose,
  }: {
    items: { id: number; label: string; icon: IconName }[];
    selectedId: number | null;
    label: string;
    onselect: (id: number) => void;
    onclose: (id: number) => void;
  } = $props();

  let scroller: HTMLDivElement | undefined = $state();
  let overflow = $state(false);
  let atStart = $state(true);
  let atEnd = $state(true);

  function measure() {
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    overflow = scrollWidth > clientWidth + 1;
    atStart = scrollLeft <= 1;
    atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
  }

  function step(direction: 1 | -1) {
    scroller?.scrollBy({ left: direction * 160, behavior: "smooth" });
  }

  function wheel(event: WheelEvent) {
    if (!scroller || !overflow || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }

  // Re-measure when the strip resizes, and when tabs are added or removed.
  $effect(() => {
    if (!scroller) return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  });

  $effect(() => {
    void items.length;
    tick().then(measure);
  });

  // Keep the selected tab in view.
  $effect(() => {
    if (selectedId === null || !scroller) return;
    scroller.querySelector<HTMLElement>(".is-selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
</script>

<div class="haya-tabstrip" role="presentation">
  {#if overflow}
    <Button variant="icon" label="Scroll tabs left" disabled={atStart} onclick={() => step(-1)}>
      <Icon name="back" />
    </Button>
  {/if}
  <div class="haya-tabstrip-scroll" role="tablist" aria-label={label} bind:this={scroller} onscroll={measure} onwheel={wheel}>
    {#each items as item (item.id)}
      <Tab label={item.label} icon={item.icon} selected={selectedId === item.id} onselect={() => onselect(item.id)} onclose={() => onclose(item.id)} />
    {/each}
  </div>
  {#if overflow}
    <Button variant="icon" label="Scroll tabs right" disabled={atEnd} onclick={() => step(1)}>
      <Icon name="forward" />
    </Button>
  {/if}
</div>
