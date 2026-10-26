// Toolbar edit mode: widgets show handles and names, and can be dragged to another place.
import type { Rect, Slot } from "./drag";

export interface Drag {
  id: string;
  from: Slot;
  x: number;
  y: number;
  /** Where the pointer went down, to tell a click from a drag. */
  sx: number;
  sy: number;
  /** True once the pointer has moved far enough to count as a drag. */
  moved: boolean;
  over: Slot | null;
  /** Where the drop line is drawn for `over`, or null. */
  preview: Rect | null;
}

export const edit = $state({ on: false, drag: null as Drag | null });

export function toggleEdit() {
  edit.on = !edit.on;
  edit.drag = null;
}

export function exitEdit() {
  edit.on = false;
  edit.drag = null;
}
