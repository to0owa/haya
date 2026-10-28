<script lang="ts">
  import Grid from "../Grid.svelte";
  import { showDetails } from "../wm/store.svelte";

  let { schema, table, zoom = 12 }: { schema: string; table: string; zoom?: number } = $props();
</script>

<Grid {schema} {table} {zoom} onselect={(columns, row) => showDetails(schema, table, columns, row)} />
