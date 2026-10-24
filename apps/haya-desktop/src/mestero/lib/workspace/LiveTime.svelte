<script lang="ts">
	import { elapsedLabel } from './task-activity.js';
	let { since, label = 'Elapsed time' }: { since: number | null | undefined; label?: string } = $props();
	let now = $state(Date.now() / 1000);
	$effect(() => {
		now = Date.now() / 1000;
		const timer = setInterval(() => { now = Date.now() / 1000; }, 1000);
		return () => clearInterval(timer);
	});
	const elapsed = $derived(elapsedLabel(since || 0, now));
</script>
{#if elapsed}<span class="live-time" title={`${label}: ${elapsed}`}>{elapsed}</span>{/if}
