<script lang="ts">
	import type { Workspace } from './workspace/workspace.svelte.js';
	import { isActive, taskStateLabel, taskStateTone } from './workspace/service.svelte.js';
	import { activityAgent, activityDetail, activityPhase, clockLabel, eventLabel, eventText } from './workspace/task-activity.js';
	import ChangesPanel from './workspace/ChangesPanel.svelte';
	import BotAvatar from './workspace/BotAvatar.svelte';
	import TaskActions from './workspace/TaskActions.svelte';
	import WorkItemList from './workspace/WorkItemList.svelte';
	import RunSummary from './workspace/RunSummary.svelte';
	import LiveTime from './workspace/LiveTime.svelte';
	import NavigationIcon from './workspace/NavigationIcon.svelte';
	import { tooltip } from './workspace/interactions.js';
	let { workspace }: { workspace: Workspace } = $props();
	const ui = $derived(workspace.state);
	const service = $derived(workspace.service);
	const state = $derived(service.state);
	const tabs = [{ key: 'brief', label: 'Plan', icon: 'plan' }, { key: 'activity', label: 'Activity', icon: 'activity' }, { key: 'tasks', label: 'Task', icon: 'task' }, { key: 'team', label: 'Team', icon: 'team' }] as const;
	const activity = $derived(service.task ? service.activityFor(service.task.id) : undefined);
	const latestEvents = $derived([...state.events].slice(-24).reverse());
	const runs = $derived([...state.runs].reverse().slice(0, 8));
	const completed = $derived((service.task?.work_items || []).filter(item => item.state === 'completed').length);
	const planCount = $derived(service.task?.work_items.length || 0);
	const teamCount = $derived(state.teammates.length);
