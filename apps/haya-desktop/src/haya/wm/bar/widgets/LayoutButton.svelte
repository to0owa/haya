<script lang="ts">
  import { activeWorkspace, LAYOUT_NAMES } from "../../model";
  import { nextLayout, wm } from "../../store.svelte";
  import Button from "../../../components/Button.svelte";

  const ws = $derived(activeWorkspace(wm.config));
</script>

<Button label="Change layout (⌘\)" onclick={nextLayout}>
  {ws.layout} · {LAYOUT_NAMES.indexOf(ws.layout) + 1}/{LAYOUT_NAMES.length}
</Button>
