<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { notify, notifyDesktop } from "./notify.svelte";

  type Profile = { name: string; dialect: string; host: string; port: number; user: string; database: string };
  type Schema = { name: string; tables: string[] | null; expanded: boolean };

  let {
    section,
    terminals,
    activeTerminal,
    onSelectTerminal,
    onNewTerminal,
    onOpenTable,
    onSection,
  }: {
    section: "terminal" | "database";
    terminals: { id: number; title: string }[];
    activeTerminal: number | null;
    onSelectTerminal: (id: number) => void;
    onNewTerminal: () => void;
    onOpenTable: (schema: string, table: string) => void;
    onSection: (section: "terminal" | "database") => void;
  } = $props();

  let profiles = $state<Profile[]>([]);
  let active = $state<string | null>(null);
  let schemas = $state<Schema[]>([]);
  let openTerminals = $state(true);
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

<div class="side-head">
  <div class="side-head-top">
    <div class="sidebar-brand" role="img" aria-label="Haya"><span class="haya-wordmark">Haya</span></div>
    <div class="side-head-actions">
      <button class="side-action" title="New terminal" aria-label="New terminal" onclick={onNewTerminal}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  </div>
</div>

<div class="side-scroll">
  <div class="side-list-content">
    <div class="project-list">
      <div class="project-group" class:selected={section === "terminal"}>
        <button class="project-head" class:selected={section === "terminal"} onclick={() => (openTerminals = !openTerminals)}>
          <span class="project-icon">&gt;_</span>
          <span class="project-name">Terminals</span>
          <span class="project-count">{terminals.length}</span>
          <svg class="project-chevron" class:open={openTerminals} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
        {#if openTerminals}
          <div class="project-tasks">
            {#each terminals as terminal (terminal.id)}
              <button class="side-item task-row" class:selected={activeTerminal === terminal.id} onclick={() => onSelectTerminal(terminal.id)}>
                <span class="task-icon"><span class="task-dot"></span></span>
                <span class="side-item-title">{terminal.title}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="project-group" class:selected={section === "database"}>
        <button class="project-head" class:selected={section === "database"} onclick={() => (openConnections = !openConnections)}>
          <span class="project-icon">DB</span>
          <span class="project-name">Connections</span>
          <span class="project-count">{profiles.length}</span>
          <svg class="project-chevron" class:open={openConnections} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
        {#if openConnections}
          <div class="project-tasks">
            {#if profiles.length === 0}<div class="project-empty">No connections yet.</div>{/if}
            {#each profiles as profile (profile.name)}
              <button class="side-item task-row" class:selected={active === profile.name} onclick={() => { onSection("database"); connect(profile.name); }}>
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
                      <button class="side-item task-row table-row" onclick={() => onOpenTable(schema.name, table)}>
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

<nav class="subnav" aria-label="Haya views">
  <button class="subtab" class:active={section === "terminal"} onclick={() => onSection("terminal")}>
    <span class="subtab-label">Terminal</span>
  </button>
  <button class="subtab" class:active={section === "database"} onclick={() => onSection("database")}>
    <span class="subtab-label">Database</span>
  </button>
</nav>
