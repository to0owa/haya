<script lang="ts">
  import { open, widgetList, wm } from "../../store.svelte";
  import { ADD_ITEMS } from "../add-items";
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";

  // Items chosen in Preferences > Toolbar. Never empty: with nothing chosen, the first item stays.
  const items = $derived.by(() => {
    const chosen = widgetList("actions", "items", "terminal");
    const list = ADD_ITEMS.filter((item) => chosen.includes(item.kind));
    return list.length ? list : [ADD_ITEMS[0]];
  });

  let menuOpen = $state(false);
  let root: HTMLDivElement | undefined = $state();

  function onClick() {
    if (items.length === 1) return pick(items[0].kind);
    menuOpen = !menuOpen;
  }

  function pick(kind: (typeof ADD_ITEMS)[number]["kind"]) {
    open(kind);
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
  <Button variant="icon" label={items.length === 1 ? `Add ${items[0].label.toLowerCase()}` : "Add"} onclick={onClick}>
    <Icon name="terminal" />
  </Button>
  {#if menuOpen && items.length > 1}
    <div class="haya-layout-list" role="listbox" aria-label="Add">
      {#each items as item (item.kind)}
        <button class="haya-layout-item" role="option" aria-selected="false" onclick={() => pick(item.kind)}>
          <span class="haya-menu-check"></span>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
