// Spacer ids in a toolbar layout. "spacer" fills the free space. "spacer:120" is a fixed 120px.

export interface SpacerSpec {
  /** Fixed size in px, or null to fill. */
  px: number | null;
}

export function isSpacerId(id: string): boolean {
  return id === "spacer" || id.startsWith("spacer:");
}

export function parseSpacer(id: string): SpacerSpec | null {
  if (!isSpacerId(id)) return null;
  const px = Number(id.slice("spacer:".length));
  return { px: id === "spacer" || !Number.isFinite(px) || px < 1 ? null : Math.round(px) };
}

export function spacerId(px: number | null): string {
  return px === null ? "spacer" : `spacer:${Math.max(1, Math.round(px))}`;
}
