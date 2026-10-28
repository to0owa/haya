# Haya layout

## Layering

Components follow two layers, the same as a web project:

- **`src/haya/templates/`** — parent layers. Layout wrappers that other components are placed into.
  Example: `Toolbar.svelte` (a band with edge top/bottom/left/right). Future: `AppShell`, `Stage`, `SidePanel`, `WindowFrame`.
- **`src/haya/components/`** — child primitives. Small pieces with no layout opinion.
  Example: `Button.svelte`. Future: `Icon`, `Chip`, `Tab`, `Badge`.

Rule: a template never styles its children's internals. A component never positions itself in the layout.

All toolbar bands are `Toolbar` (`templates/`) and all toolbar controls are `Button` (`components/`).
Sizes come from one token set in `src/haya/haya.css`:

| Token | Value | Meaning |
|---|---|---|
| `--haya-bar-pad` | 8px | global padding. Sides of top/bottom bars, top/bottom of side strips |
| `--haya-btn-h` | 24px | control height |
| `--haya-chrome-h` | 40px | derived: `btn-h + 2 × bar-pad`. Bar height = side strip width |
| `--haya-item-pad` | 4px | extra margin around side-strip controls |
| `--haya-icon` | 15px | icon size |

```
┌────────────────────────────────────────────────────────────────────┐
│ ● ● ●   1 2 3 4 5 6 7 8 9 0          + Terminal  Close  grid 4/5  │ titlebar  40px (ChromeBar top)
├────┬──────────────┬──────────────────────────────────┬────┬─────────┤
│    │ Explorer     │                                  │    │ Details │
│ ◧  │ 240px        │  stage (tiles, rounded)          │ ◨  │ 280px   │
│    │ no bg/border │                                  │    │ no bg   │
│    │              │                                  │    │         │
├────┴──────────────┴──────────────────────────────────┴────┴─────────┤
│ TERMINAL  Terminal 1                       2 windows   next        │ status    40px (ChromeBar bottom)
└────────────────────────────────────────────────────────────────────┘
  ◧ left strip  = ChromeBar edge="left"   (40px wide, same as chrome-h)
  ◨ right strip = ChromeBar edge="right"  (40px wide, same as chrome-h)
```

Rules:
1. Titlebar and status bar are 40px tall; side strips are 40px wide. Change `--haya-bar-pad` or `--haya-btn-h` and all four follow.
2. Panels (Explorer, Details) sit directly beside the stage with no border or background.
3. The stage is a rounded inset panel. Windows inside it are rounded and separated by the gap.
4. Traffic lights sit in the titlebar at `trafficLightPosition` in `tauri.conf.json` (y = 23 for a 40px titlebar).

## Component inventory

| Layer | File | Used for |
|---|---|---|
| template | `templates/AppShell.svelte` | window frame: titlebar, body, status bar, drag handling |
| template | `templates/Toolbar.svelte` | any toolbar band (top, bottom, left, right) |
| template | `templates/Stage.svelte` | rounded workspace panel |
| template | `templates/SidePanel.svelte` | borderless explorer or details panel beside the stage |
| component | `components/Button.svelte` | every button (variants: icon, text, chip) |
| component | `components/Icon.svelte` | every icon (geometry defined once, named) |
| component | `components/Tab.svelte` | tab in a strip |
| component | `components/Row.svelte` | sidebar row (head, group, item) |

## Strict rules (checked by hand before each commit)
1. No raw `<button>` or `<svg>` outside `components/` and `templates/`. Use `Button`, `Icon`, `Row`, `Tab`.
2. No layout markup in routes. `+page.svelte` only composes templates and state.
3. One definition per class: component styles live in `haya.css` under their component name.
4. Inline `style=` only for values computed at render time (tile positions, grid widths).
5. A file over about 150 lines is split before it grows further.

## Paint layers: who gets a style, who only wraps

One visual surface gets style. Every other layer only places its children and never paints.

