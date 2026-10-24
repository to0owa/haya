<script lang="ts">
  let { columns, row }: { columns: string[] | null; row: (string | null)[] | null } = $props();
</script>

<div class="side-head">
  <div class="side-head-top">
    <div class="sidebar-brand" role="img" aria-label="Details"><span class="haya-wordmark">Details</span></div>
  </div>
</div>
<div class="side-scroll">
  <div class="side-list-content haya-fields">
    {#if columns && row}
      {#each columns as name, i (name)}
        <div class="haya-field">
          <div class="haya-field-name">{name}</div>
          <div class="haya-field-value" class:is-null={row[i] === null}>{row[i] ?? "NULL"}</div>
        </div>
      {/each}
    {:else}
      <div class="project-empty">Select a row to see its fields.</div>
    {/if}
  </div>
</div>
