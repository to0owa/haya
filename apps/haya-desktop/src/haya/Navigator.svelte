<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  type Profile = { name: string; dialect: string; host: string; port: number; user: string; database: string };

  let { onOpenTable }: { onOpenTable: (schema: string, table: string) => void } = $props();

  let profiles = $state<Profile[]>([]);
  let active = $state<string | null>(null);
  let schemas = $state<{ name: string; tables: string[] | null; expanded: boolean }[]>([]);
  let status = $state<string | null>(null);

  onMount(async () => {
    profiles = await invoke<Profile[]>("db_profiles");
  });

  async function connect(name: string) {
    status = `Connecting to ${name}…`;
    try {
      const names = await invoke<string[]>("db_connect", { name });
      schemas = names.map((n) => ({ name: n, tables: null, expanded: false }));
      active = name;
      status = null;
    } catch (error) {
      status = String(error);
    }
  }

  async function toggle(index: number) {
    const node = schemas[index];
    node.expanded = !node.expanded;
    if (node.expanded && node.tables === null) {
      node.tables = await invoke<string[]>("db_tables", { schema: node.name });
    }
  }
</script>

<div class="nav">
  <div class="label">Connections</div>
  {#each profiles as profile (profile.name)}
    <button class="row" class:selected={active === profile.name} onclick={() => connect(profile.name)}>
      {profile.name} · {profile.dialect === "cratedb" ? "CrateDB" : "PostgreSQL"}
    </button>
  {/each}
  {#if status}<div class="status">{status}</div>{/if}

  {#if active}
    <div class="label">Schemas</div>
    {#each schemas as schema, index (schema.name)}
      <button class="row" onclick={() => toggle(index)}>
        {schema.expanded ? "▾" : "▸"} {schema.name}
      </button>
      {#if schema.expanded}
        {#each schema.tables ?? [] as table (table)}
          <button class="row table" onclick={() => onOpenTable(schema.name, table)}>{table}</button>
        {/each}
      {/if}
    {/each}
  {/if}
</div>

<style>
  .nav { display: flex; flex-direction: column; gap: 2px; padding: 8px; }
  .label { padding: 12px 8px 4px; font-size: 11px; color: var(--quiet, #8e8e93); }
  .row { text-align: left; background: none; border: 0; padding: 6px 8px; border-radius: 6px; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
  .row:hover { background: var(--hover, #2f2f34); }
  .row.selected { background: var(--control, #37373c); }
  .row.table { padding-left: 22px; font-size: 12px; }
  .status { padding: 6px 8px; color: #ff6b6b; font-size: 12px; }
</style>
