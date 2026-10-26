<script lang="ts">
  import { WORKSPACE_COUNT } from "../../model";
  import { switchWorkspace, wm } from "../../store.svelte";
  import Button from "../../../components/Button.svelte";

  const ids = Array.from({ length: WORKSPACE_COUNT }, (_, i) => i + 1);
  const occupied = (id: number) => wm.config.workspaces[id - 1].windows.length > 0;
</script>

<div class="haya-ws-picker" role="tablist" aria-label="Workspaces">
  {#each ids as id (id)}
    <Button variant="chip" label={`Workspace ${id} (⌘${id === 10 ? 0 : id})`} active={wm.config.active === id} onclick={() => switchWorkspace(id)}>
      {id === 10 ? 0 : id}
    </Button>
  {/each}
</div>
