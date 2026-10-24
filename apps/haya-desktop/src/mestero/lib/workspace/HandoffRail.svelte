<script lang="ts">
	import { handoffProgress } from './task-activity.js';
	import BotAvatar from './BotAvatar.svelte';
	let { state, kind = '' }: { state: string; kind?: string } = $props();
	const stages = [
		{ agent: 'Maestro', label: 'Plan' },
		{ agent: 'Virtuoso', label: 'Build' },
		{ agent: 'Soundcheck', label: 'Review' }
	] as const;
	const progress = $derived(handoffProgress(state, kind));
	const summary = $derived(stages.map((stage, index) => {
		if (progress.stoppedAt === index) return `${stage.label} stopped`;
		if (progress.active === index) return `${stage.label} in progress`;
		if (progress.complete > index) return `${stage.label} complete`;
		return `${stage.label} waiting`;
	}).join(', '));
</script>
<div class="handoff-rail" role="group" aria-label={`Handoff: ${summary}`}>
	{#each stages as stage, index}
		<div class="handoff-stage" class:is-active={progress.active === index} class:is-complete={progress.complete > index} class:is-stopped={progress.stoppedAt === index}>
			<span class="handoff-node"><BotAvatar name={stage.agent} />{#if progress.complete > index}<span class="handoff-badge is-done" aria-hidden="true">✓</span>{/if}{#if progress.stoppedAt === index}<span class="handoff-badge is-stopped" aria-hidden="true">!</span>{/if}</span>
			<span class="handoff-label">{stage.label}</span>
		</div>
		{#if index < stages.length - 1}<span class="handoff-link" class:is-live={progress.active > index} class:is-complete={progress.complete > index + 1} aria-hidden="true"></span>{/if}
	{/each}
</div>
