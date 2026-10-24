<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import { taskStateLabel } from './service.svelte.js';
	import { activityAgent, activityPhase } from './task-activity.js';
	import MessageComposer from './MessageComposer.svelte';
	import TaskActions from './TaskActions.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
	const activity = $derived(service.task ? service.activityFor(service.task.id) : undefined);
	const status = $derived(service.state.pending ? 'Saving…' : activity ? `${activityAgent(activity, service.task?.state)} · ${activity.work_item_title ? `item ${activity.item_index}/${activity.item_total}` : activityPhase(activity)}` : service.task ? taskStateLabel(service.task.state) : 'Maestro plans before any code runs');
</script>
{#if service.project}
<div class="composer-wrap"><div class="composer-shell">
	<div class="composer-context"><div class="project-path" title={service.task?.worktree || service.project.path}><span class="project-path-root">▱ {service.project.name}</span><span class="context-divider">/</span><span class="project-path-file">{service.task?.branch || service.project.base_branch || 'New task'}</span></div>{#if service.task}<button class="git-context-button" aria-label="Show task Git changes" title="Git changes" onclick={() => workspace.toggleChanges()}>⑂</button>{/if}</div>
	{#if service.state.error}<div class="form-error" role="alert">{service.state.error}</div>{/if}
	{#if !service.canRun('Maestro')}<p class="form-error">Choose an available agent for Maestro in Team Settings. Install and log in to its CLI on the service host, then restart the service to refresh detection.</p>{/if}
	<MessageComposer bind:value={() => service.text, value => service.text = value} bind:files={() => service.files, files => service.files = files} onsubmit={() => { void service.submit(); }} disabled={service.busy || !service.state.connected || !service.canRun('Maestro') || service.task?.state === 'done'} placeholder={service.task ? 'Message Maestro…' : 'What do you want to work on?'} {status}>
		{#snippet actions()}<TaskActions {workspace} />{/snippet}
	</MessageComposer>
</div></div>
{/if}
