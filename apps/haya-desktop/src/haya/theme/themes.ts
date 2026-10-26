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
  swatches: ["#181a1c", "#e7edf5", "#d9b274", "#86c79a"],
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
    "--amber": "#d9b274",
    "--red": "#e08a80",
    "--hover": "#242a31",
    "--selected": "#2b333b",
    "--soft": "#171b1f",
    "--popup": "#1c2024",
    "--control": "#14171a",
    "--topbar": "#181a1c",
  },
};

export const HAYA_LIGHT: Theme = {
  id: "haya-light",
  name: "Haya Light",
  mode: "light",
  swatches: ["#eef0f3", "#1d2227", "#9a6b12", "#2f8a52"],
  tokens: {
    "--bg": "#eef0f3",
    "--chrome": "#f6f7f9",
    "--sidebar": "#f6f7f9",
    "--panel": "#e4e7eb",
    "--raised": "#ffffff",
    "--line": "#d5dae0",
    "--line2": "#c4cbd3",
    "--text": "#1d2227",
    "--text-strong": "#15191d",
    "--muted": "#5b6570",
    "--quiet": "#8a939d",
    "--accent": "#1d2227",
    "--green": "#2f8a52",
    "--blue": "#2f6fb0",
    "--amber": "#9a6b12",
    "--red": "#b8453a",
    "--hover": "#e4e8ed",
    "--selected": "#d9dee5",
    "--soft": "#f1f3f6",
    "--popup": "#ffffff",
    "--control": "#ffffff",
    "--topbar": "#eef0f3",
  },
};

/** Listed in this order inside each mode group. The first theme of a mode is its default. */
export const THEMES: Theme[] = [HAYA_DARK, HAYA_LIGHT];

export const DEFAULT_THEME_ID = HAYA_DARK.id;

export function findTheme(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? HAYA_DARK;
}
