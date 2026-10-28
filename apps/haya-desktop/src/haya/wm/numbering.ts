// How a workspace is labelled on its chip. The shortcut (⌘1–⌘0) never changes; only the text does.

export type Numbering = "arabic" | "kanji" | "aksara" | "custom";

export const NUMBERINGS: Numbering[] = ["arabic", "kanji", "aksara", "custom"];

const KANJI = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

// Javanese digits are U+A9D0 (zero) through U+A9D9 (nine).
const AKSARA_DIGITS = "꧐꧑꧒꧓꧔꧕꧖꧗꧘꧙";

function toAksara(n: number): string {
  return String(n).replace(/\d/g, (d) => AKSARA_DIGITS[Number(d)]);
}

/** The label for workspace `id` (1–10). `name` is the user's own name, used only in custom mode. */
export function workspaceLabel(id: number, numbering: Numbering, name: string): string {
  switch (numbering) {
    case "kanji":
      return KANJI[id - 1] ?? String(id);
    case "aksara":
      return toAksara(id);
    case "custom":
      return name.trim() || String(id === 10 ? 0 : id);
    default:
      return String(id === 10 ? 0 : id);
  }
}

export function toNumbering(value: unknown): Numbering {
  return NUMBERINGS.includes(value as Numbering) ? (value as Numbering) : "arabic";
}
