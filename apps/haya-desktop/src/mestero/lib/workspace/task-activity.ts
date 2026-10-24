// One line of live information about a workflow run, mirrored from the
// `/api/workspace` activity payload in `service/src/api.rs`.
export type TaskActivity = {
	task_id: string;
	project_id: string;
	run_id: string;
	kind: string;
	state: string;
	harness: string;
	model: string;
	tier: string;
	work_item_id: string;
	work_item_title: string;
	item_index: number;
	item_total: number;
	started_at: number;
	event_kind: string;
	event_text: string;
	event_at: number;
};

export type ActivityTick = { kind: string; at: number };

// A completed (or still running) workflow run across all projects. Mirrors the
// `recent_activity` payload in `service/src/api.rs`.
export type RecentActivity = {
	run_id: string;
	task_id: string;
	task_title: string;
	task_state: string;
	project_id: string;
	project_name: string;
	kind: string;
	state: string;
	harness: string;
	model: string;
	work_item_id: string;
	work_item_title: string;
	item_index: number;
	item_total: number;
	started_at: number;
	finished_at: number | null;
	event_kind: string;
	event_text: string;
	event_at: number;
	track: ActivityTick[];
};

export const taskStateLabel = (state: string) => ({
	draft: 'Needs input',
	planning: 'Planning',
	ready: 'Plan ready',
	running: 'Building',
	verifying: 'Reviewing',
	integrating: 'Integrating',
	review: 'Review',
	done: 'Integrated',
	failed: 'Failed',
	cancelled: 'Cancelled'
}[state] || state);

// Tones are shared by status pills, task dots and the live run card.
export const taskStateTone = (state: string) => ({
	draft: 'input',
	planning: 'working',
	ready: 'ready',
	running: 'working',
	verifying: 'working',
	integrating: 'working',
	review: 'review',
	done: 'done',
	failed: 'attention',
	cancelled: 'muted'
}[state] || 'muted');

export function agentForRun(kind: string, state = ''): string {
	if (kind === 'build') return 'Virtuoso';
	if (kind === 'verify') return 'Soundcheck';
	if (kind === 'plan' || kind === 'consult') return 'Maestro';
	if (state === 'running') return 'Virtuoso';
	if (state === 'verifying' || state === 'review' || state === 'integrating') return 'Soundcheck';
	return 'Maestro';
}

export function activityAgent(activity: TaskActivity | null | undefined, state = ''): string {
	return agentForRun(activity?.kind || '', state);
}

export const needsOwner = (state: string) => ['draft', 'ready', 'review', 'failed', 'cancelled'].includes(state);

export function taskActionLabel(state: string): string {
	return ({
		draft: 'Add a brief',
		ready: 'Approve plan',
		review: 'Review result',
		failed: 'Retry or revise',
		cancelled: 'Restart task'
	}[state] || 'Open task');
}

export function runAction(kind: string, state = ''): string {
	const present: Record<string, string> = {
		plan: 'is planning',
		build: 'is building',
		verify: 'is reviewing',
		consult: 'is consulting'
	};
	const stopped: Record<string, string> = {
		plan: 'could not finish planning',
		build: 'hit a blocker building',
		verify: 'found an issue reviewing',
		consult: 'could not resolve the blocker'
	};
	const past: Record<string, string> = {
		plan: 'planned',
		build: 'built',
		verify: 'reviewed',
		consult: 'consulted'
	};
	if (state === 'running') return present[kind] || 'is working';
	if (state === 'failed' || state === 'interrupted') return stopped[kind] || 'hit a blocker';
	return past[kind] || 'worked on';
}

export function runStateLabel(state: string): string {
	return ({
		running: 'In progress',
		succeeded: 'Complete',
		failed: 'Blocked',
		interrupted: 'Interrupted',
		queued: 'Queued'
	}[state] || state);
}

export function runStateTone(state: string): string {
	return ({
		running: 'working',
		succeeded: 'done',
		failed: 'attention',
		interrupted: 'muted'
	}[state] || 'muted');
}

// 0 = planning, 1 = building, 2 = reviewing. A negative active index means no
// stage is running (owner gate or a stopped task).
export function handoffProgress(state: string, kind = ''): { active: number; complete: number; stoppedAt: number } {
	const index = kind === 'verify' ? 2 : kind === 'build' ? 1 : 0;
	if (state === 'planning' || state === 'draft') return { active: 0, complete: 0, stoppedAt: -1 };
	if (state === 'ready') return { active: -1, complete: 1, stoppedAt: -1 };
	if (state === 'running') return { active: 1, complete: 1, stoppedAt: -1 };
	if (state === 'verifying' || state === 'integrating') return { active: 2, complete: 2, stoppedAt: -1 };
	if (state === 'review' || state === 'done') return { active: -1, complete: 3, stoppedAt: -1 };
	if (state === 'failed' || state === 'cancelled') return { active: -1, complete: index, stoppedAt: index };
	return { active: -1, complete: 0, stoppedAt: -1 };
}

