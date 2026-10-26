# Haya layout

All toolbar bands are `ChromeBar` (`src/haya/chrome/`) and all controls are `ChromeButton`.
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
