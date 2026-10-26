<script lang="ts">
  import Toolbar from "../templates/Toolbar.svelte";
  import { DEFAULT_BARS, WIDGETS, type BarPosition } from "./bar/registry";

  let { part }: { part: BarPosition } = $props();

  const widgets = $derived(DEFAULT_BARS[part]);
</script>

<Toolbar edge={part} label={part === "top" ? "Workspaces and layout" : "Status"}>
  {#each widgets as id (id)}
    {@const Widget = WIDGETS[id]}
    <Widget />
  {/each}
</Toolbar>
