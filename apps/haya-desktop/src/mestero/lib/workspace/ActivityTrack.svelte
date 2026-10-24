<script lang="ts">
	import { clockLabel, eventLabel, trackPositions, trackTone, type ActivityTick } from './task-activity.js';
	let {
		events = [],
		startedAt = 0,
		finishedAt = null,
		active = false,
		compact = false,
		label = 'Run activity'
	}: {
		events?: ActivityTick[];
		startedAt?: number;
		finishedAt?: number | null;
		active?: boolean;
		compact?: boolean;
		label?: string;
	} = $props();
	let now = $state(Date.now() / 1000);
	$effect(() => {
		if (!active) return;
		now = Date.now() / 1000;
		const timer = setInterval(() => { now = Date.now() / 1000; }, 15_000);
		return () => clearInterval(timer);
	});
	const end = $derived(active ? Math.max(now, startedAt + 1) : (finishedAt || 0));
	const positions = $derived(trackPositions(events, startedAt, end));
	const marker = $derived(active ? trackPositions([{ at: now }], startedAt, end)[0] : 0);
	const last = $derived(positions.length ? positions[positions.length - 1] : 0);
	const specks = [4, 9, 15, 22, 29, 36, 44, 52, 60, 68, 76, 84, 91, 96];
</script>
<div class="activity-track" class:is-compact={compact} role="img" aria-label={`${label}: ${events.length} events`}>
	<span class="activity-track-ground" aria-hidden="true"></span>
	<span class="activity-track-fill" style:width={`${(active ? marker : last) * 100}%`} aria-hidden="true"></span>
	{#each specks as speck}<span class="activity-track-speck" style:left={`${speck}%`} aria-hidden="true"></span>{/each}
	{#each events as event, index}<span class={`activity-track-event is-${trackTone(event.kind)}`} style:left={`${(positions[index] || 0) * 100}%`} title={`${eventLabel(event.kind)} · ${clockLabel(event.at)}`} aria-hidden="true"></span>{/each}
	{#if active}<span class="activity-track-now" style:left={`${marker * 100}%`} aria-hidden="true"></span>{:else}<span class="activity-track-cap" style:left={`${last * 100}%`} aria-hidden="true"></span>{/if}
</div>
