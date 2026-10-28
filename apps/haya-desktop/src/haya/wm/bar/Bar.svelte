<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import Toolbar from "../../templates/Toolbar.svelte";
  import Spacer from "../../components/Spacer.svelte";
  import Button from "../../components/Button.svelte";
  import ContextMenu, { type MenuItem } from "../../components/ContextMenu.svelte";
  import SpacerMenu from "../../toolbar/SpacerMenu.svelte";
  import { placeInside } from "../../floating";
  import { DEFAULT_BARS, WIDGETS, WIDGET_LABELS, isWidget, type BarPosition, type WidgetId } from "./registry";
  import { setWidgetHidden, wm } from "../store.svelte";
  import { edit } from "../../toolbar/edit.svelte";
  import { isSpacerId, parseSpacer } from "./spacer";

  let { part }: { part: BarPosition } = $props();

  const LABELS: Record<BarPosition, string> = {
    top: "Workspaces and layout",
    bottom: "Status",
    left: "Explorer",
    right: "Details",
  };

  // Spacer.axis runs along the bar: x for horizontal bars, y for vertical ones.
  const axis = $derived(part === "top" || part === "bottom" ? "x" : "y");

  // The saved order for this bar, or the default. Hidden widgets stay in the list, so their slot keeps its index.
  const raw = $derived(wm.config.barLayout[part] ?? DEFAULT_BARS[part]);
  const hidden = (id: string) => wm.config.hiddenWidgets.includes(id);
  // A bar with no visible items is hidden and takes no space. Edit mode keeps bars visible so items can be dropped in.
  const empty = $derived(raw.every((id) => !isSpacerId(id) && (!isWidget(id) || hidden(id))));

  // The context menu lists every real widget. Spacers are sized from their own menu.
  const ALL = Object.keys(WIDGETS).filter((id) => id !== "spacer") as WidgetId[];

  let menu = $state<{ x: number; y: number } | null>(null);
  let spacerMenu = $state<{ x: number; y: number; index: number } | null>(null);

  function openMenu(event: MouseEvent) {
    event.preventDefault();
    menu = { x: event.clientX, y: event.clientY };
  }

  function openSpacerMenu(event: MouseEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    spacerMenu = { x: event.clientX, y: event.clientY, index };
  }

  const menuItems = $derived.by((): MenuItem[] =>
    ALL.map((id) => {
      const isHidden = hidden(id);
      return { label: WIDGET_LABELS[id], checked: !isHidden, onselect: () => setWidgetHidden(id, !isHidden) };
    }),
  );

  // ---- Overflow: items that do not fit move behind a "⋯" button, from the end of the bar. ----

  const GAP = 4;
  const MORE_WIDTH = 28;
  const SPACER_MIN = 24;
  const TABS_MIN = 160;

  // The first raw index that overflows, or null when everything fits.
  let cut = $state<number | null>(null);
  let more = $state<{ x: number; y: number } | null>(null);
  let moreEl: HTMLElement | undefined = $state();
  let overflowEl: HTMLDivElement | undefined = $state();
  let overflowPlace = $state<{ x: number; y: number } | null>(null);

  // Natural width of each slot, by raw index. Kept while the item is in the overflow, so it can come back.
  let widths: Record<number, number> = {};
  let observer: ResizeObserver | undefined;

  function bar(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.haya-chrome[data-part="${part}"]`);
  }

  const horizontal = $derived(part === "top" || part === "bottom");

  // Slots are display: contents, so a slot's size is the span of the widgets inside it, along the bar's axis.
  function slotSize(slot: HTMLElement): number {
    const rects = Array.from(slot.children)
      .map((child) => child.getBoundingClientRect())
      .filter((r) => r.width > 0 || r.height > 0);
    if (rects.length === 0) return 0;
    return horizontal
      ? Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left))
      : Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
  }

  // The DOM is the final judge. The bar clips what overflows, so scrollWidth stays put. Compare item edges instead:
  // while the last rendered item (or the "⋯") passes the bar's inner edge, one more item moves behind "⋯".
  function overflows(el: HTMLElement): boolean {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const visibleRight = Math.min(box.right, window.innerWidth);
    const visibleBottom = Math.min(box.bottom, window.innerHeight);
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-item] > *, .haya-more"))
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 || r.height > 0);
    if (items.length === 0) return false;
    if (horizontal) {
      const limit = visibleRight - parseFloat(style.paddingRight);
      return Math.max(...items.map((r) => r.right)) > limit + 1;
    }
    const limit = visibleBottom - parseFloat(style.paddingBottom);
    return Math.max(...items.map((r) => r.bottom)) > limit + 1;
  }

  async function settle(el: HTMLElement) {
    if (cut === null && overflows(el)) cut = raw.length;
    while (cut !== null && cut > 0 && overflows(el)) {
      cut--;
      await tick();
    }
  }

  function fit(available: number): number | null {
    let total = 0;
    for (let i = 0; i < raw.length; i++) total += (widths[i] ?? 0) + GAP;
    if (total <= available) return null;

    let end = raw.length;
    while (end > 0 && total + MORE_WIDTH > available) {
      end--;
      total -= (widths[end] ?? 0) + GAP;
    }
    return end;
  }

  function update() {
    const el = bar();
    if (!el) return;
    if (edit.on) {
      cut = null;
      return;
    }

    // Measure what is on screen. A fill spacer counts at its minimum, not at the space it happens to get.
    for (const slot of Array.from(el.children)) {
      if (!(slot instanceof HTMLElement) || slot.dataset.index === undefined) continue;
      const index = Number(slot.dataset.index);
      const spec = parseSpacer(slot.dataset.id ?? "");
      // Flexible items are counted at their minimum. Their measured size includes the free space they took,
      // which would make the estimate say the bar is full when it is not.
      const id = slot.dataset.id ?? "";
      if (spec) widths[index] = spec.px ?? SPACER_MIN;
      else if (id === "tabs") widths[index] = TABS_MIN;
      else widths[index] = slotSize(slot);
    }

    const style = getComputedStyle(el);
    const available = horizontal
      ? el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      : el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    cut = fit(available);
    tick().then(() => settle(el));
  }

  // A new layout or new hidden set starts from scratch: everything renders, then gets measured.
  $effect(() => {
    void raw;
    void wm.config.hiddenWidgets;
    void edit.on;
    widths = {};
    cut = null;
    more = null;
    tick().then(update);
  });

  onMount(() => {
    const el = bar();
    if (el) {
      observer = new ResizeObserver(() => update());
      observer.observe(el);
    }
  });

  onDestroy(() => observer?.disconnect());

  function toggleMore() {
    if (more) {
      more = null;
      return;
    }
    const r = moreEl?.getBoundingClientRect();
    if (!r) return;
    // Anchor on the bar's outer edge. Placement flips to the other side when there is no room.
    more = { x: r.left, y: part === "bottom" ? r.top - 4 : r.bottom + 4 };
  }

  $effect(() => {
    if (!more || !overflowEl) return;
    const { width, height } = overflowEl.getBoundingClientRect();
    overflowPlace = placeInside(more, { w: width, h: height }, { w: window.innerWidth, h: window.innerHeight });
  });

  function onpointer(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (more && !target.closest(".haya-overflow, .haya-more")) more = null;
  }

  function onkey(event: KeyboardEvent) {
    if (event.key === "Escape") more = null;
  }
</script>

<svelte:window onmousedown={onpointer} onkeydown={onkey} />


{#if empty && !edit.on}
  <!-- An empty bar keeps the same gap as a shown one, so the stage never touches the window edge. -->
  <div class="haya-empty-bar haya-empty-{part}" aria-hidden="true"></div>
{:else}
<div class="haya-bar-hit" role="presentation" oncontextmenu={openMenu}>
  <Toolbar edge={part} label={LABELS[part]}>
    <!-- Slots never change the layout. Edit mode draws its outlines and badges over them (see toolbar/EditLayer). -->
    {#each raw as id, index (index)}
      {#if cut === null || index < cut}
        {#if isSpacerId(id)}
          {@const spec = parseSpacer(id)}
          <div class="haya-slot" data-item data-id={id} data-part={part} data-index={index} data-hidden="false" role="presentation" oncontextmenu={(event) => openSpacerMenu(event, index)}>
            <Spacer {axis} fill={spec?.px == null} size={spec?.px ?? null} />
          </div>
        {:else if isWidget(id) && (edit.on || !hidden(id))}
          {@const Widget = WIDGETS[id]}
          <div class="haya-slot" data-item data-id={id} data-part={part} data-index={index} data-hidden={hidden(id)}>
            <Widget />
          </div>
        {/if}
      {/if}
    {/each}
    {#if cut !== null}
      <span class="haya-more" bind:this={moreEl}>
        <Button variant="text" label="More items" onclick={toggleMore}>⋯</Button>
      </span>
    {/if}
  </Toolbar>
</div>
{/if}

{#if cut !== null && more}
  <div
    class="haya-overflow"
    bind:this={overflowEl}
    role="menu"
    aria-label="More items"
    style="left:{overflowPlace?.x ?? more.x}px;top:{overflowPlace?.y ?? more.y}px;visibility:{overflowPlace ? 'visible' : 'hidden'}"
  >
    {#each raw.slice(cut) as id, offset (cut + offset)}
      {#if isWidget(id) && !isSpacerId(id) && !hidden(id)}
        {@const Widget = WIDGETS[id]}
        <div class="haya-overflow-item">
          <Widget />
        </div>
      {/if}
    {/each}
  </div>
{/if}

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} title="Toolbar" items={menuItems} onclose={() => (menu = null)} />
{/if}

{#if spacerMenu}
  <SpacerMenu part={part} index={spacerMenu.index} x={spacerMenu.x} y={spacerMenu.y} onclose={() => (spacerMenu = null)} />
{/if}
