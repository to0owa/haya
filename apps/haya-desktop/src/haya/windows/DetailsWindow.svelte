<script lang="ts">
  import Inspector from "../Inspector.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import PanelHeader from "../components/PanelHeader.svelte";
  import RowForm, { type Cell } from "../details/RowForm.svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { notify, notifyDesktop } from "../notify.svelte";
  import { wm } from "../wm/store.svelte";

  // Primary keys are looked up once per table and then reused.
  const keyCache = new Map<string, string[]>();
  let keyColumns = $state<string[]>([]);

  $effect(() => {
    const d = wm.details;
    if (!d) return;
    const id = `${d.schema}.${d.table}`;
    const cached = keyCache.get(id);
    if (cached) {
      keyColumns = cached;
      return;
    }
    invoke<string[]>("db_primary_key", { schema: d.schema, table: d.table })
      .then((keys) => {
        keyCache.set(id, keys);
        keyColumns = keys;
      })
      .catch(() => (keyColumns = []));
  });

  function cellsOf(columns: string[], row: (string | null)[]): Cell[] {
    return columns.map((column, i) => ({ column, value: row[i] }));
  }

  async function save(changes: Cell[]) {
    const d = wm.details;
    if (!d) return;
    try {
      if (wm.detailsMode === "add") {
        await invoke("db_insert_row", { schema: d.schema, table: d.table, values: changes });
        notify("success", `Inserted a row into ${d.table}`);
        notifyDesktop("Haya", `Inserted a row into ${d.table}`);
        wm.detailsMode = "view";
      } else {
        // The key comes from the row as it was read, so editing a key column does not lose the row.
        const key = cellsOf(d.columns, d.row).filter((c) => keyColumns.includes(c.column));
        await invoke("db_update_row", { schema: d.schema, table: d.table, key, changes });
        const next = [...d.row];
        for (const change of changes) next[d.columns.indexOf(change.column)] = change.value;
        wm.details = { ...d, row: next };
        notify("success", `Saved ${d.table}`);
        wm.detailsMode = "view";
      }
    } catch (error) {
      notify("error", `${error}`);
    }
  }

  function cancel() {
    wm.detailsMode = "view";
  }

  const canEdit = $derived(wm.details !== null && keyColumns.length > 0);
</script>

<PanelHeader title="Details">
  {#snippet actions()}
    {#if wm.detailsMode === "view" && wm.details}
      <Button variant="icon" label={canEdit ? "Edit row" : "This table has no primary key, so rows are read only"} disabled={!canEdit} onclick={() => (wm.detailsMode = "edit")}>
        <Icon name="pencil" />
      </Button>
    {/if}
  {/snippet}
</PanelHeader>

{#if wm.detailsMode === "view" || !wm.details}
  <Inspector columns={wm.details?.columns ?? null} row={wm.details?.row ?? null} />
{:else}
  <div class="haya-fields">
    <RowForm
      mode={wm.detailsMode}
      columns={wm.details.columns}
      values={wm.detailsMode === "edit" ? wm.details.row : wm.details.columns.map(() => null)}
      {keyColumns}
      onsubmit={save}
      oncancel={cancel}
    />
  </div>
{/if}
