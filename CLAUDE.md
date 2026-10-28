# haya

Desktop workspace app. A Tauri 2 shell (`apps/haya-desktop`, Svelte 5 + SvelteKit + Vite 8) with a Rust terminal/PTY crate (`crates/haya-pty`), a database client crate (`crates/haya-db`), and a terminal app (`apps/haya-term`). Cargo workspace at the repo root; bun for the frontend.

## Working with Claude Code (slash commands)

Five slash commands in [.claude/commands/](.claude/commands/) wrap an "elephant/goldfish" workflow inspired by [this article](https://drensin.medium.com/elephants-goldfish-and-the-new-golden-age-of-software-engineering-c33641a48874): the "elephant" is the working session with full context (this CLAUDE.md, repo state, conversation history); the "goldfish" is a fresh subagent with no prior context. For implementation work the goldfish stress-tests a problem/design doc or a diff. For brainstorming and PRD writing, multiple goldfish run in parallel with different lenses to generate divergent ideas or research findings the elephant synthesizes.

| Command | When to use |
|---|---|
| `/eg-brainstorm <rough idea>` | Early-stage concept design. Multiple goldfish in parallel (technical / business / UX / contrarian / market research), web search optional, elephant synthesizes a concepts brief. All questions via `AskUserQuestion`. Hands off to `/eg-prd` or `/eg-new-feature` if you pick a direction. |
| `/eg-prd <idea \| feature description>` | Build a thorough PRD: codebase grounding → structured gap-filling via `AskUserQuestion` → deep research with parallel goldfish (web + optional Chrome MCP for logged-in sources) → synthesized PRD. Saves to `docs/prds/`, persists durable nuggets to memory, and/or hands off to `/eg-new-feature`. |
| `/eg-fix-bug <description \| #issue \| URL>` | Bug fix flow: problem doc → goldfish diagnosis check → failing test → fix → `/eg-precommit-review` → test gate. Skips ceremony for trivial diffs. |
| `/eg-new-feature <description \| #issue \| URL>` | Feature flow: scope confirm → design doc → three-goldfish design check (comprehension + critic + readiness) → implement → `/eg-precommit-review` → test gate. The design rubric covers the Tauri IPC contract, where data is persisted (config, database, Keychain), and theme tokens. |
| `/eg-precommit-review` | Local independent-review loop on the pending diff (`cargo fmt`, `cargo clippy`, `bun run check`, `bun test`, `cargo test`). Replaces back-and-forth with PR bots — by the time the PR opens, the substantive review is already settled. |

You give a one-liner; Claude writes the doc back at you. You don't author docs by hand. Examples:

```
/eg-brainstorm what if the command palette could search open terminal output
/eg-prd a per-workspace layout preset you can save and restore
/eg-fix-bug the tab strip overflow arrows stop working after closing the last tab
/eg-fix-bug #123
/eg-new-feature add a keyboard shortcut to rename the active tab
/eg-precommit-review
```

Browser validation: for UI work, run `cd apps/haya-desktop && bun run tauri dev` and drive the native window. The Vite page at `http://localhost:1420` renders on its own, but Tauri IPC (PTY, database, Keychain) is unavailable there, so use the native window for anything that touches those.

Each command stops short of committing. Authorize the commit explicitly when ready. Commit messages follow `git log`: imperative subject without a period, a bullet body, and the `Co-Authored-By` trailer the repo already uses.

**These commands are interactive by design.** `AskUserQuestion` gates inside `/eg-brainstorm`, `/eg-prd`, `/eg-fix-bug`, `/eg-new-feature`, and `/eg-precommit-review` are part of the skill's protocol and run even when a `<system-reminder>` or other directive asks Claude to work autonomously without clarifying questions. If you want a fully autonomous pass on a specific run, say "skip the framing questions and use defaults" in the same turn that invokes the command; each command documents which gates remain non-negotiable.

## Commands

- Run the app: `cd apps/haya-desktop && bun run tauri dev` (Vite on `http://localhost:1420`)
- Typecheck: `cd apps/haya-desktop && bun run check`
- Frontend tests: `cd apps/haya-desktop && bun test`
- Rust tests: `cargo test --workspace`
- Rust lint: `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets`

## Docs

- `docs/layout.md` — window and tile layout rules, paint layers
- `docs/design-system.md` — tokens and components
- `docs/projects.md` — project model
- `docs/termul-navigation.md` — tab and workspace model
- `docs/TODO.md` — open work
