<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	import { isActive, taskStateLabel, taskStateTone, type Task } from './service.svelte.js';
	import { activityAgent, activityPhase } from './task-activity.js';
	import BotAvatar from './BotAvatar.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	const service = $derived(workspace.service);
	const columns = [
		{ key: 'planning', title: 'Planning', states: ['draft', 'planning', 'ready'] },
		{ key: 'progress', title: 'In progress', states: ['running', 'verifying', 'integrating'] },
		{ key: 'review', title: 'Review', states: ['review', 'failed', 'cancelled'] },
		{ key: 'done', title: 'Done', states: ['done'] }
	];
	const projectName = (id: string) => service.state.projects.find(project => project.id === id)?.name || 'Workspace';
	let drag = $state<{ id: string; pointerId: number; startX: number; startY: number; dx: number; dy: number; moved: boolean; target: number | null } | null>(null);
	let suppressClickUntil = 0;
	function open(task: Task) {
		if (performance.now() < suppressClickUntil) { suppressClickUntil = 0; return; }
		service.selectProject(task.project_id, task.id);
		workspace.setMode('editor');
		workspace.revealPreview('tasks');
	}
	function columnAt(x: number, y: number) {
		for (const element of document.elementsFromPoint(x, y)) {
			if (element.closest('.card.is-dragging')) continue;
			const column = element.closest('[data-column]');
			if (column instanceof HTMLElement) return Number(column.dataset.column);
		}
		return null;
	}
	function startCardDrag(event: PointerEvent, task: Task) {
		if (event.button !== 0 || drag) return;
		if ((event.target as HTMLElement).closest('.card-assignee')) return;
		if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('.card-grip')) return;
		drag = { id: task.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false, target: null };
		window.addEventListener('pointermove', moveCardDrag);
		window.addEventListener('pointerup', endCardDrag);
		window.addEventListener('pointercancel', cancelCardDrag);
	}
	function moveCardDrag(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;
		if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
		event.preventDefault();
		drag = { ...drag, dx, dy, moved: true, target: columnAt(event.clientX, event.clientY) };
	}
	function finishCardDrag(event: PointerEvent, commit: boolean) {
		window.removeEventListener('pointermove', moveCardDrag);
		window.removeEventListener('pointerup', endCardDrag);
		window.removeEventListener('pointercancel', cancelCardDrag);
		if (!drag || drag.pointerId !== event.pointerId) return;
		const current = drag;
		drag = null;
		if (!current.moved) return;
		suppressClickUntil = performance.now() + 250;
		if (!commit || current.target === null) return;
		const task = service.allTasks.find(item => item.id === current.id);
		if (task) moveTask(task, current.target);
	}
	function endCardDrag(event: PointerEvent) { finishCardDrag(event, true); }
	function cancelCardDrag(event: PointerEvent) { finishCardDrag(event, false); }
	function moveTask(task: Task, target: number) {
		const current = columns.findIndex(column => column.states.includes(task.state));
		const destination = columns[target];
		if (!destination || target === current) return;
		if (isActive(task)) { workspace.notify('Wait for the active run to finish before moving this task.'); return; }
		if (destination.key === 'progress') {
			if (!task.plan) { workspace.notify('Maestro needs a plan before this task can start.'); return; }
			if (!['ready', 'failed', 'cancelled', 'review'].includes(task.state)) { workspace.notify('Ask Maestro to finish the plan before starting work.'); return; }
			service.selectProject(task.project_id, task.id);
			void service.action('approve');
			return;
		}
		if (destination.key === 'done') {
			if (task.state !== 'review') { workspace.notify('Only a reviewed task can move to Done.'); return; }
			if (!task.verdict) { workspace.notify('The review must pass before this task can be completed.'); return; }
			service.selectProject(task.project_id, task.id);
			workspace.state.acceptOpen = true;
			return;
		}
		workspace.notify('Tasks move to Review automatically when the agent finishes. Accept one to move it to Done.');
	}
	function boardPan(node: HTMLElement) {
		let pan: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | null = null;
		let blockClickUntil = 0;
		const down = (event: PointerEvent) => {
			if (event.pointerType === 'touch' || event.button !== 0) return;
			if ((event.target as HTMLElement).closest('.card')) return;
			pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop, moved: false };
		};
		const move = (event: PointerEvent) => {
			if (!pan || pan.id !== event.pointerId) return;
			const dx = event.clientX - pan.x;
			const dy = event.clientY - pan.y;
			if (!pan.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
			if (!pan.moved) {
				pan.moved = true;
				node.classList.add('is-panning');
				try { node.setPointerCapture(pan.id); } catch { /* The pointer may already be gone. */ }
			}
			event.preventDefault();
			node.scrollLeft = pan.left - dx;
			node.scrollTop = pan.top - dy;
		};
		const up = (event: PointerEvent) => {
			if (!pan || pan.id !== event.pointerId) return;
			if (pan.moved) blockClickUntil = performance.now() + 250;
			try { node.releasePointerCapture(pan.id); } catch { /* The capture was already released. */ }
			pan = null;
			node.classList.remove('is-panning');
		};
		const click = (event: MouseEvent) => {
			if (performance.now() >= blockClickUntil) return;
			event.preventDefault();
			event.stopPropagation();
			blockClickUntil = 0;
		};
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', up);
		node.addEventListener('pointercancel', up);
		node.addEventListener('click', click, true);
		return {
			destroy() {
				node.removeEventListener('pointerdown', down);
				node.removeEventListener('pointermove', move);
				node.removeEventListener('pointerup', up);
				node.removeEventListener('pointercancel', up);
				node.removeEventListener('click', click, true);
			}
		};
	}
