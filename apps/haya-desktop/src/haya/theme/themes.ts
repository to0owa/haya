// Haya themes. Each theme is data: the picker lists them, and applyTheme writes its tokens onto :root.
// Token names match the variables used by haya.css and components, so nothing else needs to know the theme.

export type ThemeMode = "dark" | "light";

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  /** Four dots shown in the picker: background, accent, warm, success. */
  swatches: [string, string, string, string];
  tokens: Record<string, string>;
}

export const HAYA_DARK: Theme = {
  id: "haya-dark",
  name: "Haya Dark",
  mode: "dark",
  swatches: ["#181a1c", "#e7edf5", "#e8b84a", "#86c79a"],
  tokens: {
    "--bg": "#181a1c",
    "--chrome": "#1f2226",
    "--sidebar": "#1f2226",
    "--panel": "#121417",
    "--raised": "#1b1f23",
    "--line": "#2a3036",
    "--line2": "#3a424a",
    "--text": "#e8ebef",
    "--text-strong": "#dfe4ea",
    "--muted": "#98a1ab",
    "--quiet": "#6a737d",
    "--accent": "#e7edf5",
    "--green": "#86c79a",
    "--blue": "#8fb4e3",
    "--amber": "#e8b84a",
    "--red": "#e08a80",
    "--hover": "#242a31",
    "--selected": "#2b333b",
    "--soft": "#171b1f",
    "--inset": "#23282e",
    "--glass-brightness": "0.62",
    "--popup": "#1c2024",
    "--control": "#14171a",
    "--topbar": "#181a1c",
    "--terminal-bg": "#1e2020",
    "--terminal-fg": "#e6e9e1",
    "--terminal-cursor": "#e5e9df",
    "--terminal-selection": "#303b37",
  },
};

export const HAYA_LIGHT: Theme = {
  id: "haya-light",
  name: "Haya Light",
  mode: "light",
  swatches: ["#f3f4f6", "#1f2429", "#c2880a", "#2f8a52"],
  // Neutral greys with a faint cool tint. Adjacent layers differ by a few points, so edges blend softly.
  tokens: {
    "--bg": "#f7f8fa",
    "--chrome": "#f3f4f6",
    "--sidebar": "#f3f4f6",
    "--panel": "#eceef1",
    "--raised": "#fbfcfd",
    "--line": "#e2e6eb",
    "--line2": "#d3d9e0",
    "--text": "#1f2429",
    "--text-strong": "#171b1f",
    "--muted": "#5d6670",
    "--quiet": "#8b94a0",
    "--accent": "#1f2429",
    "--green": "#2f8a52",
    "--blue": "#2f6fb0",
    "--amber": "#c2880a",
    "--red": "#b8453a",
    "--hover": "#e7eaee",
    "--selected": "#dde2e8",
    "--soft": "#f0f2f5",
    "--inset": "#ffffff",
    "--glass-brightness": "1",
    "--popup": "#fdfdfe",
    "--control": "#ffffff",
    "--topbar": "#f3f4f6",
    "--terminal-bg": "#fbfcfd",
    "--terminal-fg": "#1f2429",
    "--terminal-cursor": "#1f2429",
    "--terminal-selection": "#dde2e8",
  },
};

// --inset is the surface that sits inside a --soft card: a panel, a field, a keycap. It must read as lifted off the card
// in every theme, so each theme sets its own value. Light goes up to white, dark goes up one step. CSS uses the token
// and never branches on the mode, so a new theme only has to supply this one value.
//
// --glass-brightness is how much of the picture behind a glass surface (a window, Preferences) comes through, as a
// multiplier. Dark themes dim it, so a translucent dark surface over a bright wallpaper stays dark. Light themes leave it at 1.

/** Listed in this order inside each mode group. The first theme of a mode is its default. */
export const THEMES: Theme[] = [HAYA_DARK, HAYA_LIGHT];

export const DEFAULT_THEME_ID = HAYA_DARK.id;

export function findTheme(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? HAYA_DARK;
}

/**
 * ANSI colours for terminals on a light background. xterm's defaults assume a dark background, where "white"
 * is light. On a light background those same codes turn invisible, so white becomes a mid grey.
 */
export const ANSI_LIGHT: Record<string, string> = {
  black: "#1f2429",
  red: "#b8453a",
  green: "#2f8a52",
  yellow: "#a06f16",
  blue: "#2f6fb0",
  magenta: "#8a4fb0",
  cyan: "#1f7f8a",
  white: "#4b5560",
  brightBlack: "#8b94a0",
  brightRed: "#c9554a",
  brightGreen: "#37a064",
  brightYellow: "#b8820f",
  brightBlue: "#3a7fc4",
  brightMagenta: "#9b62c2",
  brightCyan: "#2a909c",
  brightWhite: "#2b333b",
};

/**
 * Extended 256-colour palette for a light background (indices 16–255). The colour cube (16–230) is unchanged,
 * so coloured text keeps its colours. The white and grey entries (231 and the 232–255 ramp) are inverted,
 * so "white" text becomes dark and "dim" text stays dim, as in any light terminal.
 */
export function extendedAnsiLight(): string[] {
  const LEVELS = [0, 95, 135, 175, 215, 255];
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  const rgb = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`;
  const out: string[] = [];
  for (let i = 16; i <= 255; i++) {
    if (i === 231) {
      out.push("#2b333b");
    } else if (i >= 232) {
      const v = 8 + 10 * (i - 232);
      const inv = 246 - v;
      out.push(rgb(inv, inv, inv));
    } else {
      const n = i - 16;
      out.push(rgb(LEVELS[Math.floor(n / 36)], LEVELS[Math.floor((n % 36) / 6)], LEVELS[n % 6]));
    }
  }
  return out;
}
