# Haya design system

Source of tokens: `src/mestero/app.css` (Mestero). Haya-specific tokens live in `apps/haya-desktop/src/haya/haya.css`.

## Surfaces
| Token | Value | Used by |
|---|---|---|
| `--haya-frame` (= `--chrome`) | `#1E2020` | titlebar, side gutters, status bar, app background |
| `--haya-stage` (= `--panel`) | `#111818` | the workspace stage (rounded inset panel) |
| `--haya-window` (= `--raised`) | `#151d1c` | each window inside the stage |

## Rules
1. **One frame color.** Everything outside the workspace (titlebar, gutters, status bar) uses `--haya-frame`.
2. **No borders.** Separation comes from the color steps above and the radius (`--haya-radius`, 12px).
3. **Focus** is shown by the active tab underline (`--accent`), not an outline or border.
4. **Toolbars** live in the titlebar (top) and the status bar (bottom). Side toolbars use the gutters (`haya-edge-left/right`).
5. **Spacing** follows `--space-*` and `--control-size` (36px) for toolbar rows.
