// Placement for anything that floats over the window (menus, popovers, tooltips).
// It opens below and to the right of its anchor, flips to the other side when there is no room,
// and is then clamped so it never leaves the window.

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export function placeInside(anchor: Point, size: Size, bounds: Size, margin = 4): Point {
  let x = anchor.x;
  let y = anchor.y;
  if (x + size.w > bounds.w - margin) x = anchor.x - size.w;
  if (y + size.h > bounds.h - margin) y = anchor.y - size.h;

  const maxX = Math.max(margin, bounds.w - size.w - margin);
  const maxY = Math.max(margin, bounds.h - size.h - margin);
  return {
    x: Math.min(Math.max(x, margin), maxX),
    y: Math.min(Math.max(y, margin), maxY),
  };
}
