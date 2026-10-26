<script lang="ts">
  import { activeWorkspace, type WindowKind } from "../../model";
  import { focus, wm } from "../../store.svelte";
  import Button from "../../../components/Button.svelte";

  const ws = $derived(activeWorkspace(wm.config));
  const kind = $derived<WindowKind | null>(ws.focus === null ? null : wm.config.windows[ws.focus] ?? null);
  const title = $derived(ws.focus === null ? "" : wm.instances[ws.focus]?.title ?? "");

  function cycle() {
    if (ws.windows.length < 2) return;
    const index = ws.windows.indexOf(ws.focus ?? ws.windows[0]);
    focus(ws.windows[(index + 1) % ws.windows.length]);
  }
</script>

{#if ws.focus !== null}
  <span class="haya-status-kind">{kind}</span>
  <span class="haya-status-title">{title}</span>
{:else}
  <span class="haya-status-title">No window on this workspace</span>
{/if}
<span class="haya-status-spacer"></span>
<span>{ws.windows.length} window{ws.windows.length === 1 ? "" : "s"}</span>
{#if ws.windows.length > 1}
  <Button variant="text" label="Next window" onclick={cycle}>next</Button>
{/if}