</script>
{#if ui.inspectorMode === 'compact'}
<div class="inspector-rail">
	<span class="inspector-rail-rule" aria-hidden="true"></span>
	<div class="inspector-rail-tabs">
		{#each tabs as tab}
			<button class="rail-tab" class:active={ui.previewTab === tab.key} aria-pressed={ui.previewTab === tab.key} title={tab.label} aria-label={tab.label} use:tooltip={{ enabled: true, label: tab.label, side: 'left' }} onclick={() => workspace.revealPreview(tab.key)}>
				<NavigationIcon kind={tab.icon} />
				{#if tab.key === 'brief' && planCount}<span class="rail-count">{planCount}</span>{/if}
				{#if tab.key === 'activity' && isActive(service.task)}<span class="rail-live"><span class="live-dot" aria-hidden="true"></span></span>{/if}
				{#if tab.key === 'team' && teamCount}<span class="rail-count">{teamCount}</span>{/if}
			</button>
		{/each}
	</div>
</div>
{:else}
<div class="inspector-head"><span class="inspector-title">{ui.inspectorPanel === 'changes' ? 'Git changes' : ui.previewTitle}</span><div class="inspector-head-actions"><button class="icon-btn" title="Collapse to compact rail" aria-label="Collapse preview sidebar to compact rail" onclick={() => workspace.compactInspector()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M9 8l4 4-4 4" /></svg></button><button class="icon-btn" title="Close panel" aria-label="Close panel" onclick={() => workspace.closeInspector()}>×</button></div></div>
<div class="inspector-tabs">{#each tabs as tab}<button class:active={ui.previewTab === tab.key} onclick={() => workspace.openPreview(tab.key)}>{tab.label}</button>{/each}</div>
<div class="inspector-body">
	{#if ui.previewTab === 'team'}
		{#each state.teammates as member}<div class="assignment"><div><div class="assignment-name">{member.id}</div><div class="assignment-meta">{member.role} · {state.harnesses[member.harness]?.label || member.harness} · {member.model || 'Agent default model'}</div></div><BotAvatar name={member.id} /></div><div class="preview-copy">{member.capabilities}</div>{#if member.escalation_model}<p class="muted">Escalation: {member.escalation_model}</p>{/if}{/each}
	{:else if service.task}
		<div class="overline"><span class="state-dot tone-{taskStateTone(service.task.state)}"></span>{taskStateLabel(service.task.state)}</div><div class="preview-title">{service.task.title}</div><div class="preview-copy">{service.task.goal}</div>
		{#if ui.previewTab === 'brief'}<div class="prose-text plan-content">{service.task.plan || 'Send a message to Maestro to clarify the goal and prepare a plan.'}</div><WorkItemList items={service.task.work_items || []} />
		{:else if ui.previewTab === 'activity'}
			{#if activity}
				<div class="live-card">
					<div class="live-card-head"><span class="live-dot" aria-hidden="true"></span><span>{activityAgent(activity, service.task.state)} · {activityPhase(activity)}</span><LiveTime since={activity.started_at} label="Run time" /></div>
					<div class="live-card-detail">{activityDetail(activity)}</div>
					{#if activity.work_item_title}<div class="work-progress"><span>{activity.item_index} of {activity.item_total} work items</span><span>{Math.round(activity.item_index / Math.max(1, activity.item_total) * 100)}%</span></div><div class="progress-track" aria-hidden="true"><span style={`width: ${Math.round(activity.item_index / Math.max(1, activity.item_total) * 100)}%`}></span></div>{/if}
				</div>
				<dl class="task-details">
					<dt>Agent</dt><dd>{activityAgent(activity, service.task.state)} · {state.harnesses[activity.harness]?.label || activity.harness || 'Codex'}</dd>
					<dt>Model</dt><dd>{activity.model || 'Agent default'}</dd>
					<dt>Started</dt><dd>{clockLabel(activity.started_at)}</dd>
					{#if activity.event_kind}<dt>Last event</dt><dd>{eventLabel(activity.event_kind)} · {clockLabel(activity.event_at)}</dd>{/if}
				</dl>
			{:else}
				<div class="activity-idle"><span class="state-dot tone-{taskStateTone(service.task.state)}"></span><div><strong>{isActive(service.task) ? 'Starting the run…' : 'No run in progress'}</strong><p class="muted">{service.task.state === 'ready' ? 'Approve the plan to start implementation.' : service.task.state === 'review' ? 'Review the diff and accept the result when it looks right.' : service.task.state === 'done' ? 'This result was integrated into the base branch.' : service.task.state === 'failed' || service.task.state === 'cancelled' ? 'Send a message or retry to recover this task.' : 'Live progress will appear here as soon as a run starts.'}</p></div></div>
			{/if}
			<div class="activity-overview"><span>Work items</span><span>{completed}/{service.task.work_items.length}</span></div>
			<WorkItemList items={service.task.work_items || []} />
			<div class="activity-overview"><span>Recent output</span><span>{latestEvents.length ? `${latestEvents.length} events` : 'Waiting'}</span></div>
			<ol class="activity-feed">
				{#each latestEvents as event (event.seq)}{@const detail = eventText(event.kind, event.text)}<li class="activity-event"><div class="activity-event-head"><span class="activity-event-kind">{eventLabel(event.kind)}</span><span class="activity-event-time">{clockLabel(event.created_at)}</span></div>{#if detail}<p>{detail}</p>{/if}</li>{:else}<li class="muted activity-empty">Output from the agent will appear here.</li>{/each}
			</ol>
			{#if runs.length}<details class="activity-runs"><summary>Run history · {state.runs.length}</summary>{#each runs as run (run.id)}<RunSummary {run} />{/each}</details>{/if}
		{:else}<WorkItemList items={service.task.work_items || []} /><dl class="task-details"><dt>Base branch</dt><dd>{service.project?.base_branch}</dd><dt>Task branch</dt><dd>{service.task.branch || 'Created after approval'}</dd><dt>Worktree</dt><dd>{service.task.worktree || 'Not created yet'}</dd></dl>{#each state.runs as run}<RunSummary {run} />{/each}{/if}
		{#if service.task.review}<div class="overline">Independent review · {service.task.verdict ? 'Passed' : 'Changes required'}</div><div class="prose-text plan-content">{service.task.review}</div>{/if}
		<div class="task-actions"><TaskActions {workspace} /></div>
	{:else}<p class="muted">Select a task to see its plan and progress.</p>{/if}
</div>
<ChangesPanel {workspace} />
{/if}
