<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	let { workspace }: { workspace: Workspace } = $props();
	const ui = $derived(workspace.state);
</script>

<div class="board-layout-toggle" role="group" aria-label="Board layout">
	<button class="board-layout-button" aria-label="Horizontal board" title="Horizontal kanban" aria-pressed={ui.boardLayout === 'horizontal'} onclick={() => ui.boardLayout = 'horizontal'}>
		<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2.5" y="3" width="4" height="14" rx="1.2" /><rect x="8" y="3" width="4" height="14" rx="1.2" /><rect x="13.5" y="3" width="4" height="14" rx="1.2" /></svg>
	</button>
	<button class="board-layout-button" aria-label="Vertical board" title="Vertical stack" aria-pressed={ui.boardLayout === 'vertical'} onclick={() => ui.boardLayout = 'vertical'}>
		<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="3" y="2.5" width="14" height="4" rx="1.2" /><rect x="3" y="8" width="14" height="4" rx="1.2" /><rect x="3" y="13.5" width="14" height="4" rx="1.2" /></svg>
	</button>
</div>
