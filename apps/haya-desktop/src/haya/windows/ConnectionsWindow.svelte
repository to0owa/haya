<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { notify, notifyDesktop } from "../notify.svelte";
  import { openTable } from "../wm/store.svelte";
  import Row from "../components/Row.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import ConnectionForm from "./ConnectionForm.svelte";

  type Profile = { name: string; dialect: string; host: string; port: number; user: string; database: string };
  type Schema = { name: string; tables: string[] | null; expanded: boolean };

  let profiles = $state<Profile[]>([]);
  let active = $state<string | null>(null);
  let schemas = $state<Schema[]>([]);
  let openConnections = $state(true);
  let adding = $state(false);

  async function reload() {
    profiles = await invoke<Profile[]>("db_profiles");
    adding = false;
  }

  onMount(reload);

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
    <div class="haya-conn-head">
      <Row kind="head" label="Connections" badge={String(profiles.length)} expanded={openConnections} onclick={() => (openConnections = !openConnections)} />
      <Button variant="icon" label="New connection" active={adding} onclick={() => (adding = !adding)}>
        <Icon name="plus" />
      </Button>
    </div>
    {#if adding}
      <ConnectionForm onsaved={reload} oncancel={() => (adding = false)} />
    {:else if openConnections}
      {#if profiles.length === 0}<EmptyState text="No connections yet. Add one in Settings." />{/if}
      {#each profiles as profile (profile.name)}
        <Row kind="item" label={profile.name} meta={profile.dialect === "cratedb" ? "CrateDB" : "Postgres"} selected={active === profile.name} onclick={() => connect(profile.name)}>
          {initials(profile.name)}
        </Row>
      {/each}
      {#if active}
        {#each schemas as schema, index (schema.name)}
          <Row kind="group" label={schema.name} expanded={schema.expanded} onclick={() => toggle(index)} />
          {#if schema.expanded}
            {#each schema.tables ?? [] as table (table)}
              <Row kind="item" label={table} onclick={() => openTable(schema.name, table)} />
            {/each}
          {/if}
        {/each}
      {/if}
    {/if}
  </div>
</div>
