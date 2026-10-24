<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import Modal from './Modal.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let query = $state('');
	const actions = $derived([
		{ label: 'Overview', run: () => workspace.setMode('overview'), enabled: true },
		{ label: 'New task', run: () => workspace.newTask(), enabled: Boolean(workspace.service.project) },
		{ label: 'Connect workspace', run: () => workspace.service.state.dialog = 'project', enabled: true },
		{ label: 'Task board', run: () => workspace.setMode('board'), enabled: true },
		{ label: 'Team settings', run: () => workspace.setMode('team'), enabled: true },
		{ label: 'Toggle task sidebar', run: () => workspace.state.sidebarToggle++, enabled: true },
		{ label: 'Toggle preview', run: () => workspace.toggleInspector(), enabled: true },
		{ label: 'Toggle run output', run: () => workspace.state.terminalOpen = !workspace.state.terminalOpen, enabled: true },
		{ label: 'Toggle theme', run: () => workspace.setTheme(workspace.state.theme === 'light' ? 'dark' : 'light'), enabled: true },
		...workspace.service.allTasks.map(task => {
			const project = workspace.service.state.projects.find(item => item.id === task.project_id);
			return { label: `Open task: ${task.title}${project ? ` · ${project.name}` : ''}`, enabled: true, run: () => { workspace.service.selectProject(task.project_id, task.id); workspace.setMode('editor'); } };
		})
	].filter(action => action.enabled && action.label.toLowerCase().includes(query.toLowerCase())));
	function run(action: { run: () => unknown }) { workspace.state.commandOpen = false; query = ''; action.run(); }
</script>
<svelte:window onkeydown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); workspace.state.commandOpen = !workspace.state.commandOpen; } }} />
<Modal open={workspace.state.commandOpen} title="Command palette" onclose={() => { workspace.state.commandOpen = false; query = ''; }}>
	<input class="field" aria-label="Search commands and tasks" placeholder="Search commands and tasks…" bind:value={query} onkeydown={event => { if (event.key === 'Enter' && actions[0]) { event.preventDefault(); run(actions[0]); } }} />
	<div class="command-results">{#each actions as action}<button class="project-choice" onclick={() => run(action)}>{action.label}</button>{:else}<p class="muted">No matching commands.</p>{/each}</div>
</Modal>
<Modal open={workspace.state.helpOpen} title="Mestero · local MVP" onclose={() => workspace.state.helpOpen = false}>
	<ol class="help-steps"><li>Choose a workspace folder on the Mestero server. If Git needs setup, review the initial files and approve setup before connecting.</li><li>Create a task and chat with Maestro to clarify the goal.</li><li>Review the plan. Implementation uses a separate Git branch and worktree for each task.</li><li>Choose Proceed, then inspect Soundcheck’s verdict, diff, and run output.</li><li>Accept a passing result to integrate it into the unchanged, clean base branch.</li></ol>
	<p class="muted">⌘/Ctrl K opens commands. Enter sends a message; Shift+Enter inserts a new line. Escape closes dialogs. Sidebar grabbers support arrows, Home/End and Enter.</p>
	<p class="muted">Tasks and runs live in the service. Closing this browser does not cancel work. One workflow runs at a time. Choose an installed, logged-in Codex, Claude Code, or OpenCode agent in Team Settings, with a default model and optional escalation model.</p>
</Modal>
