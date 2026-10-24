<script lang="ts">
	import type { WorkItem } from './service.svelte.js';
	let { items }: { items: WorkItem[] } = $props();
</script>

{#if items.length}
	<div class="overline">Approved work · {items.filter(item => item.state === 'completed').length}/{items.length}</div>
	{#each items as item (item.id)}
		<details class="work-item">
			<summary><span>{item.title}</span><span class="status-tag">{item.state}</span></summary>
			<p class="preview-copy">{item.instructions}</p>
			<ul>{#each item.acceptance as criterion}<li>{criterion}</li>{/each}</ul>
			{#if item.paths.length}<p class="muted">Scope: {item.paths.join(', ')}</p>{/if}
			{#if item.depends_on.length}<p class="muted">Needs: {item.depends_on.join(', ')}</p>{/if}
			{#if item.result}<div class="prose-text">{item.result}</div>{/if}
		</details>
	{/each}
{/if}

<style>
	.work-item { padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 12px; }
	summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; color: var(--text-strong); }
	summary span:first-child { flex: 1; }
	ul { padding-left: 18px; line-height: 1.6; }
	.prose-text { margin-top: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
