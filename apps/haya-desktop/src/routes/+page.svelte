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

<div class="shell">
  <SidebarWrapper side="left" bind:width bind:mode bind:open>
    <Navigator onOpenTable={openTable} />
  </SidebarWrapper>

  <main class="main">
    <div class="strip">
      <button class="tab" class:selected={activeTab === "terminal"} onclick={() => (activeTab = "terminal")}>Terminal 1</button>
      {#each openTables as tab (tab.id)}
        <button class="tab" class:selected={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>{tab.title}</button>
      {/each}
    </div>
    <div class="content">
      <div class="pane" class:hidden={activeTab !== "terminal"}><Terminal /></div>
      {#each openTables as tab (tab.id)}
        <div class="pane" class:hidden={activeTab !== tab.id}>
          <Grid schema={tab.schema} table={tab.table} />
        </div>
      {/each}
    </div>
  </main>
</div>

<style>
  .shell { display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #1c1c1e; color: #ececec; }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .strip { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid #2e2e33; }
  .tab { background: none; border: 0; color: #8e8e93; padding: 4px 10px; border-radius: 6px; font: inherit; font-size: 12px; cursor: pointer; }
  .tab.selected { background: #37373c; color: #ececec; }
  .content { flex: 1; min-height: 0; position: relative; }
  .pane { position: absolute; inset: 0; }
  .pane.hidden { display: none; }
  .placeholder { padding: 16px; color: #8e8e93; font-size: 13px; }
</style>
