<script lang="ts">
  import { tick } from "svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import ContextMenu, { type MenuItem } from "../components/ContextMenu.svelte";
  import { DEFAULT_BARS, WIDGETS, WIDGET_LABELS, isWidget, type BarPosition, type WidgetId } from "../wm/bar/registry";
  import { isSpacerId, parseSpacer } from "../wm/bar/spacer";
  import { resetBarLayout, setBarLayout, setWidgetHidden, wm } from "../wm/store.svelte";
  import { edit, exitEdit } from "./edit.svelte";
  import SpacerMenu from "./SpacerMenu.svelte";
  import { findDropTarget, indicatorRect, moveWidget, type BoxedSlot, type Rect, type ToolbarBox } from "./drag";

  const PARTS: BarPosition[] = ["top", "bottom", "left", "right"];

  // One box per slot, measured from the widgets inside it. Slots are display: contents, so they have no box of their own.
  interface Box extends BoxedSlot {
    id: string;
    hidden: boolean;
    label: string;
  }

  let boxes = $state<Box[]>([]);

  // Where each bar's "+" sits: just past its last item, or at the start when the bar is empty.
  interface AddAnchor {
    part: BarPosition;
    x: number;
    y: number;
    horizontal: boolean;
  }
  let anchors = $state<AddAnchor[]>([]);
  let addMenu = $state<{ x: number; y: number; part: BarPosition } | null>(null);
  let picker = $state<{ part: BarPosition } | null>(null);
  let pickerQuery = $state("");
  let spacerMenu = $state<{ x: number; y: number; part: BarPosition; index: number } | null>(null);
  let itemMenu = $state<{ x: number; y: number; part: BarPosition; index: number; id: string } | null>(null);

  const BAR_NAMES: Record<BarPosition, string> = { top: "top bar", bottom: "bottom bar", left: "left strip", right: "right strip" };



  function labelFor(id: string): string {
    if (isSpacerId(id)) {
      const px = parseSpacer(id)?.px;
      return px ? `Spacer ${px}px` : "Spacer (fill)";
    }
    return isWidget(id) ? WIDGET_LABELS[id as WidgetId] : id;
  }

  function union(rects: DOMRect[]): Rect {
    return {
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      right: Math.max(...rects.map((r) => r.right)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
  }

  function measureAnchors() {
    anchors = PARTS.flatMap((part): AddAnchor[] => {
      const bar = document.querySelector<HTMLElement>(`.haya-chrome[data-part="${part}"]`);
      if (!bar) return [];
      const r = bar.getBoundingClientRect();
      const horizontal = part === "top" || part === "bottom";
      const own = boxes.filter((b) => b.part === part);
      if (horizontal) {
        const x = own.length ? Math.max(...own.map((b) => b.rect.right)) + 4 : r.left + 4;
        return [{ part, x, y: r.top + r.height / 2, horizontal }];
      }
      const y = own.length ? Math.max(...own.map((b) => b.rect.bottom)) + 4 : r.top + 4;
      return [{ part, x: r.left + r.width / 2, y, horizontal }];
    });
  }

  function measureBoxes() {
    measureSlots();
    measureAnchors();
  }

  function measureSlots() {
    boxes = Array.from(document.querySelectorAll<HTMLElement>("[data-item]")).flatMap((el) => {
      const rects = Array.from(el.children)
        .map((child) => child.getBoundingClientRect())
        .filter((r) => r.width > 0 || r.height > 0);
      if (rects.length === 0) return [];
      const id = el.dataset.id ?? "";
      return [
        {
          id,
          part: el.dataset.part ?? "",
          index: Number(el.dataset.index),
          hidden: el.dataset.hidden === "true",
          label: labelFor(id),
          rect: union(rects),
        },
      ];
    });
  }

  // Measure whenever edit mode opens or the layout changes.
  $effect(() => {
    if (!edit.on) {
      boxes = [];
      return;
    }
    void wm.config.barLayout;
    void wm.config.hiddenWidgets;
    tick().then(measureBoxes);
  });

  // Every bar's order: the saved one, or the default.
  function effective(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const part of PARTS) map[part] = [...(wm.config.barLayout[part] ?? DEFAULT_BARS[part])];
    return map;
  }

  function startDrag(event: PointerEvent, box: Box) {
    event.preventDefault();
    edit.drag = {
      id: box.id,
      from: { part: box.part, index: box.index },
      x: event.clientX,
      y: event.clientY,
      sx: event.clientX,
      sy: event.clientY,
      moved: false,
      over: null,
      preview: null,
    };
  }

  function onmove(event: PointerEvent) {
    const drag = edit.drag;
    if (!drag) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) <= 4) return;
    drag.moved = true;
    const toolbars: ToolbarBox[] = Array.from(document.querySelectorAll<HTMLElement>(".haya-chrome[data-part]")).map((el) => ({
      part: el.dataset.part ?? "",
      rect: { left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top, right: el.getBoundingClientRect().right, bottom: el.getBoundingClientRect().bottom },
    }));
    const slots: BoxedSlot[] = boxes.map((b) => ({ part: b.part, index: b.index, rect: b.rect }));
    drag.over = findDropTarget(event.clientX, event.clientY, toolbars, slots);
    drag.preview = drag.over ? indicatorRect(drag.over, toolbars, slots) : null;
  }

  function onup() {
    const drag = edit.drag;
    if (!drag) return;
    const over = drag.over;
    edit.drag = null;
    // A press without a real drag is a click: open the item menu instead.
    if (!drag.moved) {
      itemMenu = { x: drag.sx, y: drag.sy, part: drag.from.part as BarPosition, index: drag.from.index, id: drag.id };
      return;
    }
    if (!over) return;

    const before = effective();
    const after = moveWidget(before, drag.from, over);
    for (const part of PARTS) {
      if (JSON.stringify(after[part]) !== JSON.stringify(before[part])) setBarLayout(part, after[part]);
    }
  }

  function onkey(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (picker) picker = null;
    else if (edit.drag) edit.drag = null;
    else if (edit.on) exitEdit();
  }

  function addTo(part: BarPosition, id: string) {
    setBarLayout(part, [...effective()[part], id]);
  }

  function moveItem(part: BarPosition, index: number, target: BarPosition) {
    const before = effective();
    const after = moveWidget(before, { part, index }, { part: target, index: before[target].length });
    for (const p of PARTS) {
      if (JSON.stringify(after[p]) !== JSON.stringify(before[p])) setBarLayout(p, after[p]);
    }
  }

  function removeItem(part: BarPosition, index: number) {
    setBarLayout(part, effective()[part].filter((_, i) => i !== index));
  }

  // The menu that opens on a click: move to another bar, size a spacer, or remove it.
  const itemItems = $derived.by((): MenuItem[] => {
    if (!itemMenu) return [];
    const { part, index, id } = itemMenu;
    const items: MenuItem[] = [];
    if (isSpacerId(id)) {
      items.push({
        label: "Size…",
        checked: false,
        onselect: () => (spacerMenu = { x: itemMenu?.x ?? 0, y: itemMenu?.y ?? 0, part, index }),
      });
    }
    for (const target of PARTS) {
      if (target === part) continue;
      items.push({ label: `Move to ${BAR_NAMES[target]}`, checked: false, onselect: () => moveItem(part, index, target) });
    }
    items.push({ label: "Remove from toolbar", checked: false, onselect: () => removeItem(part, index) });
    return items;
  });

  function openAddMenu(anchor: AddAnchor) {
    addMenu = { x: anchor.x, y: anchor.y, part: anchor.part };
  }

  // The "+" menu: a spacer, or More… for the full list.
  const addItems = $derived.by((): MenuItem[] => {
    const part = addMenu?.part;
    if (!part) return [];
    return [
      { label: "Spacer", checked: false, onselect: () => addTo(part, "spacer") },
      { label: "More…", checked: false, onselect: () => (picker = { part }) },
    ];
  });

  // Everything that can go in a bar, filtered by the search box.
  const pickerItems = $derived(
    Object.keys(WIDGETS)
      .map((id) => ({ id, label: labelFor(id) }))
      .filter((item) => item.label.toLowerCase().includes(pickerQuery.trim().toLowerCase())),
  );

  function pick(id: string) {
    if (!picker) return;
    if (id !== "spacer") setWidgetHidden(id, false);
    addTo(picker.part, id);
    picker = null;
    pickerQuery = "";
  }
