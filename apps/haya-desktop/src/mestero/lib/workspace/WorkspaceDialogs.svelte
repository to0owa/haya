<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import Modal from './Modal.svelte';
	import WorkspacePicker from './WorkspacePicker.svelte';
	import GitSetupPrompt from './GitSetupPrompt.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
	const backend = $derived(service.state);
	let projectName = $state(''), projectPath = $state('');
	let browsing = $state(false);
	$effect(() => { if (backend.dialog !== 'project') { browsing = false; if (service.setupPreview) service.clearSetupPreview(); } });
</script>
<Modal open={backend.dialog === 'project'} title={service.setupPreview ? 'Set up Git for this workspace?' : 'Connect a workspace'} onclose={() => backend.dialog = ''}>
	{#if service.setupPreview}
		{#key service.setupPreview.id}<GitSetupPrompt preview={service.setupPreview} pending={backend.pending} error={backend.error} onback={() => service.clearSetupPreview()} onconfirm={service.confirmGitSetup} />{/key}
	{:else}
	<form onsubmit={async event => { event.preventDefault(); await service.createProject(projectName, projectPath); if (!backend.dialog) { projectName = ''; projectPath = ''; } }}>
		{#if backend.projects.length}<div class="connected-projects">{#each backend.projects as project}<button type="button" class="project-choice" onclick={() => { service.selectProject(project.id); backend.dialog = ''; }}><strong>{project.name}</strong><span>{project.path}</span></button>{/each}</div><div class="menu-divider"></div>{/if}
        <p class="muted">Choose a folder on the Mestero server. If Git needs setup, you’ll review and approve the changes before connecting.</p>
		<label class="form-label" for="project-name">Workspace name</label><input class="field" id="project-name" bind:value={projectName} required maxlength="120" placeholder="My workspace" />
		<label class="form-label" for="project-path">Workspace folder</label>
		<div class="workspace-path-field"><input class="field" id="project-path" bind:value={projectPath} required placeholder="Choose a workspace folder" /><button type="button" class="ghost" aria-expanded={browsing} onclick={() => browsing = !browsing}>Browse…</button></div>
		{#if browsing}<WorkspacePicker initialPath={projectPath} load={service.browseDirectories} onclose={() => browsing = false} onselect={selected => { projectPath = selected.path; if (!projectName.trim()) projectName = selected.name; browsing = false; }} />{/if}
		{#if backend.error}<p class="form-error" role="alert">{backend.error}</p>{/if}
		<div class="dialog-actions"><button type="button" class="ghost" onclick={() => backend.dialog = ''}>Cancel</button><button class="primary" disabled={backend.pending}>{backend.pending ? 'Connecting…' : 'Connect workspace'}</button></div>
	</form>
	{/if}
</Modal>

<style>
	.workspace-path-field { display: flex; align-items: stretch; gap: 8px; }
	.workspace-path-field input { min-width: 0; flex: 1; }
	.workspace-path-field button { flex: none; }
</style>
<Modal open={workspace.state.acceptOpen} title="Accept and integrate result?" onclose={() => workspace.state.acceptOpen = false}>
    <p>This commits the reviewed changes in the task worktree and fast-forwards <strong>{service.project?.base_branch}</strong>. Nothing is pushed.</p>
    <p class="muted">{service.task?.title} · Soundcheck: {service.task?.verdict ? 'Passed' : 'Not passed'}</p>
    <button class="ghost" onclick={() => { workspace.state.acceptOpen = false; workspace.toggleChanges(); }}>Review diff first</button>
    {#if backend.error}<p class="form-error" role="alert">{backend.error}</p>{/if}
    <div class="dialog-actions"><button class="ghost" onclick={() => workspace.state.acceptOpen = false}>Cancel</button><button class="primary" disabled={service.busy || !service.task?.verdict} onclick={async () => { await service.action('accept'); if (service.task?.state === 'done') workspace.state.acceptOpen = false; }}>Accept and integrate</button></div>
</Modal>
