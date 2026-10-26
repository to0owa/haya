<script lang="ts">
  import TabStrip from "../../../components/TabStrip.svelte";
  import type { IconName } from "../../../components/Icon.svelte";
  import { activeWorkspace, type WindowKind } from "../../model";
  import { close, focus, wm } from "../../store.svelte";

  // Tabs are the windows of the active workspace only, so every workspace keeps its own list.
  const ws = $derived(activeWorkspace(wm.config));
  // The icon says what kind of window the tab holds. Hovering the tab swaps it for a close button.
  const KIND_ICON: Record<WindowKind, IconName> = {
    terminal: "terminal",
    connections: "database",
    table: "database",
    query: "database",
    details: "panel-right",
    editor: "file",
    explorer: "panel-left",
    changes: "git",
    chats: "chat",
  };

  const items = $derived(
    ws.windows.map((id) => ({
      id,
      label: wm.instances[id]?.title ?? "Window",
      icon: KIND_ICON[wm.config.windows[id] ?? "terminal"],
    })),
  );
</script>

<div class="haya-bar-tabs">
  <TabStrip {items} selectedId={ws.focus} label="Windows in this workspace" onselect={focus} onclose={close} />
</div>
