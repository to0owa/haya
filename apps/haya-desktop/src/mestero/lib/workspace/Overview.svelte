<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import type { MemberName } from './workspace-data.js';
	import { isActive, type RecentActivity, type Task } from './service.svelte.js';
	import {
		activityDetail,
		activityPhase,
		agentForRun,
		needsOwner,
		runAction,
		runStateLabel,
		runStateTone,
		shortAge,
		taskActionLabel,
		taskStateLabel,
		taskStateTone
	} from './task-activity.js';
	import ActivityTrack from './ActivityTrack.svelte';
	import BotAvatar from './BotAvatar.svelte';
	import HandoffRail from './HandoffRail.svelte';
	import LiveTime from './LiveTime.svelte';

	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
	const data = $derived(service.state);
	let now = $state(Date.now() / 1000);
	$effect(() => {
		const timer = setInterval(() => { now = Date.now() / 1000; }, 30_000);
		return () => clearInterval(timer);
	});

	const activeTask = $derived(data.tasks.find(isActive));
	const activeActivity = $derived(activeTask ? service.activityFor(activeTask.id) : undefined);
	const liveRun = $derived(activeActivity ? data.recentActivity.find(run => run.run_id === activeActivity.run_id) : undefined);
	const latestRun = $derived(data.recentActivity[0]);
	const focusRun = $derived(activeTask ? liveRun : latestRun);
	const focusTask = $derived(activeTask || (latestRun ? data.tasks.find(task => task.id === latestRun.task_id) : undefined));
	const focusActivity = $derived(activeTask ? activeActivity : undefined);
	const focusProject = $derived(focusTask ? data.projects.find(project => project.id === focusTask.project_id) : undefined);
	const focusAgent = $derived(agentForRun(focusRun?.kind || focusActivity?.kind || '', focusTask?.state || ''));
	const focusPhase = $derived(focusActivity ? activityPhase(focusActivity) : focusTask ? taskStateLabel(focusTask.state) : focusRun ? runStateLabel(focusRun.state) : '');
	const focusKind = $derived(focusRun?.kind || focusActivity?.kind || '');
	const focusGate = $derived(focusTask?.state === 'ready' ? 'Approve plan' : focusTask?.state === 'review' ? 'Accept result' : '');
	const liveAgent = $derived(agentForRun(activeActivity?.kind || '', activeTask?.state || ''));
	const liveProject = $derived(activeTask ? data.projects.find(project => project.id === activeTask.project_id) : undefined);
	const livePhase = $derived(activityPhase(activeActivity) || (activeTask ? taskStateLabel(activeTask.state) : ''));
	const liveDetail = $derived(activityDetail(activeActivity) || (activeTask?.state === 'planning' ? 'Reading the brief and drawing up a plan.' : activeTask?.state === 'verifying' ? 'Checking the result independently.' : 'Working in the task worktree.'));
	const focusDetail = $derived.by(() => {
		if (activeTask) return liveDetail;
		if (!focusRun) return 'Ready for the next handoff.';
		if (focusTask?.state === 'ready') return 'Plan ready. Approve it to send Virtuoso into the task worktree.';
		if (focusTask?.state === 'review') return 'Soundcheck finished. Review the verdict, then accept the result.';
		if (focusTask?.state === 'done') return 'Accepted into the base branch. The task worktree is preserved.';
		if (focusRun.work_item_title) return `${focusRun.item_index}/${focusRun.item_total} · ${focusRun.work_item_title}`;
		return focusRun.event_text || 'Ready for the next handoff.';
	});

	const needs = $derived.by(() => {
		const priority = (task: Task) => ({ review: 0, ready: 1, failed: 2, cancelled: 3, draft: 4 }[task.state] ?? 5);
		return data.tasks
			.filter(task => needsOwner(task.state))
			.sort((a, b) => priority(a) - priority(b) || b.updated_at - a.updated_at);
	});
	const activeCount = $derived(data.tasks.filter(isActive).length);
	const delivered = $derived(data.tasks.filter(task => task.state === 'done').length);
	const recentRuns = $derived(data.recentActivity.filter(run => run.run_id !== activeActivity?.run_id).slice(0, 10));
	const availableHarnesses = $derived(Object.values(data.harnesses).filter(harness => harness.available).length);
	const harnessCount = $derived(Object.values(data.harnesses).length);

	const team = $derived.by(() => (['Maestro', 'Virtuoso', 'Soundcheck'] as const).map(name => {
		const template = data.teammates.find(member => member.id === name);
		const live = Boolean(activeTask && liveAgent === name);
		const latest = data.recentActivity.find(run => agentForRun(run.kind) === name);
		return {
			name,
			role: template?.role || (name === 'Maestro' ? 'Planning lead' : name === 'Virtuoso' ? 'Builder' : 'Reviewer'),
			live,
			detail: live ? livePhase : latest ? `${runAction(latest.kind, latest.state)} · ${shortAge(latest.finished_at || latest.started_at, now)}` : 'Standing by',
			task: live ? activeTask?.title || '' : latest?.task_title || ''
		};
	}));

	const headline = $derived(activeTask ? 'The team is on stage.' : needs.length ? 'A decision is waiting.' : 'All quiet in the studio.');
	const summary = $derived.by(() => {
		if (activeTask) return `${liveAgent} is ${livePhase.toLowerCase()} ${activeTask.title}${liveProject ? ` in ${liveProject.name}` : ''}.`;
		if (needs.length) return `${needs.length} ${needs.length === 1 ? 'task needs' : 'tasks need'} your call before the next run.`;
		if (!data.projects.length) return 'Connect a workspace and Maestro will prepare the first brief with you.';
		return `Maestro is standing by across ${data.projects.length} ${data.projects.length === 1 ? 'workspace' : 'workspaces'}. Ask for a new task when you are ready.`;
	});
	const projectName = (id: string) => data.projects.find(project => project.id === id)?.name || 'Workspace';
	function ageLabel(at: number) {
		const age = shortAge(at, now);
		if (age === 'now') return 'just now';
		return /^\d+[mhd]$/.test(age) ? `${age} ago` : age;
	}

	function openTask(task: Task) {
		service.selectProject(task.project_id, task.id);
		workspace.setMode('editor');
	}
	function openRun(run: RecentActivity) {
		service.selectProject(run.project_id, run.task_id);
		workspace.setMode('editor');
	}
	function openTeam(name: string) {
		workspace.selectMember(name as MemberName);
		workspace.setMode('team');
	}
	function startTask() {
		if (service.project) workspace.newTask();
		else data.dialog = 'project';
	}
