<script lang="ts">
	import { tick } from 'svelte';
	import type { Workspace } from './workspace.svelte.js';
	let { workspace }: { workspace: Workspace } = $props();
	let output: HTMLDivElement;
	$effect.pre(() => {
		workspace.service.state.events.length;
		const bottom = !output || output.scrollHeight - output.scrollTop - output.clientHeight < 60;
		if (bottom) tick().then(() => { if (output) output.scrollTop = output.scrollHeight; });
	});
</script>
<div class="terminal-body" bind:this={output}>
	{#each workspace.service.state.events as event (event.seq)}<div class="run-event"><span class="run-event-kind">{event.kind}</span><span>{event.text}</span></div>{:else}<span class="muted">Run output will appear here when Maestro, Virtuoso, or Soundcheck starts. Progress is saved by the service.</span>{/each}
</div>
