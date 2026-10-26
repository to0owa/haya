<script lang="ts">
  import Button from "../components/Button.svelte";
  import { placeInside } from "../floating";
  import { DEFAULT_BARS, type BarPosition } from "../wm/bar/registry";
  import { parseSpacer, spacerId } from "../wm/bar/spacer";
  import { setBarLayout, wm } from "../wm/store.svelte";

  // Size options for one spacer: fill the free space, or a fixed px along the bar's axis.
  let { part, index, x, y, onclose }: { part: BarPosition; index: number; x: number; y: number; onclose: () => void } = $props();

  const list = $derived(wm.config.barLayout[part] ?? DEFAULT_BARS[part]);
  const current = $derived(parseSpacer(list[index] ?? "spacer"));
  const horizontal = $derived(part === "top" || part === "bottom");

  let mode = $state<"fill" | "fixed">("fill");
  let px = $state(120);
  let el: HTMLDivElement | undefined = $state();
  let place = $state<{ x: number; y: number } | null>(null);

  // Start from the spacer's current size each time the menu opens.
  $effect(() => {
    mode = current?.px == null ? "fill" : "fixed";
    px = current?.px ?? 120;
  });

  $effect(() => {
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    place = placeInside({ x, y }, { w: width, h: height }, { w: window.innerWidth, h: window.innerHeight });
  });

  function apply() {
    const size = mode === "fill" ? null : Math.min(2000, Math.max(4, Math.round(Number(px) || 4)));
    const ids = [...list];
    ids[index] = spacerId(size);
    setBarLayout(part, ids);
    onclose();
  }

  function remove() {
    setBarLayout(part, list.filter((_, i) => i !== index));
    onclose();
  }

  function outside(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest(".haya-spacer-menu")) onclose();
  }

  function onkey(event: KeyboardEvent) {
    if (event.key === "Escape") onclose();
  }
</script>

<svelte:window onmousedown={outside} onkeydown={onkey} />

<div
  class="haya-menu haya-spacer-menu"
  role="dialog"
  aria-label="Spacer size"
  bind:this={el}
  style="left:{place?.x ?? x}px;top:{place?.y ?? y}px;visibility:{place ? 'visible' : 'hidden'};min-width:220px"
>
  <div class="haya-menu-title">Spacer</div>
  <div class="haya-form-row">
    <span class="haya-form-label">Size</span>
    <div class="haya-form-options">
      <Button variant="text" label="Fill the free space" active={mode === "fill"} onclick={() => (mode = "fill")}>Fill</Button>
      <Button variant="text" label="Fixed size" active={mode === "fixed"} onclick={() => (mode = "fixed")}>Fixed</Button>
    </div>
  </div>
  {#if mode === "fixed"}
    <label class="haya-form-row">
      <span class="haya-form-label">{horizontal ? "Width" : "Height"} (px)</span>
      <input class="haya-input" type="number" min="4" max="2000" bind:value={px} />
    </label>
  {/if}
  <div class="haya-form-actions">
    <Button variant="text" label="Remove spacer" onclick={remove}>Remove</Button>
    <Button variant="text" label="Apply spacer size" active onclick={apply}>Apply</Button>
  </div>
</div>
