// Pure drop logic for toolbar edit mode. No DOM here, so it can be tested. The DOM measurements are passed in.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A position in a toolbar. `index` is the insertion point: the dragged item goes in front of the item at that index. */
export interface Slot {
  part: string;
  index: number;
}

export interface BoxedSlot extends Slot {
  rect: Rect;
}

export interface ToolbarBox {
  part: string;
  rect: Rect;
}

const HORIZONTAL = new Set(["top", "bottom"]);

function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Finds the insertion point under the pointer, or null when the pointer is not over a toolbar. */
export function findDropTarget(x: number, y: number, toolbars: ToolbarBox[], slots: BoxedSlot[]): Slot | null {
  const bar = toolbars.find((t) => inside(t.rect, x, y));
  if (!bar) return null;

  const horizontal = HORIZONTAL.has(bar.part);
  const own = slots.filter((s) => s.part === bar.part).sort((a, b) => a.index - b.index);
  const coord = horizontal ? x : y;

  for (const slot of own) {
    const mid = horizontal ? (slot.rect.left + slot.rect.right) / 2 : (slot.rect.top + slot.rect.bottom) / 2;
    if (coord < mid) return { part: bar.part, index: slot.index };
  }
  return { part: bar.part, index: own.length ? own[own.length - 1].index + 1 : 0 };
}

/** Moves one item between or within bars. `to.index` is measured before the item is removed, as findDropTarget returns it. */
export function moveWidget(layouts: Record<string, string[]>, from: Slot, to: Slot): Record<string, string[]> {
  const source = layouts[from.part] ?? [];
  const item = source[from.index];
  if (item === undefined) return layouts;

  const next = { ...layouts };
  const without = source.filter((_, i) => i !== from.index);

  if (from.part === to.part) {
    const at = to.index > from.index ? to.index - 1 : to.index;
    const same = [...without];
    same.splice(at, 0, item);
    next[from.part] = same;
    return next;
  }

  const target = [...(layouts[to.part] ?? [])];
  target.splice(Math.min(to.index, target.length), 0, item);
  next[from.part] = without;
  next[to.part] = target;
  return next;
}

/** Where to draw the drop line for a drop target: a thin bar in front of the slot it would take, or after the last one. */
export function indicatorRect(over: Slot, toolbars: ToolbarBox[], slots: BoxedSlot[]): Rect | null {
  const bar = toolbars.find((t) => t.part === over.part);
  if (!bar) return null;

  const own = slots.filter((s) => s.part === over.part).sort((a, b) => a.index - b.index);
  const before = own.find((s) => s.index === over.index);
  const after = own.filter((s) => s.index < over.index).pop();

  if (HORIZONTAL.has(over.part)) {
    const x = before ? before.rect.left : after ? after.rect.right : bar.rect.left;
    return { left: x - 1, right: x + 1, top: bar.rect.top + 4, bottom: bar.rect.bottom - 4 };
  }
  const y = before ? before.rect.top : after ? after.rect.bottom : bar.rect.top;
  return { left: bar.rect.left + 4, right: bar.rect.right - 4, top: y - 1, bottom: y + 1 };
}
