<script lang="ts">
  import ChromeBar from "../chrome/ChromeBar.svelte";
  import { DEFAULT_BARS, WIDGETS, type BarPosition } from "./bar/registry";

  let { part }: { part: BarPosition } = $props();

  const widgets = $derived(DEFAULT_BARS[part]);
</script>

<ChromeBar edge={part} label={part === "top" ? "Workspaces and layout" : "Status"}>
  {#each widgets as id (id)}
    {@const Widget = WIDGETS[id]}
    <Widget />
  {/each}
</ChromeBar>
