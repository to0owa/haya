<script lang="ts">
  import { activeWorkspace, LAYOUT_NAMES, type LayoutName } from "../../model";
  import { layout, wm } from "../../store.svelte";
  import type { IconName } from "../../../components/Icon.svelte";
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";

  const ws = $derived(activeWorkspace(wm.config));
  const iconOf = (name: LayoutName): IconName => `layout-${name}` as IconName;
  let menuOpen = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function pick(name: LayoutName) {
    layout(name);
    menuOpen = false;
  }

  function onWindowDown(event: PointerEvent) {
    if (menuOpen && root && !root.contains(event.target as Node)) menuOpen = false;
  }

  function onKey(event: KeyboardEvent) {
    if (menuOpen && event.key === "Escape") menuOpen = false;
  }
</script>

<svelte:window onpointerdown={onWindowDown} onkeydown={onKey} />

<div class="haya-layout" bind:this={root}>
  <Button variant="icon" label="Layout: {ws.layout}" onclick={() => (menuOpen = !menuOpen)}>
    <Icon name={iconOf(ws.layout)} />
  </Button>
  {#if menuOpen}
    <div class="haya-layout-list" role="listbox" aria-label="Layouts">
      {#each LAYOUT_NAMES as name (name)}
        <button class="haya-layout-item" class:is-on={ws.layout === name} role="option" aria-selected={ws.layout === name} onclick={() => pick(name)}>
          <span class="haya-menu-check">{ws.layout === name ? "✓" : ""}</span>
          <Icon name={iconOf(name)} />
          <span>{name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
