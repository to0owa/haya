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

  let active = $derived(
    terminals.find((t) => t.id === activeId)?.title ?? tables.find((t) => t.id === activeId)?.title ?? "",
  );

  function newTerminal() {
    const id = nextId++;
    terminals = [...terminals, { id, title: `Terminal ${terminals.length + 1}` }];
    activeId = id;
    section = "terminal";
  }

  function openTable(schema: string, table: string) {
    const title = `${schema}.${table}`;
    const existing = tables.find((t) => t.title === title);
    if (existing) {
      activeId = existing.id;
    } else {
      const id = nextId++;
      tables = [...tables, { id, title, schema, table }];
      activeId = id;
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
    if (activeId === id) activeId = terminals[0]?.id ?? tables[0]?.id ?? 0;
  }
</script>

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
        onSelectTerminal={(id) => { activeId = id; section = "terminal"; }}
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
          <div class="surface-actions">
            <button class="side-action" class:is-on={inspectorOpen} title="Details" aria-label="Toggle details" onclick={() => (inspectorOpen = !inspectorOpen)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M14 5v14" /></svg>
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
            <button class="haya-tab" role="tab" aria-selected={activeId === tab.id} onclick={() => { activeId = tab.id; section = "database"; }}>
              {tab.title}
              <span class="haya-tab-close" role="button" tabindex="-1" onclick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</span>
            </button>
          {/each}
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
</style>
