<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import { isActive } from './service.svelte.js';
	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
</script>
{#if isActive(service.task)}
	<button type="button" class="ghost" disabled={service.state.pending} onclick={() => service.action('cancel')}>Cancel run</button>
{:else if service.task?.state === 'review'}
	<button type="button" class="ghost" disabled={service.busy} onclick={() => service.action('verify')}>Verify again</button>
	<button type="button" class="primary" disabled={service.busy || !service.task.verdict} onclick={() => workspace.state.acceptOpen = true}>Accept result</button>
{:else if service.task && ['ready', 'failed', 'cancelled'].includes(service.task.state) && service.task.plan}
	{#if service.task.worktree}<button type="button" class="ghost" disabled={service.busy} onclick={() => service.action('verify')}>Retry verification</button>{/if}
	<button type="button" class="primary" id="proceed" disabled={service.busy || !service.canRun('Virtuoso') || !service.canRun('Soundcheck')} onclick={() => workspace.proceed()}>{service.task.state === 'ready' ? 'Proceed with plan' : 'Retry implementation'}</button>
{/if}
