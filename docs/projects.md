# Projects

A project is a saved context: its workspace layout, its windows, and the folder or
connection it uses. Projects are switched from the bottom-left corner, like the project
pickers in Zed and Termul. Examples: two office projects, three freelance projects.

## What is saved, and where

Saved on disk, small, forever:
- `~/Library/Application Support/Haya/projects/<id>/project.json`: name, group, folder,
  database profile, the 10 workspaces, and each workspace's layout.
- `projects/<id>/windows.json`: a description of every window. For a terminal: folder and
  start command. For a table: schema, table, and filters. For a browser (later): tab URLs,
  titles, and scroll positions.

Not saved:
- Live shells, database connections, query results, and the grid's rows in memory.
- Cookies and login sessions. Those stay in the webview's own store (see Browser below).

## Opening a project

Reading the two small files is enough to show the layout. Live sessions are then rebuilt:
- A terminal opens a new shell in the saved folder. Scrollback is restored only if it was
  saved (optional, capped at 2,000 lines per terminal).
- A table reconnects to its profile and reads the page again.

## Idle timer

- The timer starts when a project is left, and is measured from the last time it was seen.
- After 1 hour (setting: 15 min, 1 h, 4 h, never) the project is marked idle, and a toast
  appears. Nothing is closed automatically, except under memory pressure (see OOM).

## The toast

It shows the project name, the number of live sessions, and what they use:

    Project office-a has not been open for 1 hour
    2.1 GB memory · 40% CPU
    Terminal 2: 1.6 GB (npm run dev)
    Browser: 480 MB (3 tabs)
    [Look]  [Keep]  [Kill]

- **Look**: switches to the project. A small bar in the corner of the window then offers
  **Keep** and **Close** for that project.
- **Keep**: restarts the 1-hour timer. Nothing else changes.
- **Kill**: closes every live session in the project. If a process or download is still
  running, Kill asks once more and names what will stop.

No option is chosen automatically. The toast is a reminder, not a decision.

## Measuring usage

- Terminal: sum of memory and CPU for the shell process and its children, read by PID.
  CPU needs two samples a few seconds apart, so it appears after a short delay.
- Database: connection count and the memory held by the last result, read in Rust.
- Browser: total memory of the WebKit processes used by the project. These are shared
  between webviews, so the browser shows a project total, not a per-tab figure.

## Busy sessions

A session that is busy is never closed without the user's choice:
- Terminal: a child process is still running (other than the shell itself).
- Browser: a download is in progress, or media is playing in a tab.

## Out of memory

When the system reports memory pressure, Haya may close the idle project that has been
unused the longest. It shows a notification afterwards, naming the project and what was
closed. This is the only automatic close.

## Browser data

Each project gets its own WKWebView data store (`dataStoreIdentifier`), so logins do not
mix between projects. The store has a size cap per project (default 500 MB). Older cache
is removed when the cap is reached. Preferences and each project offer "Clear browsing
data".

## Build order

1. `project.json` and `windows.json`, with a default project made from the current layout.
2. Project switcher in the bottom-left corner, with search and groups.
3. Idle timer, toast, and the Look, Keep, Kill actions.
4. Resource usage for terminals, then the toast's numbers.
5. Busy detection and the Kill confirmation.
6. Browser window, its data store, and its cap.