</script>
<div class="board-body" use:boardPan class:is-horizontal={workspace.state.boardLayout === 'horizontal'} class:is-vertical={workspace.state.boardLayout === 'vertical'}>
	{#each columns as column, index}
		{@const tasks = service.allTasks.filter(task => column.states.includes(task.state))}
		<div class="column" class:is-drop-target={drag?.moved && drag.target === index} data-column={index}>
			<div class="column-head"><span>{column.title}</span><span class="muted">{tasks.length}</span></div>
			<div class="column-cards">
				{#each tasks as task (task.id)}
					{@const activity = isActive(task) ? service.activityFor(task.id) : undefined}
					{@const agent = activityAgent(activity, task.state)}
					<article
						class="card"
						class:selected={service.state.taskId === task.id}
						class:is-dragging={drag?.id === task.id && drag.moved}
						style:transform={drag?.id === task.id && drag.moved ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined}
						onpointerdown={(event) => startCardDrag(event, task)}
					>
						<button class="card-open" type="button" aria-label={`${task.title}${task.assignee ? `, assigned to ${task.assignee}` : ''}`} onclick={() => open(task)}>
							<div class="card-top">
								<div class="card-project"><span class="state-dot tone-{taskStateTone(task.state)}"></span>{projectName(task.project_id)}</div>
							</div>
							<div class="card-title">{task.title}</div>
						</button>
						<button class="card-grip" type="button" title="Drag or use arrow keys to move" aria-label={`Move ${task.title} to another column`} onkeydown={(event) => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); const next = index + (event.key === 'ArrowRight' ? 1 : -1); if (next >= 0 && next < columns.length) moveTask(task, next); }}>
							<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><circle cx="4" cy="2.5" r="1" /><circle cx="8" cy="2.5" r="1" /><circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" /><circle cx="4" cy="9.5" r="1" /><circle cx="8" cy="9.5" r="1" /></svg>
						</button>
						<div class="card-foot">
							<span class="card-assignee" title="Assign teammate">
								<BotAvatar name={task.assignee || agent} />
								<select value={task.assignee} aria-label={`Assign ${task.title}`} disabled={service.state.pending} onchange={(event) => { void service.assignTask(task.id, event.currentTarget.value); }}>
									<option value="">Auto · {agent}</option>
									{#each service.state.teammates as member}<option value={member.id}>{member.id}</option>{/each}
								</select>
							</span>
							<span class="card-status">{activity ? activityPhase(activity) : taskStateLabel(task.state)}</span>
						</div>
					</article>
				{:else}<div class="muted small">No tasks</div>{/each}
			</div>
		</div>
	{/each}
</div>
