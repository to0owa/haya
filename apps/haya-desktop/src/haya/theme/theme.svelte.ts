// Current theme and picker state. The choice is a per-viewer preference, so it lives in localStorage.

import { DEFAULT_THEME_ID, findTheme, type Theme } from "./themes";

const KEY = "haya.theme";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Private window or blocked storage: the theme still applies for this session.
  }
}

export const themeState = $state({
  id: DEFAULT_THEME_ID,
  pickerOpen: false,
});

export function currentTheme(): Theme {
  return findTheme(themeState.id);
}

/** Writes the theme's tokens onto :root, so every CSS variable follows the theme. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme.mode;
  root.style.colorScheme = theme.mode;
}

export function setTheme(id: string) {
  const theme = findTheme(id);
  themeState.id = theme.id;
  applyTheme(theme);
  write(theme.id);
  themeState.pickerOpen = false;
}

export function togglePicker() {
  themeState.pickerOpen = !themeState.pickerOpen;
}

export function closePicker() {
  themeState.pickerOpen = false;
}

/** Call once on startup. Restores the saved theme before the first paint of the app. */
export function initTheme() {
  const theme = findTheme(read());
  themeState.id = theme.id;
  applyTheme(theme);
}
