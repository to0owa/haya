# Haya wordmark brief

## Scope
The mark stays as it is for now. It is a dark rounded square (#17191b, radius 8 on a 32 grid)
with two round-capped strokes: a pale one (#e6edf5) and an amber one (#cbaa70).
Do not change the mark. Design only the wordmark that sits beside it.

## What to make
A custom wordmark for "Haya": lettering drawn for this brand, not a typeface set in a font.
Reference style: heavy, rounded, geometric lettering, like "edge", "maya", "Gendy", and "MOLO".
Those are bold and compact, with rounded terminals and simple counters.

Make three options. Each in two colourways:
- `wordmark-1-light.svg`, `wordmark-1-dark.svg`, and so on through `wordmark-3`.
- Light: ink #1d2227 on a transparent background.
- Dark: ink #e6edf5 on a transparent background.

## Lettering rules
- Lowercase is preferred: "haya". Keep the letters heavy and close together.
- One weight only, heavy. No thin strokes.
- Terminals are rounded to match the mark's soft corners.
- One option may use the amber from the mark as a single accent. The other two stay monochrome.
- Optional motif: one stroke of the "y" or the "a" can echo the slanted strokes of the mark.
  Use it only if it reads cleanly. Do not force it.
- The letters must read at 24 px tall and still look right at 16 px.

## Output rules
- Outline every letter as a filled path. Do not use `<text>` or any font. The SVG must render
  the same on any machine.
- Keep the viewBox tight to the artwork, with a little margin.
- Write only the files above, in `docs/logo/`. Do not change other files.
- At the end, list each file with one line on the idea behind it.
