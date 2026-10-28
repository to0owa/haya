import type { GlassLook, GlassSurface } from "./model";

/** Inline CSS variables for one glass surface: --<surface>-alpha, -blur, -highlight, -sheen and -saturation. */
export function glassVars(surface: GlassSurface, look: GlassLook): string {
  return [
    `--${surface}-alpha:${look.opacity}`,
    `--${surface}-blur:${look.blur}px`,
    `--${surface}-highlight:${look.highlight}`,
    `--${surface}-sheen:${look.sheen}`,
    `--${surface}-saturation:${look.saturation}%`,
  ].join(";");
}
