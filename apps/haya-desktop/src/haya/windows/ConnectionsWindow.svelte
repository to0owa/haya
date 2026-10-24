<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { notify, notifyDesktop } from "../notify.svelte";
  import { openTable } from "../wm/store.svelte";

  type Profile = { name: string; dialect: string; host: string; port: number; user: string; database: string };
  type Schema = { name: string; tables: string[] | null; expanded: boolean };

  let profiles = $state<Profile[]>([]);
  let active = $state<string | null>(null);
  let schemas = $state<Schema[]>([]);
  let openConnections = $state(true);

  onMount(async () => {
    profiles = await invoke<Profile[]>("db_profiles");
  });

  async function connect(name: string) {
    try {
      const names = await invoke<string[]>("db_connect", { name });
      schemas = names.map((n) => ({ name: n, tables: null, expanded: false }));
      active = name;
      notify("success", `Connected to ${name}`);
      notifyDesktop("Haya", `Connected to ${name}`);
    } catch (error) {
      notify("error", `${name}: ${error}`);
      notifyDesktop("Connection failed", `${name}: ${error}`);
    }
  }

  async function toggle(index: number) {
    const node = schemas[index];
    node.expanded = !node.expanded;
    if (node.expanded && node.tables === null) {
      node.tables = await invoke<string[]>("db_tables", { schema: node.name });
    }
  }

  function initials(name: string) {
    return name.slice(0, 2).toUpperCase();
  }
</script>

<div class="side-scroll">
  <div class="side-list-content">
    <div class="project-list">
      <div class="project-group selected">
        <button class="project-head selected" onclick={() => (openConnections = !openConnections)}>
          <span class="project-icon">DB</span>
          <span class="project-name">Connections</span>
          <span class="project-count">{profiles.length}</span>
          <svg class="project-chevron" class:open={openConnections} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
        {#if openConnections}
          <div class="project-tasks">
            {#if profiles.length === 0}<div class="project-empty">No connections yet.</div>{/if}
            {#each profiles as profile (profile.name)}
              <button class="side-item task-row" class:selected={active === profile.name} onclick={() => connect(profile.name)}>
                <span class="project-icon small">{initials(profile.name)}</span>
                <span class="side-item-title">{profile.name}</span>
                <span class="side-item-meta">{profile.dialect === "cratedb" ? "CrateDB" : "Postgres"}</span>
              </button>
            {/each}
            {#if active}
              {#each schemas as schema, index (schema.name)}
                <div class="task-group">
                  <button class="task-group-head" type="button" aria-expanded={schema.expanded} onclick={() => toggle(index)}>
                    <span>{schema.name}</span>
                    <svg class="project-chevron" class:open={schema.expanded} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                  </button>
                  {#if schema.expanded}
                    {#each schema.tables ?? [] as table (table)}
                      <button class="side-item task-row table-row" onclick={() => openTable(schema.name, table)}>
                        <span class="side-item-title">{table}</span>
                      </button>
                    {/each}
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
