<script lang="ts">
  import Toolbar from "../../templates/Toolbar.svelte";
  import Spacer from "../../components/Spacer.svelte";
  import ContextMenu, { type MenuItem } from "../../components/ContextMenu.svelte";
  import SpacerMenu from "../../toolbar/SpacerMenu.svelte";
  import { DEFAULT_BARS, WIDGETS, WIDGET_LABELS, isWidget, type BarPosition, type WidgetId } from "./registry";
  import { setWidgetHidden, wm } from "../store.svelte";
  import { edit } from "../../toolbar/edit.svelte";
  import { isSpacerId, parseSpacer } from "./spacer";

  let { part }: { part: BarPosition } = $props();

  const LABELS: Record<BarPosition, string> = {
    top: "Workspaces and layout",
    bottom: "Status",
    left: "Explorer",
    right: "Details",
  };

  // Spacer.axis runs along the bar: x for horizontal bars, y for vertical ones.
  const axis = $derived(part === "top" || part === "bottom" ? "x" : "y");

  // The saved order for this bar, or the default. Hidden widgets stay in the list, so their slot keeps its index.
  const raw = $derived(wm.config.barLayout[part] ?? DEFAULT_BARS[part]);
  const hidden = (id: string) => wm.config.hiddenWidgets.includes(id);

  // The context menu lists every real widget. Spacers are sized from their own menu.
  const ALL = Object.keys(WIDGETS).filter((id) => id !== "spacer") as WidgetId[];

  let menu = $state<{ x: number; y: number } | null>(null);
  let spacerMenu = $state<{ x: number; y: number; index: number } | null>(null);

  function openMenu(event: MouseEvent) {
    event.preventDefault();
    menu = { x: event.clientX, y: event.clientY };
  }

  function openSpacerMenu(event: MouseEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    spacerMenu = { x: event.clientX, y: event.clientY, index };
  }

  const menuItems = $derived.by((): MenuItem[] =>
    ALL.map((id) => {
      const isHidden = hidden(id);
      return { label: WIDGET_LABELS[id], checked: !isHidden, onselect: () => setWidgetHidden(id, !isHidden) };
    }),
  );
</script>

<div class="haya-bar-hit" role="presentation" oncontextmenu={openMenu}>
  <Toolbar edge={part} label={LABELS[part]}>
    <!-- Slots never change the layout. Edit mode draws its outlines and badges over them (see toolbar/EditLayer). -->
    {#each raw as id, index (index)}
      {#if isSpacerId(id)}
        {@const spec = parseSpacer(id)}
        <div class="haya-slot" data-item data-id={id} data-part={part} data-index={index} data-hidden="false" role="presentation" oncontextmenu={(event) => openSpacerMenu(event, index)}>
          <Spacer {axis} fill={spec?.px == null} size={spec?.px ?? null} />
        </div>
      {:else if isWidget(id) && (edit.on || !hidden(id))}
        {@const Widget = WIDGETS[id]}
        <div class="haya-slot" data-item data-id={id} data-part={part} data-index={index} data-hidden={hidden(id)}>
          <Widget />
        </div>
      {/if}
    {/each}
  </Toolbar>
</div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} title="Toolbar" items={menuItems} onclose={() => (menu = null)} />
{/if}

{#if spacerMenu}
  <SpacerMenu part={part} index={spacerMenu.index} x={spacerMenu.x} y={spacerMenu.y} onclose={() => (spacerMenu = null)} />
{/if}
