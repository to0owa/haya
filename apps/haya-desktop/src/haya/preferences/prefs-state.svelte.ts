// Preferences dialog state. Opened from the bottom bar buttons; closed with Escape or the close button.

export type Section = "interface" | "shortcuts";

export const prefs = $state({
  open: false,
  section: "interface" as Section,
});

export function openPreferences(section: Section = "interface") {
  prefs.section = section;
  prefs.open = true;
}

export function closePreferences() {
  prefs.open = false;
}
