<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import BoardLayoutToggle from './BoardLayoutToggle.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	const ui = $derived(workspace.state);
</script>

{#snippet panelIcon(placement: 'left' | 'right' | 'bottom')}
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<g transform={placement === 'left' ? 'translate(24 0) scale(-1 1)' : placement === 'bottom' ? 'rotate(90 12 12)' : undefined}>
			<path class="panel-icon-fill" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4Z" stroke="none" />
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<path d="M15 3v18" />
		</g>
	</svg>
{/snippet}

<div class="surface-tools chrome-controls" aria-label="Panels">
	{#if ui.mode === 'board'}<BoardLayoutToggle {workspace} />{/if}
	<button class="chrome-control toggle-sidebar-control" aria-label={ui.sidebarMode === 'mini' ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={ui.sidebarMode !== 'mini'} aria-pressed={ui.sidebarMode !== 'mini'} aria-controls="sidebar" title={ui.sidebarMode === 'mini' ? 'Expand task sidebar' : 'Collapse task sidebar'} onclick={() => ui.sidebarToggle++}>{@render panelIcon('left')}</button>
	<button class="chrome-control toggle-terminal-control" aria-label={ui.terminalOpen ? 'Close terminal panel' : 'Open terminal panel'} aria-expanded={ui.terminalOpen} aria-pressed={ui.terminalOpen} aria-controls="terminal-drawer" title={ui.terminalOpen ? 'Close terminal panel' : 'Open terminal panel'} onclick={() => ui.terminalOpen = !ui.terminalOpen}>{@render panelIcon('bottom')}</button>
	<button class="chrome-control toggle-right-sidebar-control" aria-label={ui.inspectorOpen ? 'Close right sidebar' : 'Open right sidebar'} aria-expanded={ui.inspectorOpen} aria-pressed={ui.inspectorOpen} aria-controls="inspector" title={ui.inspectorOpen ? 'Close right sidebar' : 'Open right sidebar'} onclick={() => workspace.toggleInspector()}>{@render panelIcon('right')}</button>
	{#if ui.mode === 'board'}<button class="primary" disabled={!workspace.service.project} onclick={() => workspace.newTask()}>New task</button>{/if}
	{#if ui.mode === 'team'}<button class="primary" id="save-team" disabled={workspace.service.state.pending || !workspace.service.state.connected} onclick={() => workspace.service.saveTeammate({ id: ui.selectedMember, ...ui.teamDraft })}>Save teammate</button>{/if}
</div>
