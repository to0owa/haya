<script lang="ts">
  import Toolbar from "../../templates/Toolbar.svelte";
  import ContextMenu, { type MenuItem } from "../../components/ContextMenu.svelte";
  import { DEFAULT_BARS, WIDGETS, WIDGET_LABELS, type BarPosition, type WidgetId } from "./registry";
  import { setWidgetHidden, wm } from "../store.svelte";

  let { part }: { part: BarPosition } = $props();

  // Hidden widgets are dropped from both bars. The menu lists every widget, so any of them can come back.
  const widgets = $derived(DEFAULT_BARS[part].filter((id) => !wm.config.hiddenWidgets.includes(id)));
  const ALL = Object.keys(WIDGETS) as WidgetId[];

  let menu = $state<{ x: number; y: number } | null>(null);

  function openMenu(event: MouseEvent) {
    event.preventDefault();
    menu = { x: event.clientX, y: event.clientY };
  }

  const menuItems = $derived.by((): MenuItem[] =>
    ALL.map((id) => {
      const hidden = wm.config.hiddenWidgets.includes(id);
      return { label: WIDGET_LABELS[id], checked: !hidden, onselect: () => setWidgetHidden(id, !hidden) };
    }),
  );
</script>

<div class="haya-bar-hit" role="presentation" oncontextmenu={openMenu}>
  <Toolbar edge={part} label={part === "top" ? "Workspaces and layout" : "Status"}>
    {#each widgets as id (id)}
      {@const Widget = WIDGETS[id]}
      <Widget />
    {/each}
  </Toolbar>
</div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} title="Toolbar" items={menuItems} onclose={() => (menu = null)} />
{/if}