</script>
<div class="overview-head">
	<div class="surface-heading"><div class="surface-title">Overview</div><span class="surface-state">· all projects</span></div>
	<div class="overview-head-actions">
		<span class="overview-slot" class:is-live={activeCount > 0}><span class="state-dot tone-{activeCount ? 'working' : 'muted'}"></span>{activeCount ? 'Workflow running' : 'Workflow ready'}</span>
		<button class="ghost overview-new" onclick={startTask}>New task</button>
	</div>
</div>
<div class="overview-body">
	<div class="overview-scroll">
		<header class="overview-intro">
			<div class="overview-intro-copy">
				<div class="overline">Owner console</div>
				<h1>{headline}</h1>
				<p>{summary}</p>
			</div>
			<div class="overview-metrics" aria-label="Workspace summary">
				<div><strong class:attention={needs.length > 0}>{needs.length}</strong><span>Needs you</span></div>
				<div><strong>{activeCount}</strong><span>In flight</span></div>
				<div><strong>{delivered}</strong><span>Delivered</span></div>
			</div>
		</header>

		<div class="overview-grid">
			<div class="overview-main">
				<section class="overview-panel live-panel" aria-label="Live workflow">
					<div class="overview-panel-head"><div class="overview-panel-title">{#if activeTask}<span class="live-dot" aria-hidden="true"></span>Live now{:else}Last handoff{/if}</div><span class="overview-panel-meta">{focusProject ? focusProject.name : 'All projects'}</span></div>
					{#if focusTask}
						<div class="overview-live" class:is-idle={!activeTask}>
							<div class="overview-live-top">
								<span class="overview-live-avatar"><BotAvatar name={focusAgent} /></span>
								<div class="overview-live-copy">
									<div class="overview-live-kicker">{focusAgent} · {focusPhase}</div>
									<h2>{focusTask.title}</h2>
									<p>{focusDetail}</p>
								</div>
								<div class="overview-live-time">
									{#if activeTask}<LiveTime since={focusActivity?.started_at || 0} label="Run time" /><span class="overview-run-id">{focusKind || 'run'} · live</span>{:else}<span class="overview-run-age">{ageLabel(focusRun?.finished_at || focusRun?.started_at || 0)}</span><span class="overview-run-id">{focusKind || 'run'} · {focusRun ? runStateLabel(focusRun.state).toLowerCase() : 'history'}</span>{/if}
								</div>
							</div>
							<HandoffRail state={focusTask.state} kind={focusKind} />
							<ActivityTrack events={focusRun?.track || []} startedAt={focusRun?.started_at || focusActivity?.started_at || 0} finishedAt={focusRun?.finished_at || null} active={Boolean(activeTask)} label={`${focusTask.title} run activity`} />
							<div class="overview-live-foot">
								<span class="overview-live-detail">{focusDetail}</span>
								<span class="overview-live-model">{focusRun?.harness || focusActivity?.harness || ''}{#if focusRun?.model || focusActivity?.model} · {focusRun?.model || focusActivity?.model}{/if}</span>
								{#if focusGate}<span class="owner-gate"><span class="owner-gate-dot"></span>You · {focusGate}</span>{/if}
								<button class="overview-link" onclick={() => openTask(focusTask)}>Open task ↗</button>
							</div>
						</div>
					{:else}
						<div class="overview-idle">
							<span class="overview-idle-avatar"><BotAvatar name="Maestro" /></span>
							<div><strong>The stage is quiet.</strong><p>Maestro is standing by. Start a task and the team will pick up the next handoff.</p></div>
							<button class="ghost" onclick={startTask}>{service.project ? 'Start a task' : 'Connect workspace'}</button>
						</div>
					{/if}
				</section>

				<section class="overview-panel" aria-label="Tasks that need you">
					<div class="overview-panel-head"><div class="overview-panel-title">Needs you</div><span class="overview-panel-meta">{needs.length} open {needs.length === 1 ? 'decision' : 'decisions'}</span></div>
					{#if needs.length}
						<div class="owner-list">
							{#each needs.slice(0, 5) as task (task.id)}
								<button class="owner-row" onclick={() => openTask(task)}>
									<span class="owner-tone tone-{taskStateTone(task.state)}" aria-hidden="true"></span>
									<span class="owner-copy"><strong>{task.title}</strong><span>{projectName(task.project_id)} · {taskStateLabel(task.state)}</span></span>
									<span class="owner-action">{taskActionLabel(task.state)}</span>
									<span class="owner-age">{shortAge(task.updated_at, now)}</span>
								</button>
							{/each}
						</div>
						{#if needs.length > 5}<button class="overview-more" onclick={() => workspace.setMode('board')}>View all {needs.length} on the board →</button>{/if}
					{:else}
						<div class="overview-empty"><span class="overview-empty-mark" aria-hidden="true">✓</span><div><strong>Nothing waiting on you.</strong><span>The team is caught up. New decisions will appear here.</span></div></div>
					{/if}
				</section>

				<section class="overview-panel" aria-label="Recent activity">
					<div class="overview-panel-head"><div class="overview-panel-title">Recent activity</div><span class="overview-panel-meta">Across every project</span></div>
					{#if recentRuns.length}
						<div class="recent-list">
							{#each recentRuns as run (run.run_id)}
								<button class="recent-row" onclick={() => openRun(run)}>
									<span class="recent-avatar"><BotAvatar name={agentForRun(run.kind)} /></span>
									<span class="recent-copy">
										<span class="recent-line"><strong>{agentForRun(run.kind)}</strong> {runAction(run.kind, run.state)} {run.task_title}</span>
										<span class="recent-meta">{run.project_name || projectName(run.project_id)} · {runStateLabel(run.state)} · {ageLabel(run.finished_at || run.started_at)}</span>
									</span>
									<span class="recent-track"><ActivityTrack events={run.track} startedAt={run.started_at} finishedAt={run.finished_at} compact label={`${run.task_title} ${run.kind} activity`} /></span>
									<span class="recent-state tone-{runStateTone(run.state)}">{runStateLabel(run.state)}</span>
								</button>
							{/each}
						</div>
					{:else}
						<div class="overview-empty"><span class="overview-empty-mark" aria-hidden="true">◌</span><div><strong>No runs yet.</strong><span>When the team picks up work, the handoff history lands here.</span></div></div>
					{/if}
				</section>
			</div>

			<aside class="overview-side">
				<section class="overview-panel" aria-label="Team">
					<div class="overview-panel-head"><div class="overview-panel-title">Team</div><button class="overview-link" onclick={() => workspace.setMode('team')}>Settings ↗</button></div>
					<div class="team-strip">
						{#each team as member (member.name)}
							<button class="team-row" onclick={() => openTeam(member.name)}>
								<span class="team-avatar"><BotAvatar name={member.name} /></span>
								<span class="team-copy"><strong>{member.name}</strong><span>{member.role}</span>{#if member.task}<span class="team-task">{member.task}</span>{/if}</span>
								<span class="team-state" class:is-live={member.live}>{#if member.live}<span class="live-dot" aria-hidden="true"></span>{:else}<span class="state-dot tone-muted"></span>{/if}{member.detail}</span>
							</button>
						{/each}
					</div>
				</section>

				<section class="overview-panel" aria-label="Shared limits">
					<div class="overview-panel-head"><div class="overview-panel-title">Shared limits</div><span class="overview-panel-meta">MVP</span></div>
					<div class="limit-list">
						<div class="limit-row"><span>Workflow slot</span><strong class:is-live={activeCount > 0}>{activeCount} / 1</strong></div>
						<div class="limit-row"><span>Agents ready</span><strong class={availableHarnesses ? '' : 'is-warn'}>{availableHarnesses} / {harnessCount || 3}</strong></div>
						<div class="limit-row"><span>Projects</span><strong>{data.projects.length}</strong></div>
						<p class="limit-note">One workflow at a time. Availability checks the installed CLI, not login or model access.</p>
					</div>
				</section>

				<section class="overview-panel automation-panel" aria-label="Automation">
					<div class="overview-panel-head"><div class="overview-panel-title">Automation</div><span class="soon-tag">Soon</span></div>
					<p class="automation-copy">Recurring briefs and scheduled checks will be owned by Maestro, with the same owner gates.</p>
					<div class="automation-rule" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
					<span class="automation-note">Not available in this build</span>
				</section>
			</aside>
		</div>
	</div>
</div>
