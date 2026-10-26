<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "../haya/templates/AppShell.svelte";
  import Stage from "../haya/templates/Stage.svelte";
  import SidePanel from "../haya/templates/SidePanel.svelte";
  import Toolbar from "../haya/templates/Toolbar.svelte";
  import Button from "../haya/components/Button.svelte";
  import Icon from "../haya/components/Icon.svelte";
  import Tiles from "../haya/wm/Tiles.svelte";
  import Bar from "../haya/wm/Bar.svelte";
  import Toasts from "../haya/Toasts.svelte";
  import Preferences from "../haya/preferences/Preferences.svelte";
  import Explorer from "../haya/Explorer.svelte";
  import Details from "../haya/windows/DetailsWindow.svelte";
  import { handleKey, snapshot, toggleExplorer, toggleRight, wm } from "../haya/wm/store.svelte";
  import { loadWorkspaces, scheduleSave } from "../haya/wm/persist";
  import { initTheme } from "../haya/theme/theme.svelte";

  let ready = $state(false);

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

<svelte:window onkeydown={(event) => handleKey(event)} />

<AppShell>
  {#snippet titlebar()}
    <Bar part="top" />
  {/snippet}

  {#snippet leftEdge()}
    <Toolbar edge="left" label="Left toolbar">
      <Button variant="icon" label="Explorer (⌘B)" active={wm.explorerOpen} onclick={toggleExplorer}>
        <Icon name="panel-left" />
      </Button>
    </Toolbar>
  {/snippet}

  {#snippet leftPanel()}
    {#if wm.explorerOpen}
      <SidePanel side="left" label="Explorer"><Explorer /></SidePanel>
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
    <Toolbar edge="right" label="Right toolbar">
      <Button variant="icon" label="Details (⇧⌘B)" active={wm.rightOpen} onclick={toggleRight}>
        <Icon name="panel-right" />
      </Button>
    </Toolbar>
  {/snippet}

  {#snippet bottom()}
    <Bar part="bottom" />
  {/snippet}
</AppShell>

<Toasts />
<Preferences />