**Paints (has background, border, radius, or colour):**
- `.haya-stage`: the workspace surface (`--panel`, `--haya-radius`).
- `.wm-window`: the only surface for a window. Owns the 1px border (`--line`, or `--haya-active` when focused), the radius, and the background (`--bg`). Its content is clipped by `overflow: hidden`, so content corners follow the radius without extra rules.
- `.haya-chrome`: the toolbar band (`--haya-frame`, height, padding).
- Controls: `.haya-btn`, `.haya-input`, `.haya-tab`, `.haya-select-trigger`.

**Wrappers (layout only, no paint):**
- `.wm-area`: where tiles are placed. Gaps come from `Tiles.svelte` (`GAP`), never from CSS.
- `.haya-slot`: `display: contents`, so it has no box of its own.
- `.terminal`: a sizing wrapper, no paint.
- `.terminal-screen`: the one allowed exception. It paints `#1E2020` (the xterm theme colour) only to cover the pixels that FitAddon leaves over. It has no radius and no border.

**Rules:**
1. A new component that needs a surface must reuse one of the paint layers above. Do not add a second card inside a window.
2. Spacing between items is a token, applied once at the layer that owns the gap. Never inset the same edge in two layers.
3. A wrapper that needs a border or radius is a sign that it should be the surface instead.

## Dividers
Every layout is a split tree; each split has one divider, and dragging it stores that split's ratio under its path.

**Dragging moves one divider only.** Ratios are shares of the parent area, so moving a divider would rescale everything
below it in the tree (a row of three would resize its second and third windows when the first divider moves).
`moveSeam` retargets every divider below the dragged one so it keeps its place on screen. Only the window across the
divider changes size. Ratios are stored at full precision, so a divider moves smoothly and never snaps to steps.

**How small a window may get.** A drag keeps every window at least `MIN_TILE_SHARE` (15%) of the area's width and height.
Each side of the divider keeps room for all the windows in it at that size, so a window pushed by the drag cannot be
squeezed below it either. When more windows sit in one line than that leaves room for (seven or more across), the minimum
shrinks just enough for them all to fit, with a little to spare to drag in. A stored ratio is only kept off the very edge
(`RATIO_FLOOR`, 1%).

**Grid.** Every window edge can move on its own. The grid is cut one way first (`gridFlow`):
- **rows**: the line between rows spans the whole grid, and each row has its own lines between columns.
- **cols**: the grid is cut into regions by column lines (`gridCuts`). Each region has its own lines between rows, so
  the windows above and below a line move independently of the other regions.

Dragging a spanning line turns the grid over (on the first real move, not on the press), so the part under the pointer
moves alone. A grid can turn over when it has at least 2 rows and its last row holds at least 2 windows.

**No window changes that is not across the dragged divider.** Turning over has to join lines that were in parts (each row
with its own column line, say), so it only happens when those parts are lined up to within `FLIP_ALIGN` (2% of the grid).
Then they join at the part nearest the grab. When they are further apart, the grid stays as it is and the spanning line
moves whole, until the lines are lined up again. The one exception is a short last row (3, 3, 2 windows): each of its
column lines goes to the nearest column line of the full rows, and a tie goes to the one nearer the grab. Those windows
change width to match, and that line then cuts the grid into regions. With one window in the last row there is no line to
match, so the grid stays cut by rows.
**Bands.** By columns, a column line would run through every row of the grid and move windows far from the one grabbed.
So when a column line is dragged and the grid cannot turn over, the grid is cut across its width (`gridBands`) at the row
line above the grabbed window and the one below it, each as near as possible that is lined up across the columns
(within `LOCALIZE_ALIGN`, 5%; the top and bottom of the grid and earlier cuts always are). The windows between them become a
band, and a column line runs only through its band. The row lines it joins keep the part beside the grabbed window, so the
windows there do not move and the ones in other columns shift a little to meet it. With no lined-up row line around the
grabbed window, the line moves through all the rows of its band.

Changing layout resets the flow, the cuts, and the bands.
