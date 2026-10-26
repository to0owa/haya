<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "../haya/templates/AppShell.svelte";
  import Stage from "../haya/templates/Stage.svelte";
  import SidePanel from "../haya/templates/SidePanel.svelte";
  import Tiles from "../haya/wm/Tiles.svelte";
  import Bar from "../haya/wm/bar/Bar.svelte";
  import Toasts from "../haya/Toasts.svelte";
  import Preferences from "../haya/preferences/Preferences.svelte";
  import CommandPalette from "../haya/commands/CommandPalette.svelte";
  import EditLayer from "../haya/toolbar/EditLayer.svelte";
  import Explorer from "../haya/Explorer.svelte";
  import Connections from "../haya/windows/ConnectionsWindow.svelte";
  import Details from "../haya/windows/DetailsWindow.svelte";
  import { handleKey, snapshot, wm } from "../haya/wm/store.svelte";
  import { loadWorkspaces, scheduleSave } from "../haya/wm/persist";
  import { initTheme } from "../haya/theme/theme.svelte";

  let ready = $state(false);

  // The WebView menu (Reload, Inspect) does not belong in a desktop app. Text fields keep theirs.
  function suppressNativeMenu(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable='true']")) return;
    event.preventDefault();
  }

  onMount(async () => {
    initTheme();
    await loadWorkspaces();
    ready = true;
  });

  // Save after every change to the layout or the window list, once the saved state is loaded.
  $effect(() => {
    snapshot();
    if (ready) scheduleSave();
  });
</script>

<svelte:window onkeydowncapture={(event) => handleKey(event)} oncontextmenu={suppressNativeMenu} />

<AppShell>
  {#snippet titlebar()}
    <Bar part="top" />
  {/snippet}

  {#snippet leftEdge()}
    <Bar part="left" />
  {/snippet}

  {#snippet leftPanel()}
    {#if wm.leftView}
      <SidePanel side="left" label={wm.leftView === "explorer" ? "Explorer" : "Connections"}>
        {#if wm.leftView === "explorer"}<Explorer />{:else}<Connections />{/if}
      </SidePanel>
    {/if}
  {/snippet}

  {#snippet stage()}
    <Stage>
      <Tiles />
    </Stage>
  {/snippet}

  {#snippet rightPanel()}
    {#if wm.rightOpen}
      <SidePanel side="right" label="Details"><Details /></SidePanel>
    {/if}
  {/snippet}

  {#snippet rightEdge()}
    <Bar part="right" />
  {/snippet}

  {#snippet bottom()}
    <Bar part="bottom" />
  {/snippet}
</AppShell>

<Toasts />
<Preferences />
<CommandPalette />
<EditLayer />
