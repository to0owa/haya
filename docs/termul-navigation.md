# Termul navigation study

Source: `../termul` (shallow clone, commit 419bce3). Scope so far: tab model and tab bar.

## Tab model (`src/renderer/stores/workspace-store/types.ts`)

- `WorkspaceTab` is a discriminated union on `type` (terminal, editor, browser, git, agent-chat, git-history, diff, commit-diff, canvas).
- Every tab has a stable `id`, built by a helper per kind: `terminalTabId`, `editorTabId`, `diffTabId`. The same resource always yields the same id.
- `focusOrAddTab` (`slices/tabs.ts`): if a tab with that id exists in any pane, focus it. Otherwise add it to the target pane. This is how Termul avoids duplicate tabs.
- Tabs live in a pane tree (`tree.ts`). A leaf pane holds `tabs` and `activeTabId`, which allows splits later. `fullscreenPaneId` and `activePaneId` are tracked separately.

## Persistence (`lib/workspace-tab-kinds.ts`)

- `WORKSPACE_TAB_KIND_TRAITS` declares for each kind whether it is persisted. `satisfies Record<kind, …>` makes a new kind a compile error until its persistence is declared.
- Canvas is not persisted: its runtime is local state and it re-opens only when the user asks.

## Tab bar (`components/workspace/WorkspaceTabBar.tsx`, 632 lines)

- Overflow is measured against the bar width, and extra tabs go to a menu.
- Close goes through `closeWorkspaceTab` (`lib/workspace-tab-close.ts`). An editor with unsaved changes is only closed when it is idle (`closeFileIfIdle`).
- Bulk close: close all, close others, close to the right. Each target still goes through the per-tab close path.
- Drag and drop moves tabs between panes.
- Right-click opens `tab-context-menu.tsx`.

## New tab menu (`components/workspace/NewTabMenu.tsx`)

- One menu for every opener: New chat, terminal shells (default first), new browser tab, open canvas.
- Each opener calls a `add*Tab` store action. The menu does not build tabs itself.

## Mapping to Haya

| Termul | Haya today | Change |
|---|---|---|
| `WorkspaceTab` union | `WorkspaceTab` (terminal, db) in RootView | Add an id per tab: `terminal:<n>`, `table:<profile>:<schema>.<table>`, `query:<n>` |
| `focusOrAddTab` by id | Dedupe by title | Dedupe by the deterministic id |
| Pane tree | Flat list | Keep flat for now; split panes are later |
| Persistence traits | None | Add when tabs are saved between launches |
| Close guard for dirty editor | None | Ask before closing a query tab that is running or has unsaved text |
| Bulk close | None | Add close others and close to the right |
| `NewTabMenu` | `+` with New Terminal and New Query | Keep the same pattern |

## Next

1. Use deterministic ids for table and query tabs.
2. Add the close guard for running queries.
3. Add tab context menu (close, close others, close to the right).
4. Then study `CommandPalette.tsx` and `TitleBarShortcutsPopover.tsx`.
