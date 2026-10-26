<script lang="ts">
  import { activeWorkspace, type WindowKind } from "../../model";
  import { close, open, wm } from "../../store.svelte";
  import Button from "../../../components/Button.svelte";

  // Actions depend on the focused window. Only actions that exist are shown.
  const focused = $derived(activeWorkspace(wm.config).focus);
  const kind = $derived<WindowKind | null>(focused === null ? null : wm.config.windows[focused] ?? null);

  const actions = $derived.by(() => {
    const list: { label: string; run: () => void }[] = [{ label: "+ Terminal", run: () => open("terminal") }];
    if (focused !== null) list.push({ label: "Close", run: () => close(focused) });
    if (kind === "table") list.push({ label: "Connections", run: () => open("connections") });
    return list;
  });
</script>

<div class="haya-bar-actions">
  {#each actions as action (action.label)}
    <Button label={action.label} onclick={action.run}>{action.label}</Button>
  {/each}
</div>
