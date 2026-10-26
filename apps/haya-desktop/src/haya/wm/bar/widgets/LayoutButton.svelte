<script lang="ts">
  import { activeWorkspace, LAYOUT_NAMES } from "../../model";
  import { nextLayout, wm } from "../../store.svelte";

  const ws = $derived(activeWorkspace(wm.config));
</script>

<button class="haya-button haya-layout" title="Change layout (⌘\)" onclick={nextLayout}>
  {ws.layout} · {LAYOUT_NAMES.indexOf(ws.layout) + 1}/{LAYOUT_NAMES.length}
</button>
