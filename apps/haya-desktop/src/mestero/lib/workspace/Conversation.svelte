<script lang="ts">
	import { tick } from 'svelte';
	import type { Workspace } from './workspace.svelte.js';
	import { isActive } from './service.svelte.js';
	import { activityAgent, activityDetail, messageTimeLabel } from './task-activity.js';
	import BotAvatar from './BotAvatar.svelte';
	import LiveTime from './LiveTime.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
	const state = $derived(service.state);
	const firstUser = $derived(state.messages.find(message => message.role === 'user'));
	const activity = $derived(service.task ? service.activityFor(service.task.id) : undefined);
	const accountInitial = $derived((workspace.state.account || 'You').slice(0, 1).toUpperCase());
	let scroller: HTMLDivElement;
	$effect.pre(() => {
		const lastMessage = state.messages.at(-1)?.id;
		const nearBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100;
		if (lastMessage && nearBottom) tick().then(() => { if (scroller) scroller.scrollTop = scroller.scrollHeight; });
	});
	const roleFor = (name: string) => name === 'Virtuoso' ? 'Implementer' : name === 'Soundcheck' ? 'Reviewer' : 'Planning lead';
	const isoTime = (seconds: number) => seconds ? new Date(seconds * 1000).toISOString() : undefined;
</script>
<div class="chat-viewport"><div class="chat-scroll" bind:this={scroller}><div class="conversation" class:intro={!service.task}>
	{#if state.loading || state.detailLoading}<div class="empty-state"><h2>Loading workspace…</h2></div>
	{:else if !state.connected}<div class="empty-state"><h2>The service is offline</h2><p>Start the Mestero service to load your workspaces and tasks.</p><button class="primary" onclick={() => service.refresh()}>Reconnect</button></div>
	{:else if !service.project}<div class="empty-state"><BotAvatar name="Maestro" large /><h2>What are we building?</h2><p>Connect a workspace, then give Maestro a task to plan with you.</p><button class="primary" onclick={() => state.dialog = 'project'}>Connect a workspace</button></div>
	{:else if !service.task}<div class="chat-intro"><BotAvatar name="Maestro" large /><h2>What do you want to work on?</h2><p>Tell Maestro what should change in <strong>{service.project.name}</strong>. It will ask what it needs, then prepare a plan for you to approve before any code runs.</p><p class="chat-intro-note">You can refine the plan in this conversation before anything runs.</p></div>
	{:else}
		<div class="thread-meta"><span>{service.task.title} · Task conversation</span></div>
		{#if !firstUser || firstUser.text.trim() !== service.task.goal.trim()}
			<div class="message assistant">
				<BotAvatar name="Maestro" />
				<div class="message-body">
					<div class="message-head"><span class="message-author">Maestro</span><span class="role">{roleFor('Maestro')}</span><time class="message-time" datetime={isoTime(service.task.created_at)}>{messageTimeLabel(service.task.created_at)}</time></div>
					<div class="message-bubble">
						<p class="message-text">{service.task.goal}</p>
						{#if !state.messages.length}<p class="message-hint">Send a message to start planning.</p>{/if}
					</div>
				</div>
			</div>
		{/if}
		{#each state.messages as message (message.id)}
			{#if message.role === 'system'}
				<div class="system-message"><p>{message.text}</p></div>
			{:else if message.role === 'user'}
				<div class="message user">
					<div class="message-body">
						<div class="message-head"><span class="message-author">You</span><time class="message-time" datetime={isoTime(message.created_at)}>{messageTimeLabel(message.created_at)}</time></div>
						<div class="message-bubble">
							<p class="message-text">{message.text}</p>
							{#if message.attachments.length}<ul class="attachment-list">{#each message.attachments as file}<li class="attachment-chip"><a href={`/api/attachments/${file.id}`} download={file.name}>{file.name}</a></li>{/each}</ul>{/if}
						</div>
					</div>
					<span class="user-avatar" aria-hidden="true">{accountInitial}</span>
				</div>
			{:else}
				{@const name = message.role === 'builder' ? 'Virtuoso' : message.role === 'reviewer' ? 'Soundcheck' : 'Maestro'}
				<div class="message assistant">
					<BotAvatar {name} />
					<div class="message-body">
						<div class="message-head"><span class="message-author">{name}</span><span class="role">{roleFor(name)}</span><time class="message-time" datetime={isoTime(message.created_at)}>{messageTimeLabel(message.created_at)}</time></div>
						<div class="message-bubble">
							<p class="message-text">{message.text}</p>
							{#if message.attachments.length}<ul class="attachment-list">{#each message.attachments as file}<li class="attachment-chip"><a href={`/api/attachments/${file.id}`} download={file.name}>{file.name}</a></li>{/each}</ul>{/if}
						</div>
					</div>
				</div>
			{/if}
		{/each}
		{#if isActive(service.task)}<div class="activity-line" role="status"><BotAvatar name={activityAgent(activity, service.task.state)} /><span>{activityAgent(activity, service.task.state)} · {activityDetail(activity) || (service.task.state === 'planning' ? 'Preparing your plan…' : service.task.state === 'verifying' ? 'Independently reviewing the result…' : 'Working in the task worktree…')}</span>{#if activity}<LiveTime since={activity.started_at} label="Run time" />{/if}</div>{/if}
		{#if service.task.plan}<button class="plan-link" onclick={() => workspace.revealPreview('brief')}>▤ Review plan ↗</button>{/if}
	{/if}
</div></div></div>