</script>

<svelte:window onpointermove={onmove} onpointerup={onup} onkeydown={onkey} onresize={() => edit.on && measureBoxes()} />

{#if itemMenu}
  <ContextMenu
    x={itemMenu.x}
    y={itemMenu.y}
    title={labelFor(itemMenu.id)}
    items={itemItems}
    onclose={() => (itemMenu = null)}
  />
{/if}

{#if edit.on}
  {#each boxes as box (box.part + ":" + box.index)}
    <div
      class="haya-edit-box"
      class:is-hidden={box.hidden}
      class:is-dragging={edit.drag?.from.part === box.part && edit.drag?.from.index === box.index}
      style="left:{box.rect.left}px;top:{box.rect.top}px;width:{box.rect.right - box.rect.left}px;height:{box.rect.bottom - box.rect.top}px"
    >
      <span class="haya-edit-badge" role="presentation" onpointerdown={(e) => startDrag(e, box)}>
        <span class="haya-edit-grip">⠿</span>
        <span>{box.label}</span>
      </span>
    </div>
  {/each}

  {#each anchors as anchor (anchor.part)}
    <div
      class="haya-add-anchor"
      style="left:{anchor.x}px;top:{anchor.y}px;transform:{anchor.horizontal ? 'translateY(-50%)' : 'translateX(-50%)'}"
    >
      <Button variant="icon" label="Add to the {anchor.part} bar" onclick={() => openAddMenu(anchor)}>
        <Icon name="plus" />
      </Button>
    </div>
  {/each}

  <div class="haya-edit-bar" role="toolbar" aria-label="Edit toolbar">
    <span class="haya-edit-hint">Drag a badge to move it · + adds to a bar</span>
    <Button variant="text" label="Reset toolbar layout" onclick={resetBarLayout}>Reset</Button>
    <Button variant="text" label="Done editing" active onclick={exitEdit}>Done</Button>
  </div>
{/if}

{#if addMenu}
  <ContextMenu x={addMenu.x} y={addMenu.y} title="Add to {addMenu.part} bar" items={addItems} onclose={() => (addMenu = null)} />
{/if}

{#if picker}
  <div class="haya-palette-scrim" role="presentation" onmousedown={(e) => e.target === e.currentTarget && (picker = null)}>
    <div class="haya-palette" role="dialog" aria-modal="true" aria-label="Add a widget to the {picker.part} bar">
      <input class="haya-palette-input" placeholder="Add to the {picker.part} bar" bind:value={pickerQuery} aria-label="Search widgets" />
      <div class="haya-palette-list">
        {#each pickerItems as item (item.id)}
          <button class="haya-palette-item" onclick={() => pick(item.id)}>
            <span>{item.label}</span>
          </button>
        {:else}
          <div class="haya-palette-empty">Nothing matches "{pickerQuery}"</div>
        {/each}
      </div>
    </div>
  </div>
{/if}

{#if spacerMenu}
  <SpacerMenu part={spacerMenu.part} index={spacerMenu.index} x={spacerMenu.x} y={spacerMenu.y} onclose={() => (spacerMenu = null)} />
{/if}

{#if edit.drag?.preview}
  <div class="haya-drop-line" style="left:{edit.drag.preview.left}px;top:{edit.drag.preview.top}px;width:{edit.drag.preview.right - edit.drag.preview.left}px;height:{edit.drag.preview.bottom - edit.drag.preview.top}px"></div>
{/if}

{#if edit.drag}
  <div class="haya-drag-ghost" style="left:{edit.drag.x + 12}px;top:{edit.drag.y + 12}px">
    {edit.drag.id}
  </div>
{/if}
