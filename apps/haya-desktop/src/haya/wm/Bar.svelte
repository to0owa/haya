<script lang="ts">
  import { activeWorkspace, LAYOUT_NAMES, WORKSPACE_COUNT, type WindowKind } from "./model";
  import { close, focus, nextLayout, open, switchWorkspace, wm } from "./store.svelte";

  const ws = $derived(activeWorkspace(wm.config));
  const focused = $derived(ws.focus);
  const focusedKind = $derived<WindowKind | null>(focused === null ? null : wm.config.windows[focused] ?? null);
  const focusedTitle = $derived(focused === null ? "" : wm.instances[focused]?.title ?? "");

  // Actions that make sense for the focused window. Only actions that exist are listed.
  const actions = $derived.by(() => {
    const list: { label: string; run: () => void }[] = [{ label: "+ Terminal", run: () => open("terminal") }];
    if (focused !== null) list.push({ label: "Close", run: () => close(focused) });
    if (focusedKind === "table") list.push({ label: "Connections", run: () => open("connections") });
    return list;
  });

  function occupied(id: number): boolean {
    return wm.config.workspaces[id - 1].windows.length > 0;
  }
</script>

<div class="haya-bar haya-bar-top" role="toolbar" aria-label="Workspaces and layout">
  <div class="haya-ws-picker" role="tablist" aria-label="Workspaces">
    {#each Array.from({ length: WORKSPACE_COUNT }, (_, i) => i + 1) as id (id)}
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

  <div class="haya-bar-actions">
    {#each actions as action (action.label)}
      <button class="haya-button" onclick={action.run}>{action.label}</button>
    {/each}
    <button class="haya-button haya-layout" title="Change layout (⌘\)" onclick={nextLayout}>
      {ws.layout} · {LAYOUT_NAMES.indexOf(ws.layout) + 1}/{LAYOUT_NAMES.length}
    </button>
  </div>
</div>

<div class="haya-bar haya-bar-bottom" aria-label="Status">
  {#if focused !== null}
    <span class="haya-status-kind">{focusedKind}</span>
    <span class="haya-status-title">{focusedTitle}</span>
  {:else}
    <span class="haya-status-title">No window on this workspace</span>
  {/if}
  <span class="haya-status-spacer"></span>
  <span>{ws.windows.length} window{ws.windows.length === 1 ? "" : "s"}</span>
  {#if ws.windows.length > 1}
    <button class="haya-status-cycle" onclick={() => focus(ws.windows[(ws.windows.indexOf(focused ?? ws.windows[0]) + 1) % ws.windows.length])}>next</button>
  {/if}
</div>
