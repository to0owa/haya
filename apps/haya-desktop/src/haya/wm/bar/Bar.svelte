<script lang="ts">
  import Toolbar from "../../templates/Toolbar.svelte";
  import ContextMenu, { type MenuItem } from "../../components/ContextMenu.svelte";
  import { DEFAULT_BARS, WIDGETS, WIDGET_SETTINGS, type BarPosition, type WidgetId } from "./registry";
  import { setWidgetSetting, widgetSetting } from "../store.svelte";

  let { part }: { part: BarPosition } = $props();

  const widgets = $derived(DEFAULT_BARS[part]);

  // Right-clicking a widget opens its settings. Widgets without settings show no menu.
  let menu = $state<{ x: number; y: number; widget: WidgetId } | null>(null);

  function openMenu(event: MouseEvent, widget: WidgetId) {
    if (!WIDGET_SETTINGS[widget]) return;
    event.preventDefault();
    menu = { x: event.clientX, y: event.clientY, widget };
  }

  const menuItems = $derived.by((): MenuItem[] => {
    const open = menu;
    const def = open ? WIDGET_SETTINGS[open.widget] : undefined;
    if (!open || !def) return [];
    return def.settings.flatMap((setting) => {
      const current = widgetSetting(open.widget, setting.key, setting.fallback);
      return setting.options.map((option) => ({
        label: option.label,
        section: setting.label,
        checked: current === option.value,
        onselect: () => setWidgetSetting(open.widget, setting.key, option.value),
      }));
    });
  });
</script>

<Toolbar edge={part} label={part === "top" ? "Workspaces and layout" : "Status"}>
  {#each widgets as id (id)}
    {@const Widget = WIDGETS[id]}
    <div class="haya-widget" role="presentation" oncontextmenu={(event) => openMenu(event, id)}>
      <Widget />
    </div>
  {/each}
</Toolbar>

{#if menu}
  <ContextMenu
    x={menu.x}
    y={menu.y}
    title={WIDGET_SETTINGS[menu.widget]?.title ?? ""}
    items={menuItems}
    onclose={() => (menu = null)}
  />
{/if}
