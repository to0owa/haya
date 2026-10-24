<script lang="ts">
  import Inspector from "../Inspector.svelte";
  import { wm } from "../wm/store.svelte";
</script>

<Inspector columns={wm.details?.columns ?? null} row={wm.details?.row ?? null} />
