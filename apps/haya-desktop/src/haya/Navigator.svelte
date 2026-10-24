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

<div class="haya-nav">
  <div class="haya-label">Connections</div>
  {#each profiles as profile (profile.name)}
    <button class="haya-row" aria-selected={active === profile.name} onclick={() => connect(profile.name)}>
      {profile.name} · {profile.dialect === "cratedb" ? "CrateDB" : "PostgreSQL"}
    </button>
  {/each}
  {#if status}<div class="haya-status-line" class:is-error={status?.startsWith("connect") || status?.includes("error")}>{status}</div>{/if}

  {#if active}
    <div class="haya-label">Schemas</div>
    {#each schemas as schema, index (schema.name)}
      <button class="haya-row" onclick={() => toggle(index)}>
        {schema.expanded ? "▾" : "▸"} {schema.name}
      </button>
      {#if schema.expanded}
        {#each schema.tables ?? [] as table (table)}
          <button class="haya-row is-table" onclick={() => onOpenTable(schema.name, table)}>{table}</button>
        {/each}
      {/if}
    {/each}
  {/if}
</div>


