// Command palette open state. Opened with ⇧⌘P, closed with Escape or after running a command.

export const palette = $state({ open: false });

export function togglePalette() {
  palette.open = !palette.open;
}

export function closePalette() {
  palette.open = false;
}
