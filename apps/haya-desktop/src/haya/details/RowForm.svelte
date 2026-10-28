<script lang="ts">
  import Button from "../components/Button.svelte";

  // One form for editing a row and adding one. Edit sends only the columns that changed.
  // Add sends only the columns that were filled in, so database defaults apply to the rest.
  export interface Cell {
    column: string;
    value: string | null;
  }

  let {
    mode,
    columns,
    values,
    keyColumns,
    onsubmit,
    oncancel,
  }: {
    mode: "edit" | "add";
    columns: string[];
    values: (string | null)[];
    keyColumns: string[];
    onsubmit: (changes: Cell[]) => Promise<void>;
    oncancel: () => void;
  } = $props();

  // Text the user types. A value of null in edit mode is shown empty; clearing a field sets NULL.
  // svelte-ignore state_referenced_locally
  let draft = $state<string[]>(values.map((v) => v ?? ""));
  let confirming = $state(false);
  let busy = $state(false);

  const changes = $derived.by((): Cell[] => {
    if (mode === "add") {
      return columns.flatMap((column, i) => (draft[i] === "" ? [] : [{ column, value: draft[i] }]));
    }
    return columns.flatMap((column, i) => {
      const original = values[i];
      const now = draft[i] === "" ? null : draft[i];
      return now === original ? [] : [{ column, value: now }];
    });
  });

  async function submit() {
    busy = true;
    try {
      await onsubmit(changes);
    } finally {
      busy = false;
      confirming = false;
    }
  }
</script>

<div class="haya-form-fields">
  {#each columns as column, i (column)}
    {@const locked = mode === "edit" && keyColumns.includes(column)}
    <label class="haya-form-field">
      <span class="haya-field-name">{column}{keyColumns.includes(column) ? " · key" : ""}</span>
      <input
        class="haya-input haya-field-input"
        bind:value={draft[i]}
        disabled={locked}
        placeholder={mode === "add" ? "default" : "NULL"}
        autocomplete="off"
      />
    </label>
  {/each}
</div>

<div class="haya-form-actions">
  <Button variant="text" label="Cancel" onclick={oncancel}>Cancel</Button>
  {#if !confirming}
    <Button variant="text" label={mode === "add" ? "Insert row" : "Save changes"} active disabled={busy || changes.length === 0} onclick={() => (confirming = true)}>
      {mode === "add" ? "Insert" : "Save"}
    </Button>
  {:else}
    <span class="haya-form-confirm">
      {mode === "add" ? "Insert this row?" : `Update ${changes.length} column${changes.length === 1 ? "" : "s"}?`}
    </span>
    <Button variant="text" label="Back" onclick={() => (confirming = false)}>Back</Button>
    <Button variant="text" label="Confirm" active disabled={busy} onclick={submit}>Confirm</Button>
  {/if}
</div>
