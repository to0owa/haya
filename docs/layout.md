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
