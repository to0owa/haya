<script lang="ts">
	import type { Harness } from './service.svelte.js';
	let { id, title, harness = $bindable('codex'), model = $bindable(''), harnesses, optional = false }: {
		id: string; title: string; harness?: string; model?: string; harnesses: Record<string, Harness>; optional?: boolean;
	} = $props();
</script>

<fieldset class="model-route">
	<legend>{title}</legend>
	<label class="form-label" for={`${id}-harness`}>Connected agent</label>
	<select class="field" id={`${id}-harness`} bind:value={harness}>
		{#if optional}<option value="">Same as default agent</option>{/if}
		{#each ['codex', 'claude', 'opencode'] as key}
			<option value={key}>{harnesses[key]?.label || ({ codex: 'Codex', claude: 'Claude Code', opencode: 'OpenCode' }[key])}{harnesses[key]?.available ? '' : ' · not detected'}</option>
		{/each}
	</select>
	<label class="form-label" for={`${id}-model`}>Model ID</label>
	<input class="field" id={`${id}-model`} bind:value={model} maxlength="160" placeholder={optional ? 'Empty disables automatic escalation' : 'Empty uses this agent’s configured model'} />
	<p class="route-hint">{optional ? 'Used for a specific blocker, with one consultation and one follow-up per work item.' : 'Choose your inexpensive model here. An empty model uses the agent default; its cost tier is unknown.'}</p>
</fieldset>