// Spread point-in-time events across a run's horizon. Harness events can share a
// second, so clumped timestamps get an even visual rhythm instead of stacking.
export function trackPositions(events: { at: number }[], start: number, end: number): number[] {
	if (!events.length) return [];
	const first = Number.isFinite(start) && start > 0 ? start : events[0].at;
	const last = Math.max(
		Number.isFinite(end) && end > first ? end : 0,
		...events.map(event => event.at),
		first + 1
	);
	const span = Math.max(1, last - first);
	const positions = events.map(event => Math.max(0, Math.min(1, (event.at - first) / span)));
	if (events.length > 1 && Math.max(...positions) - Math.min(...positions) < 0.02) {
		return events.map((_, index) => 0.04 + 0.92 * (index / Math.max(1, events.length - 1)));
	}
	return positions.map(position => 0.02 + 0.96 * position);
}

export function trackTone(kind: string): string {
	if (['failed', 'error', 'stderr', 'interrupted', 'blocked'].includes(kind)) return 'error';
	if (['succeeded', 'completed', 'result', 'thread.completed'].includes(kind)) return 'done';
	return 'event';
}

export function activityPhase(activity: TaskActivity | null | undefined): string {
	if (!activity) return '';
	return ({
		plan: 'Planning',
		build: 'Building',
		verify: 'Reviewing',
		consult: 'Consulting'
	}[activity.kind] || eventLabel(activity.event_kind));
}

export function activityDetail(activity: TaskActivity | null | undefined): string {
	if (!activity) return '';
	if (activity.work_item_title) {
		const progress = activity.item_total > 0 ? `${activity.item_index}/${activity.item_total} · ` : '';
		return `${progress}${activity.work_item_title}`;
	}
	const text = eventText(activity.event_kind, activity.event_text);
	if (text) return text;
	return ({
		plan: 'Reading the brief and drafting a plan',
		build: 'Working in the task worktree',
		verify: 'Checking the result independently',
		consult: 'Working through a blocker'
	}[activity.kind] || 'Working');
}

export function eventLabel(kind: string): string {
	return ({
		'thread.started': 'Session',
		'thread.completed': 'Session complete',
		'turn.started': 'Turn',
		'turn.completed': 'Turn complete',
		'item.started': 'Step',
		'item.updated': 'Update',
		'item.completed': 'Step',
		result: 'Result',
		text: 'Message',
		step_finish: 'Step complete',
		route: 'Route',
		stderr: 'Error',
		error: 'Error',
		succeeded: 'Run complete',
		completed: 'Complete',
		failed: 'Error',
		started: 'Started'
	}[kind] || kind || 'Event');
}

const protocolKinds = new Set(['thread.started', 'thread.completed', 'turn.started', 'turn.completed', 'item.started', 'item.updated', 'item.completed', 'step_start', 'step_finish', 'result', 'succeeded', 'completed', 'failed', 'error', 'route', 'started']);

function object(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function field(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

// Harness streams wrap prose in protocol JSON. Keep the prose and drop the envelope.
export function eventText(kind: string, text: string): string {
	const value = text.trim();
	if (!value) return '';
	if (!value.startsWith('{') || !protocolKinds.has(kind)) return value;
	let payload: Record<string, unknown> | null = null;
	try { payload = object(JSON.parse(value)); } catch { return value; }
	if (!payload) return value;
	for (const key of ['text', 'message', 'summary', 'result']) {
		const content = field(payload[key]);
		if (content) return content;
	}
	const item = object(payload.item);
	if (item) {
		const content = field(item.text);
		if (content) return content;
	}
	const part = object(payload.part);
	if (part) {
		const content = field(part.text);
		if (content) return content;
	}
	const error = object(payload.error);
	if (error) {
		const content = field(error.message);
		if (content) return content;
	}
	const usage = object(payload.usage);
	if (usage && (typeof usage.input_tokens === 'number' || typeof usage.output_tokens === 'number')) {
		return `${usage.input_tokens ?? 0} input · ${usage.output_tokens ?? 0} output tokens`;
	}
	return '';
}

export function elapsedLabel(start: number, now: number): string {
	if (!start || !Number.isFinite(start) || !Number.isFinite(now)) return '';
	const seconds = Math.max(0, Math.floor(now - start));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const rest = seconds % 60;
	if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
	return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function shortAge(at: number, now: number): string {
	if (!at || !Number.isFinite(at)) return '';
	const seconds = Math.max(0, now - at);
	if (seconds < 45) return 'now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${Math.max(1, minutes)}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	return new Date(at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function clockLabel(at: number): string {
	if (!at || !Number.isFinite(at)) return '';
	return new Date(at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function messageTimeLabel(at: number, now = Date.now() / 1000): string {
	if (!at || !Number.isFinite(at)) return '';
	const date = new Date(at * 1000);
	const current = new Date(now * 1000);
	const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	if (date.toDateString() === current.toDateString()) return time;
	return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}
