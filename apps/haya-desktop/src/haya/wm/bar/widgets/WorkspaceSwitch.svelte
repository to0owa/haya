<script lang="ts">
  import { WORKSPACE_COUNT } from "../../model";
  import { switchWorkspace, wm } from "../../store.svelte";

  const ids = Array.from({ length: WORKSPACE_COUNT }, (_, i) => i + 1);
  const occupied = (id: number) => wm.config.workspaces[id - 1].windows.length > 0;
</script>

<div class="haya-ws-picker" role="tablist" aria-label="Workspaces">
  {#each ids as id (id)}
    <button
      class="haya-ws"
      class:is-active={wm.config.active === id}
      class:is-occupied={occupied(id)}
      role="tab"
      aria-selected={wm.config.active === id}
      title={`Workspace ${id} (⌘${id === 10 ? 0 : id})`}
      onclick={() => switchWorkspace(id)}
    >{id === 10 ? 0 : id}</button>
  {/each}
</div>
