<script lang="ts">
  import Grid from "../Grid.svelte";
  import { showDetails } from "../wm/store.svelte";

  let { schema, table }: { schema: string; table: string } = $props();
</script>

<Grid {schema} {table} onselect={showDetails} />
