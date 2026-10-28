// Pure key-string helpers: parsing, matching, and display. No imports, so the tests can run them without the app.
// A key string is modifiers joined to a physical key code, for example "Mod+Shift+KeyB".

export const MODIFIERS = ["Ctrl", "Alt", "Shift", "Mod"] as const;
export type Modifier = (typeof MODIFIERS)[number];
export const MODIFIER_CODES = new Set(["MetaLeft", "MetaRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "CapsLock", "Fn"]);

/** Splits a key string into its modifiers and physical code. */
export function parseKey(key: string): { mods: Set<Modifier>; code: string } {
  const parts = key.split("+");
  const code = parts.pop() ?? "";
  return { mods: new Set(parts.filter((p): p is Modifier => (MODIFIERS as readonly string[]).includes(p))), code };
}

/** Builds the key string for a keydown event. Returns null while only a modifier is held. */
export function keyFromEvent(event: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): string | null {
  if (!event.code || MODIFIER_CODES.has(event.code)) return null;
  const parts: string[] = [];
  if (event.metaKey) parts.push("Mod");
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(event.code);
  return parts.join("+");
}

/** True when the key string names exactly the modifiers and code of this event. */
export function matches(key: string, event: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): boolean {
  const { mods, code } = parseKey(key);
  return code === event.code
    && mods.has("Mod") === event.metaKey
    && mods.has("Ctrl") === event.ctrlKey
    && mods.has("Alt") === event.altKey
    && mods.has("Shift") === event.shiftKey;
}

const SYMBOLS: Record<string, string> = {
  Enter: "↩", Backslash: "\\", Backquote: "`", Comma: ",", Period: ".", Minus: "-", Equal: "=",
  BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Slash: "/", Space: "Space",
  Escape: "Esc", Backspace: "⌫", Delete: "⌦", Tab: "⇥", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};

/** Shows a key string the way macOS menus do: ⌃ ⌥ ⇧ ⌘, then the key. */
export function formatKey(key: string): string {
  if (!key) return "";
  const { mods, code } = parseKey(key);
  const symbols = [
    mods.has("Ctrl") ? "⌃" : "",
    mods.has("Alt") ? "⌥" : "",
    mods.has("Shift") ? "⇧" : "",
    mods.has("Mod") ? "⌘" : "",
  ].join("");
  const letter = code.startsWith("Key") ? code.slice(3) : code.startsWith("Digit") ? code.slice(5) : (SYMBOLS[code] ?? code);
  return symbols + letter;
}
