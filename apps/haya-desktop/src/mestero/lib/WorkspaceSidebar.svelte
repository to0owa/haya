<script lang="ts">
	import type { Workspace } from './workspace/workspace.svelte.js';
	import type { Task } from './workspace/service.svelte.js';
	import { isActive, taskStateLabel, taskStateTone } from './workspace/service.svelte.js';
	import { activityAgent, activityDetail, needsOwner, shortAge } from './workspace/task-activity.js';
	import NavigationIcon from './workspace/NavigationIcon.svelte';
	import BotAvatar from './workspace/BotAvatar.svelte';
	import LiveTime from './workspace/LiveTime.svelte';
	import { tooltip } from './workspace/interactions.js';
	let { workspace }: { workspace: Workspace } = $props();
	const ui = $derived(workspace.state);
	const service = $derived(workspace.service);
	const data = $derived(service.state);
	let now = $state(Date.now() / 1000);
	let collapsed = $state<Record<string, boolean>>({});
	let collapsedGroups = $state<Record<string, boolean>>({});
	let lastProject = '';
	$effect(() => {
		const timer = setInterval(() => { now = Date.now() / 1000; }, 30_000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		if (data.projectId !== lastProject) {
			lastProject = data.projectId;
			collapsed[data.projectId] = false;
		}
	});
	const projects = $derived.by(() => {
		const selected = service.project;
		return selected ? [selected, ...data.projects.filter(project => project.id !== selected.id)] : data.projects;
	});
	const activeTask = $derived.by(() => data.tasks.find(isActive));
	const activeActivity = $derived(activeTask ? service.activityFor(activeTask.id) : undefined);
	const activeProject = $derived(activeTask ? data.projects.find(project => project.id === activeTask.project_id) : undefined);
	const needsCount = $derived(data.tasks.filter(task => needsOwner(task.state)).length);
	const open = (id: string) => id === data.projectId && !collapsed[id];
	function groupFor(tasks: Task[]) {
		const visible = tasks.filter(task => !isActive(task));
		return [
			{ key: 'needs', label: 'Needs you', note: 'fix or retry', items: visible.filter(task => ['draft', 'failed', 'cancelled'].includes(task.state)) },
			{ key: 'ready', label: 'Plan ready', note: 'approve', items: visible.filter(task => task.state === 'ready') },
			{ key: 'review', label: 'In review', note: 'accept', items: visible.filter(task => task.state === 'review') },
			{ key: 'done', label: 'Completed', note: '', items: visible.filter(task => task.state === 'done') }
		].filter(group => group.items.length);
	}
	function chooseProject(id: string) {
		if (id !== data.projectId) {
			service.selectProject(id);
			collapsed[id] = false;
			return;
		}
		collapsed[id] = !collapsed[id];
	}
	const groupKey = (projectId: string, group: string) => `${projectId}:${group}`;
	function groupCollapsed(projectId: string, group: string) {
		const key = groupKey(projectId, group);
		if (key in collapsedGroups) return collapsedGroups[key];
		if (group === 'done') {
			const selected = data.tasks.find(task => task.id === data.taskId);
			return !(selected && selected.project_id === projectId && selected.state === 'done');
		}
		return false;
	}
	function toggleGroup(projectId: string, group: string) {
		collapsedGroups[groupKey(projectId, group)] = !groupCollapsed(projectId, group);
	}
	function openTask(task: Task) {
		service.selectProject(task.project_id, task.id);
		workspace.setMode('editor');
	}
</script>
<div class="side-head">
	<button class="mobile-sidebar-close icon-btn" aria-label="Close task sidebar" onclick={() => ui.sidebarToggle++}>×</button>
	<div class="side-head-top">
		<div class="sidebar-brand" role="img" aria-label="Mestero"><span class="sidebar-brand-mark" aria-hidden="true"></span><span class="sidebar-brand-label" aria-hidden="true"></span></div>
		<div class="side-head-actions">
			<button class="side-action" title="Search and jump (⌘ K)" aria-label="Search and jump" onclick={() => ui.commandOpen = true}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
			</button>
			<button class="side-action" title="New task" aria-label="New task" disabled={!service.project || data.pending} onclick={() => workspace.newTask()}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			</button>
		</div>
	</div>
</div>
<div class="side-scroll"><div class="side-list-content">
	{#if data.loading}<div class="section-row">Loading workspace…</div>
	{:else if !data.connected}<div class="section-row">Service offline</div>
	{:else if !data.projects.length}
		<div class="sidebar-empty"><p>No workspaces yet.</p><button class="primary" onclick={() => { data.error = ''; data.dialog = 'project'; }}>Connect a workspace</button></div>
	{:else}
		{#if activeTask}
			<button class="active-run" onclick={() => { if (activeTask) { service.selectProject(activeTask.project_id, activeTask.id); workspace.setMode('editor'); } }} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: `Active: ${activeTask.title}` }}>
				<span class="active-run-avatar"><BotAvatar name={activityAgent(activeActivity, activeTask.state)} /></span>
				<span class="active-run-copy">
					<span class="active-run-kicker"><span class="live-dot" aria-hidden="true"></span>Active now{#if activeProject && activeProject.id !== data.projectId} · {activeProject.name}{/if}</span>
					<span class="active-run-title">{activeTask.title}</span>
					<span class="active-run-meta">{activityAgent(activeActivity, activeTask.state)} · {activityDetail(activeActivity) || 'Working'}</span>
				</span>
				{#if activeActivity}<LiveTime since={activeActivity.started_at} label="Run time" />{/if}
			</button>
		{/if}
		<div class="project-list">
			{#each projects as project (project.id)}
				{@const tasks = data.tasks.filter(task => task.project_id === project.id)}
				{@const running = tasks.filter(isActive).length}
				{@const expanded = open(project.id)}
				<div class="project-group" class:selected={project.id === data.projectId}>
					<button class="project-head" class:selected={project.id === data.projectId} onclick={() => chooseProject(project.id)} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: project.name }}>
						<span class="project-icon">{project.name.slice(0, 2).toUpperCase()}</span>
						<span class="project-name">{project.name}</span>
						<span class="project-rule" aria-hidden="true"></span>
						{#if running}<span class="project-live" title={`${running} active`}><span class="live-dot" aria-hidden="true"></span>{running}</span>{/if}
						<span class="project-count">{tasks.length}</span>
						<svg class="project-chevron" class:open={expanded} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
					</button>
					{#if expanded}
						<div class="project-tasks">
							{#if !tasks.length}<div class="project-empty">No tasks yet. Start in the chat.</div>{/if}
							{#each groupFor(tasks) as group (group.key)}
								<div class="task-group">
									<button class="task-group-head" type="button" onclick={() => toggleGroup(project.id, group.key)} aria-expanded={!groupCollapsed(project.id, group.key)}><span>{group.label}</span>{#if group.note}<span class="task-group-note">{group.note}</span>{/if}<span class="task-group-count">{group.items.length}</span><svg class="task-group-chevron" class:open={!groupCollapsed(project.id, group.key)} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
							{#if !groupCollapsed(project.id, group.key)}
									{#each group.items as task (task.id)}
										<button class="side-item task-row" class:selected={data.taskId === task.id} onclick={() => openTask(task)} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: `${task.title} · ${taskStateLabel(task.state)}` }}>
											<span class="task-icon tone-{taskStateTone(task.state)}" aria-hidden="true"><span class="task-dot"></span></span>
											<span class="name">{task.title}</span>
											<span class="task-age">{shortAge(task.updated_at, now)}</span>
										</button>
									{/each}
								{/if}
								</div>
							{/each}
							<button class="side-item new-task-row" id="new-task" class:selected={Boolean(service.project) && !data.taskId} disabled={!service.project || data.pending} onclick={() => workspace.newTask()} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: 'New task' }}>
								<span class="task-icon task-icon--new">＋</span><span class="name">New task</span>
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
		<button class="connect-project" onclick={() => { data.error = ''; data.dialog = 'project'; }} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: 'Connect workspace' }}>
			<span class="connect-plus" aria-hidden="true">＋</span><span>Connect workspace</span>
		</button>
	{/if}
</div></div>
<nav class="subnav" aria-label="Workspace views">
	<button class="subtab" class:active={ui.mode === 'overview'} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: 'Overview' }} onclick={() => workspace.setMode('overview')}><span class="subtab-icon"><NavigationIcon kind="overview" /></span><span class="subtab-label">Overview</span>{#if needsCount}<span class="count count-attention">{needsCount}</span>{/if}</button>
	<button class="subtab" class:active={ui.mode === 'editor'} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: 'Tasks' }} onclick={() => workspace.setList('tasks')}><span class="subtab-icon"><NavigationIcon kind="tasks" /></span><span class="subtab-label">Tasks</span><span class="count">{service.tasks.length}</span></button>
	<button class="subtab" class:active={ui.mode === 'board'} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: 'Board' }} onclick={() => workspace.setMode('board')}><span class="subtab-icon"><NavigationIcon kind="board" /></span><span class="subtab-label">Board</span>{#if activeTask}<span class="subtab-live"><span class="live-dot" aria-hidden="true"></span></span>{/if}</button>
	<button class="subtab" class:active={ui.mode === 'team'} use:tooltip={{ enabled: ui.sidebarMode === 'compact', label: 'Team' }} onclick={() => workspace.setMode('team')}><span class="subtab-icon"><NavigationIcon kind="team" /></span><span class="subtab-label">Team</span></button>
	<button class="subtab is-soon" disabled aria-disabled="true" aria-label="Automation, coming soon" title="Automation · coming soon"><span class="subtab-icon"><NavigationIcon kind="automation" /></span><span class="subtab-label">Automation</span><span class="soon-tag">Soon</span></button>
</nav>
