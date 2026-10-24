<script lang="ts">
	import type { Run } from './service.svelte.js';
	let { run }: { run: Run } = $props();
	const tokens = (value: number | null | undefined) => value == null ? 'unknown' : value.toLocaleString();
</script>

<details class="run-summary">
	<summary>{run.kind} · {run.state}{run.tier === 'escalation' ? ' · escalated' : ''}</summary>
	<dl class="task-details">
		<dt>Agent / model</dt><dd>{run.harness || 'Codex'} · {run.model || 'Agent default'}</dd>
		{#if run.observed_model && run.observed_model !== run.model}<dt>Reported model</dt><dd>{run.observed_model}</dd>{/if}
		{#if run.work_item_id}<dt>Work item</dt><dd>{run.work_item_id}</dd>{/if}
		{#if run.route_reason}<dt>Assignment reason</dt><dd>{run.route_reason}</dd>{/if}
		<dt>Input / output tokens</dt><dd>{tokens(run.usage?.input_tokens)} / {tokens(run.usage?.output_tokens)}</dd>
		<dt>Cache read / write tokens</dt><dd>{tokens(run.usage?.cached_input_tokens)} / {tokens(run.usage?.cache_write_tokens)}</dd>
		<dt>Harness cost estimate</dt><dd>{run.usage?.cost_usd == null ? 'Unknown' : `$${run.usage.cost_usd.toFixed(4)}`}</dd>
		<dt>Usage coverage</dt><dd>{run.usage?.coverage || 'Unavailable'}</dd>
		{#if run.error}<dt>Stopped because</dt><dd>{run.error}</dd>{/if}
	</dl>
</details>

<style>
	.run-summary { border-bottom: 1px solid var(--line); padding: 12px 0; font-size: 12px; }
	summary { cursor: pointer; }
	.task-details { margin: 8px 0; }
</style>
