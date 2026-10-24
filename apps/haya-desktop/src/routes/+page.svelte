<script lang="ts">
  import SidebarWrapper from "../mestero/lib/SidebarWrapper.svelte";
  import Terminal from "../haya/Terminal.svelte";
  import Navigator from "../haya/Navigator.svelte";
  import Grid from "../haya/Grid.svelte";

  let width = $state(260);
  let mode = $state<"expanded" | "compact" | "mini">("expanded");
  let open = $state(true);

  let openTables = $state<{ id: number; title: string; schema: string; table: string }[]>([]);
  let activeTab = $state<"terminal" | number>("terminal");
  let nextId = 1;

  function openTable(schema: string, table: string) {
    const title = `${schema}.${table}`;
    const existing = openTables.find((t) => t.title === title);
    if (existing) {
      activeTab = existing.id;
      return;
    }
    const id = nextId++;
    openTables = [...openTables, { id, title, schema, table }];
    activeTab = id;
  }
</script>

<div class="haya-shell">
  <SidebarWrapper side="left" bind:width bind:mode bind:open>
    <Navigator onOpenTable={openTable} />
  </SidebarWrapper>

  <main class="haya-main">
    <div class="haya-tabs" role="tablist">
      <button class="haya-tab" role="tab" aria-selected={activeTab === "terminal"} onclick={() => (activeTab = "terminal")}>Terminal 1</button>
      {#each openTables as tab (tab.id)}
        <button class="haya-tab" role="tab" aria-selected={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>{tab.title}</button>
      {/each}
    </div>
    <div class="haya-content">
      <div class="haya-pane" class:hidden={activeTab !== "terminal"}><Terminal /></div>
      {#each openTables as tab (tab.id)}
        <div class="haya-pane" class:hidden={activeTab !== tab.id}>
          <Grid schema={tab.schema} table={tab.table} />
        </div>
      {/each}
    </div>
  </main>
</div>

<style>
  :global(body) { overflow: hidden; }
  .haya-content { flex: 1; min-height: 0; position: relative; }
  .haya-pane { position: absolute; inset: 0; }
  .haya-pane.hidden { display: none; }
</style>
