<script lang="ts">
	import { untrack } from 'svelte';
	import type { Workspace } from './workspace.svelte.js';
	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
	$effect(() => {
		const taskId = service.state.taskId;
		const visible = workspace.state.inspectorOpen && workspace.state.inspectorPanel === 'changes';
		const taskState = service.task?.state;
		if (taskId && visible) untrack(() => { void service.loadChanges(); });
	});
</script>
<div class="changes-view"><div class="changes-content">
	<div class="changes-top"><div><div class="overline">Task workspace · Git activity</div><div class="changes-heading">Review what changed</div><div class="changes-copy">Changes stay in this task's worktree until you explicitly accept and integrate a passing result.</div></div>{#if service.task?.branch}<div class="branch-chip">⑂ {service.task.branch}</div>{/if}</div>
	{#if !service.task?.worktree}<p class="muted">A worktree is created when you approve the plan.</p>
	{:else if !service.state.changes}<p class="muted">Loading Git changes…</p>
	{:else}
		<button class="ghost" disabled={service.state.pending} onclick={() => service.loadChanges()}>Refresh changes</button>
		{#if service.state.error}<p class="form-error" role="alert">{service.state.error}</p>{/if}
		<div class="git-card"><div class="git-card-head"><span class="git-card-title">Changed files</span></div><pre class="code-output">{service.state.changes.status || 'No changed files.'}</pre></div>
		<div class="git-card"><div class="git-card-head"><span class="git-card-title">Tracked diff</span></div><pre class="code-output diff-output">{service.state.changes.diff || 'No tracked changes.'}</pre>{#if service.state.changes.truncated}<p class="git-note">Diff truncated to 512 KB. Review the full worktree locally before accepting.</p>{/if}</div>
		{#if service.state.changes.untracked.length}<div class="git-card"><div class="git-card-head"><span class="git-card-title">New files</span></div>{#each service.state.changes.untracked as path}<button class="file-preview-button" onclick={() => service.previewFile(path)}>{path} ↗</button>{/each}</div>{/if}
		{#if service.state.filePreview}<div class="git-card"><div class="git-card-head"><span>{service.state.filePreview.path}</span><button class="icon-btn" aria-label="Close file preview" onclick={() => service.state.filePreview = null}>×</button></div><pre class="code-output">{service.state.filePreview.content}</pre></div>{/if}
		<div class="git-card"><div class="git-card-head"><span class="git-card-title">Task commits</span></div><pre class="code-output">{service.state.changes.commits || 'Changes are committed when you accept the result.'}</pre></div>
		{#if service.task.review}<div class="git-card"><div class="git-card-head"><span class="git-card-title">Soundcheck · {service.task.verdict ? 'Passed' : 'Changes required'}</span></div><div class="prose-text git-card-body">{service.task.review}</div></div>{/if}
	{/if}
</div></div>
