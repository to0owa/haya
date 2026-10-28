<script lang="ts">
  import { WORKSPACE_COUNT } from "../../model";
  import { switchWorkspace, widgetSetting, wm } from "../../store.svelte";
  import { toNumbering, workspaceLabel } from "../../numbering";
  import Button from "../../../components/Button.svelte";

  const ids = Array.from({ length: WORKSPACE_COUNT }, (_, i) => i + 1);
  const mode = $derived(widgetSetting("workspaces", "mode", "all"));
  const shown = $derived(mode === "active" ? ids.filter((id) => id === wm.config.active) : ids);
  const numbering = $derived(toNumbering(widgetSetting("workspaces", "numbering", "arabic")));
  const labelOf = (id: number) => workspaceLabel(id, numbering, wm.config.workspaces[id - 1]?.name ?? "");
</script>

{#snippet chip(id: number)}
  <Button variant="chip" label={`Workspace ${id} (⌘${id === 10 ? 0 : id})`} active={wm.config.active === id} onclick={() => switchWorkspace(id)}>
    {labelOf(id)}
  </Button>
{/snippet}

{#if mode === "label"}
  <div class="haya-ws-label">
    <span class="haya-ws-name">Workspace {wm.config.active}</span>
    <div class="haya-ws-popover" role="tablist" aria-label="Workspaces">
      {#each ids as id (id)}
        {@render chip(id)}
      {/each}
    </div>
  </div>
{:else}
  <div class="haya-ws-picker" role="tablist" aria-label="Workspaces">
    {#each shown as id (id)}
      {@render chip(id)}
    {/each}
  </div>
{/if}
