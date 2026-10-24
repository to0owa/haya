<script lang="ts">
  import SidebarWrapper from "../mestero/lib/SidebarWrapper.svelte";
  import Terminal from "../haya/Terminal.svelte";
  import Grid from "../haya/Grid.svelte";
  import Sidebar from "../haya/Sidebar.svelte";
  import Inspector from "../haya/Inspector.svelte";

  type Mode = "expanded" | "compact" | "mini";
  let sidebarWidth = $state(260);
  let sidebarMode = $state<Mode>("expanded");
  let inspectorWidth = $state(300);
  let inspectorMode = $state<Mode>("expanded");
  let inspectorOpen = $state(false);

  let section = $state<"terminal" | "database">("terminal");
  let terminals = $state<{ id: number; title: string }[]>([{ id: 1, title: "Terminal 1" }]);
  let tables = $state<{ id: number; title: string; schema: string; table: string }[]>([]);
  let activeId = $state<number>(1);
  let nextId = 2;
  let details = $state<{ columns: string[]; row: (string | null)[] } | null>(null);
  let plusOpen = $state(false);
  let history = $state<number[]>([1]);
  let historyIndex = $state(0);

  function focusTab(id: number) {
    if (history[historyIndex] === id) {
      activeId = id;
      return;
    }
    history = [...history.slice(0, historyIndex + 1), id];
    historyIndex = history.length - 1;
    activeId = id;
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex -= 1;
      activeId = history[historyIndex];
    }
  }

  function goForward() {
    if (historyIndex < history.length - 1) {
      historyIndex += 1;
      activeId = history[historyIndex];
    }
  }

  function onKey(event: KeyboardEvent) {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key === "t") { event.preventDefault(); newTerminal(); }
    else if (event.key === "w") { event.preventDefault(); closeTab(activeId); }
    else if (event.key === "[") { event.preventDefault(); goBack(); }
    else if (event.key === "]") { event.preventDefault(); goForward(); }
    else if (event.key === "b") { event.preventDefault(); toggleSidebar(); }
  }

  function toggleSidebar() {
    sidebarMode = sidebarMode === "mini" ? "expanded" : "mini";
  }

  let active = $derived(
    terminals.find((t) => t.id === activeId)?.title ?? tables.find((t) => t.id === activeId)?.title ?? "",
  );

  function newTerminal() {
    const id = nextId++;
    terminals = [...terminals, { id, title: `Terminal ${terminals.length + 1}` }];
    focusTab(id);
    section = "terminal";
    plusOpen = false;
  }

  function openTable(schema: string, table: string) {
    const title = `${schema}.${table}`;
    const existing = tables.find((t) => t.title === title);
    if (existing) {
      focusTab(existing.id);
    } else {
      const id = nextId++;
      tables = [...tables, { id, title, schema, table }];
      focusTab(id);
    }
    section = "database";
  }

  function closeTab(id: number) {
    if (terminals.some((t) => t.id === id)) {
      if (terminals.length === 1) return;
      terminals = terminals.filter((t) => t.id !== id);
    } else {
      tables = tables.filter((t) => t.id !== id);
    }
    history = history.filter((h) => h !== id);
    historyIndex = Math.min(historyIndex, Math.max(0, history.length - 1));
    if (activeId === id) focusTab(history[historyIndex] ?? terminals[0]?.id ?? tables[0]?.id ?? 0);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="app">
  <div
    class="workspace"
    class:is-sidebar-expanded={sidebarMode === "expanded"}
    class:is-sidebar-compact={sidebarMode === "compact"}
    class:is-sidebar-hidden={sidebarMode === "mini"}
    style={`--sidebar-live-width: ${sidebarWidth}px; --sidebar-progress: ${Math.max(0, Math.min(1, sidebarWidth / 56))}; --inspector-live-width: ${inspectorWidth}px; --inspector-progress: ${Math.max(0, Math.min(1, inspectorWidth / 56))}; --editor-min-width: 360px`}
  >
    <SidebarWrapper side="left" bind:width={sidebarWidth} bind:mode={sidebarMode} minWidth={200} maxWidth={360} compactWidth={56}>
      <Sidebar
        {section}
        terminals={terminals}
        activeTerminal={terminals.some((t) => t.id === activeId) ? activeId : null}
        onSelectTerminal={(id) => { focusTab(id); section = "terminal"; }}
        onNewTerminal={newTerminal}
        onOpenTable={openTable}
        onSection={(next) => (section = next)}
      />
    </SidebarWrapper>

    <div class="workspace-center" id="workspace-center">
      <main class="main">
        <section class="surface-head">
          <div class="surface-heading">
            <div class="surface-title">{active}</div>
            <span class="surface-state">· {section === "terminal" ? "Local shell" : "Database"}</span>
          </div>
          <div class="surface-tools chrome-controls" aria-label="Navigation">
            <button class="chrome-control" aria-label="Back" title="Back (⌘[)" disabled={historyIndex === 0} onclick={goBack}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <button class="chrome-control" aria-label="Forward" title="Forward (⌘])" disabled={historyIndex >= history.length - 1} onclick={goForward}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </div>
          <div class="surface-tools chrome-controls" aria-label="Panels">
            <button class="chrome-control" aria-label={sidebarMode === "mini" ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={sidebarMode !== "mini"} title="Toggle sidebar (⌘B)" onclick={toggleSidebar}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="translate(24 0) scale(-1 1)"><path class="panel-icon-fill" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4Z" stroke="none" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></g></svg>
            </button>
            <button class="chrome-control" aria-label={inspectorOpen ? "Close details" : "Open details"} aria-pressed={inspectorOpen} title="Details" onclick={() => (inspectorOpen = !inspectorOpen)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="panel-icon-fill" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4Z" stroke="none" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>
            </button>
          </div>
        </section>

        <div class="haya-tabs" role="tablist">
          {#each terminals as terminal (terminal.id)}
            <button class="haya-tab" role="tab" aria-selected={activeId === terminal.id} onclick={() => { activeId = terminal.id; section = "terminal"; }}>
              {terminal.title}
            </button>
          {/each}
          {#each tables as tab (tab.id)}
            <button class="haya-tab" role="tab" aria-selected={activeId === tab.id} onclick={() => { focusTab(tab.id); section = "database"; }}>
              {tab.title}
              <span class="haya-tab-close" role="button" tabindex="-1" onclick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</span>
            </button>
          {/each}
          <div class="haya-plus">
            <button class="haya-tab haya-plus-btn" aria-label="New tab" aria-expanded={plusOpen} onclick={() => (plusOpen = !plusOpen)}>+</button>
            {#if plusOpen}
              <div class="haya-menu" role="menu">
                <button class="haya-menu-item" role="menuitem" onclick={newTerminal}>New Terminal <kbd>⌘T</kbd></button>
                <button class="haya-menu-item" role="menuitem" disabled>New Query <span class="haya-soon">soon</span></button>
              </div>
            {/if}
          </div>
        </div>

        <div class="haya-content">
          {#each terminals as terminal (terminal.id)}
            <div class="haya-pane" class:hidden={activeId !== terminal.id}><Terminal /></div>
          {/each}
          {#each tables as tab (tab.id)}
            <div class="haya-pane" class:hidden={activeId !== tab.id}>
              <Grid schema={tab.schema} table={tab.table} onselect={(columns, row) => { details = { columns, row }; inspectorOpen = true; }} />
            </div>
          {/each}
        </div>
      </main>
    </div>

    {#if inspectorOpen}
      <SidebarWrapper side="right" bind:width={inspectorWidth} bind:mode={inspectorMode} minWidth={240} maxWidth={420} compactWidth={56}>
        <Inspector columns={details?.columns ?? null} row={details?.row ?? null} />
      </SidebarWrapper>
    {/if}
  </div>
</div>

<style>
  :global(body) { overflow: hidden; }
  .haya-content { flex: 1; min-height: 0; position: relative; }
  .haya-pane { position: absolute; inset: 0; }
  .haya-pane.hidden { display: none; }
  .haya-tab-close { margin-left: 6px; color: var(--quiet); }
  .haya-tab-close:hover { color: var(--text); }
  .side-action.is-on { background: var(--selected); color: var(--text); }
  .haya-plus { position: relative; display: flex; align-items: stretch; }
  .haya-plus-btn { padding: 0 var(--space-2); font-size: 16px; }
  .haya-menu { position: absolute; top: 100%; left: 0; z-index: 10; min-width: 200px; padding: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--popup); box-shadow: 0 8px 24px #0006; display: flex; flex-direction: column; }
  .haya-menu-item { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: 6px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text); font-size: 12px; text-align: left; }
  .haya-menu-item:hover:not(:disabled) { background: var(--hover); }
  .haya-menu-item:disabled { color: var(--quiet); }
  .haya-soon { font-size: 10px; color: var(--quiet); }
  kbd { font: inherit; font-size: 11px; color: var(--quiet); }
</style>
