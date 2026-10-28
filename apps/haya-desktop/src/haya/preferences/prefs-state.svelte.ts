// Preferences dialog state. Opened from the bottom bar buttons; closed with Escape or the close button.

export type Section = "interface" | "workspaces" | "toolbar" | "shortcuts" | "about";

// The section rail is icon-only by default. The expanded choice is a per-viewer preference, so it lives in localStorage.
const NAV_KEY = "haya.prefs.navExpanded";

function readNavExpanded(): boolean {
  try {
    return localStorage.getItem(NAV_KEY) === "1";
  } catch {
    return false;
  }
}

export const prefs = $state({
  open: false,
  section: "interface" as Section,
  navExpanded: readNavExpanded(),
});

export function setNavExpanded(expanded: boolean) {
  prefs.navExpanded = expanded;
  try {
    localStorage.setItem(NAV_KEY, expanded ? "1" : "0");
  } catch {
    // Storage can be blocked. The rail still works for this session.
  }
}

export function openPreferences(section: Section = "interface") {
  prefs.section = section;
  prefs.open = true;
}

export function closePreferences() {
  prefs.open = false;
}
