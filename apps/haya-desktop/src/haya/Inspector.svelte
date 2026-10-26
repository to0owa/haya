<script lang="ts">
  import Field from "./components/Field.svelte";
  import EmptyState from "./components/EmptyState.svelte";
  import PanelHeader from "./components/PanelHeader.svelte";

  let { columns, row }: { columns: string[] | null; row: (string | null)[] | null } = $props();
</script>

<PanelHeader title="Details" />
<div class="haya-fields">
  {#if columns && row}
    {#each columns as name, i (name)}
      <Field {name} value={row[i]} />
    {/each}
  {:else}
    <EmptyState text="Select a row to see its fields." />
  {/if}
</div>
