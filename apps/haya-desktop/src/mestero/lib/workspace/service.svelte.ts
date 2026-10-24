import { readChatDrafts, writeChatDrafts } from './chat-drafts.js';
import { deriveTaskGoal, deriveTaskMessage, deriveTaskTitle } from './task-draft.js';
import type { RecentActivity, TaskActivity } from './task-activity.js';

export { taskStateLabel, taskStateTone } from './task-activity.js';
export type { RecentActivity, TaskActivity } from './task-activity.js';

export type Project = { id: string; name: string; path: string; base_branch: string };
export type GitSetupPreview = { id: string; name: string; path: string; branch: string; initialize: boolean; files: { path: string; bytes: number }[]; ignore_additions: string; expires_at: number };
type WorkspacePreparation = { project?: Project; setup?: GitSetupPreview };
export type WorkItem = { id: string; title: string; instructions: string; acceptance: string[]; paths: string[]; depends_on: string[]; state: string; result: string };
export type Task = { id: string; project_id: string; title: string; goal: string; state: string; plan: string; review: string; verdict: boolean | null; branch: string; worktree: string; base_commit: string; assignee: string; created_at: number; updated_at: number; work_items: WorkItem[] };
export type Attachment = { id: string; task_id: string; name: string; size: number };
export type Message = { id: string; task_id: string; role: string; text: string; attachments: Attachment[]; created_at: number };
export type Run = { id: string; task_id: string; kind: string; state: string; error: string; started_at: number; finished_at: number | null; harness: string; model: string; observed_model: string; tier: string; route_reason: string; work_item_id: string; parent_run_id: string; usage: { input_tokens: number | null; output_tokens: number | null; cached_input_tokens: number | null; cache_write_tokens: number | null; cost_usd: number | null; coverage: string } };
export type RunEvent = { seq: number; run_id: string; task_id: string; kind: string; text: string; created_at: number };
export type Teammate = { id: string; role: string; behavior: string; model: string; capabilities: string; harness: string; escalation_harness: string; escalation_model: string };
export type Harness = { id: string; label: string; available: boolean; version: string };
export type DirectoryListing = { path: string; workspace: { path: string; name: string }; parent: string | null; locations: { name: string; path: string }[]; directories: { name: string; path: string; is_repository: boolean }[]; truncated: boolean; repository: { path: string; name: string; branch: string } | null; repository_error: string };
export type Changes = { branch: string; status: string; diff: string; truncated?: boolean; untracked: string[]; commits: string };
type Snapshot = { projects: Project[]; tasks: Task[]; teammates: Teammate[]; harness_available: boolean; harnesses: Record<string, Harness>; activity?: TaskActivity[]; recent_activity?: RecentActivity[] };
type Detail = { task: Task; messages: Message[]; runs: Run[] };
const activeStates = ['planning', 'running', 'verifying', 'integrating'];
export const isActive = (task?: Task) => Boolean(task && activeStates.includes(task.state));

export function createService(initialTask: string, onSelect: (id: string) => void, notify: (message: string) => void) {
	let savedProject = '';
	try { savedProject = localStorage.getItem('mestero-project') || ''; } catch { /* Default selection. */ }
	const state = $state({ projects: [] as Project[], tasks: [] as Task[], activity: [] as TaskActivity[], recentActivity: [] as RecentActivity[], teammates: [] as Teammate[], harnesses: {} as Record<string, Harness>, projectId: savedProject, taskId: initialTask, messages: [] as Message[], runs: [] as Run[], events: [] as RunEvent[], changes: null as Changes | null, loading: true, detailLoading: false, connected: false, harnessAvailable: false, pending: false, error: '', dialog: '' as '' | 'project', filePreview: null as { path: string; content: string } | null });
	let setupPreview = $state<GitSetupPreview | null>(null);
	const drafts = $state(readChatDrafts());
	const attachments = $state<Record<string, File[]>>({});
	const uploaded = new WeakMap<File, Attachment>();
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false, refreshing = false, selection = 0, revision = 0;
	let refreshWait: Promise<void> | undefined;
	const controller = new AbortController();
	// A new task has no id yet, so its draft is scoped to the project instead.
	const composerKey = () => state.taskId ? `task:${state.taskId}` : `new:${state.projectId}`;
	function flushDrafts() { clearTimeout(draftTimer); writeChatDrafts(drafts); }
	async function request<T>(path: string, method = 'GET', body?: unknown, headers?: HeadersInit, signal?: AbortSignal): Promise<T> {
		const response = await fetch(`/api${path}`, { method, headers: { ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body instanceof File ? body : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000), ...(signal ? [signal] : [])]) });
		const content = response.headers.get('content-type') || '';
		if (!content.includes('application/json')) { if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`); throw new Error('The Rust service is unavailable. Start it with cargo run -p mestero-service.'); }
		const data = await response.json();
		if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status})`);
		return data;
	}
	function fail(error: unknown) { if (!stopped) state.error = error instanceof Error ? error.message : 'The request failed.'; }
	function rememberProject() { try { localStorage.setItem('mestero-project', state.projectId); } catch { /* Selection remains usable. */ } }
	async function loadTask() {
		const taskId = state.taskId, token = selection;
		if (!taskId) { state.messages = []; state.runs = []; state.events = []; return; }
		const after = state.events.at(-1)?.seq || 0;
		const [detail, events] = await Promise.all([request<Detail>(`/tasks/${taskId}`), request<RunEvent[]>(`/tasks/${taskId}/events?${after ? `after=${after}` : 'tail=true'}`)]);
		if (token !== selection || taskId !== state.taskId || stopped) return;
		state.messages = detail.messages; state.runs = detail.runs;
		state.tasks = state.tasks.map(task => task.id === taskId ? detail.task : task);
		state.events = [...new Map([...state.events, ...events].map(event => [event.seq, event])).values()].sort((a, b) => a.seq - b.seq).slice(-1500);
	}
	async function fetchWorkspace() {
		if (refreshing || stopped) return;
		refreshing = true;
		const requestRevision = revision;
		try {
			const data = await request<Snapshot>('/workspace');
			if (stopped || requestRevision !== revision) return;
			state.projects = data.projects; state.tasks = data.tasks; state.activity = data.activity || []; state.recentActivity = data.recent_activity || []; state.teammates = data.teammates; state.harnesses = data.harnesses || {}; state.harnessAvailable = data.harness_available;
			if (!state.projects.some(project => project.id === state.projectId)) state.projectId = state.projects[0]?.id || '';
			if (!state.tasks.some(task => task.id === state.taskId && task.project_id === state.projectId)) selectTask(state.tasks.find(task => task.project_id === state.projectId)?.id || '', false);
			if (!state.connected) state.error = '';
			state.connected = true;
			await loadTask();
		} catch (error) { state.connected = false; fail(error); }
		finally { state.loading = false; refreshing = false; }
	}
	function refresh(): Promise<void> {
		if (!refreshWait) refreshWait = fetchWorkspace().finally(() => { refreshWait = undefined; });
		return refreshWait;
	}
	function selectTask(id: string, load = true) {
		selection++; state.taskId = id; onSelect(id);
		state.messages = []; state.runs = []; state.events = []; state.changes = null; state.filePreview = null; state.error = '';
		if (load && id) { state.detailLoading = true; loadTask().catch(fail).finally(() => state.detailLoading = false); }
	}
	async function mutate(action: () => Promise<void>) {
		if (state.pending) return;
		state.pending = true; state.error = ''; revision++;
		try { await action(); if (refreshWait) await refreshWait; await refresh(); }
		catch (error) { fail(error); }
		finally { state.pending = false; }
	}
	function connectedProject(project: Project) {
		state.projects = [project, ...state.projects.filter(item => item.id !== project.id)];
		state.projectId = project.id; rememberProject();
		selectTask(state.tasks.find(task => task.project_id === project.id)?.id || '', false);
		setupPreview = null; state.dialog = '';
		notify('Workspace connected. Create your first task.');
	}
	const service = {
		state,
		get setupPreview() { return setupPreview; },
		clearSetupPreview() { setupPreview = null; state.error = ''; },
		get project() { return state.projects.find(project => project.id === state.projectId); },
		get task() { return state.tasks.find(task => task.id === state.taskId); },
		get tasks() { return state.tasks.filter(task => task.project_id === state.projectId); },
		get allTasks() { return state.tasks; },
		get activeTask() { return state.tasks.find(isActive); },
		get activeActivity() { const task = this.activeTask; return task ? this.activityFor(task.id) : undefined; },
		activityFor(taskId: string) { return state.activity.find(activity => activity.task_id === taskId); },
		get busy() { return state.pending || state.tasks.some(isActive); },
		canRun(name: string) { const member = state.teammates.find(member => member.id === name); return Boolean(member && state.harnesses[member.harness || 'codex']?.available); },
		get text() { return drafts[composerKey()] || ''; },
		set text(value: string) { drafts[composerKey()] = value; clearTimeout(draftTimer); draftTimer = setTimeout(flushDrafts, 200); },
		get files() { return attachments[composerKey()] || []; },
		set files(value: File[]) { attachments[composerKey()] = value; },
		get messages() { return state.messages; },
		selectTask,
		selectProject(id: string, taskId?: string) {
			state.projectId = id; rememberProject();
			const next = taskId === undefined ? state.tasks.find(task => task.project_id === id)?.id || '' : taskId;
			selectTask(next);
		},
		refresh,
		browseDirectories(path?: string, showHidden = false, signal?: AbortSignal) {
			const query = new URLSearchParams({ show_hidden: String(showHidden) });
			if (path) query.set('path', path);
			return request<DirectoryListing>(`/directories?${query}`, 'GET', undefined, undefined, signal);
		},
		async createProject(name: string, path: string) {
			await mutate(async () => {
				const result = await request<WorkspacePreparation>('/projects/prepare', 'POST', { name, path });
				if (result.project) connectedProject(result.project);
				else if (result.setup && state.dialog === 'project') setupPreview = result.setup;
			});
		},
		async confirmGitSetup() {
			if (!setupPreview) return;
			const previewId = setupPreview.id;
			await mutate(async () => {
				const result = await request<{ project: Project }>('/projects/setup', 'POST', { preview_id: previewId, confirmed: true });
				connectedProject(result.project);
			});
		},
		startNewTask() { if (state.projectId) selectTask(''); },
		async submit() {
			const existingId = state.taskId, projectId = state.projectId;
			const text = service.text.trim(), files = [...service.files], key = composerKey();
			if ((!text && !files.length) || service.busy) return;
			if (files.length > 10) { state.error = 'Attach at most 10 files per message.'; return; }
			await mutate(async () => {
				let id = existingId;
				if (!id) {
					const task = await request<Task>('/tasks', 'POST', { project_id: projectId, title: deriveTaskTitle(text, files.length), goal: deriveTaskGoal(text, files.length) });
					state.tasks = [task, ...state.tasks];
					selectTask(task.id, false);
					id = task.id;
				}
				try {
					const attached: string[] = [];
					for (const file of files) {
						if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB attachment limit.`);
						let stored = uploaded.get(file);
						if (!stored || stored.task_id !== id) { stored = await request<Attachment>(`/tasks/${id}/attachments`, 'POST', file, { 'Content-Type': 'application/octet-stream', 'x-file-name': file.name.replace(/[^\x20-\x7E]/g, '_') }); uploaded.set(file, stored); }
						attached.push(stored.id);
					}
					await request(`/tasks/${id}/messages`, 'POST', { text: deriveTaskMessage(text, files.length), attachments: attached });
				} catch (error) {
					// Keep the typed brief in the new task when sending fails after it was created.
					if (!existingId) { drafts[`task:${id}`] = text; attachments[id] = files; flushDrafts(); }
					throw error;
				}
				drafts[`task:${id}`] = ''; attachments[id] = [];
				if (key !== `task:${id}`) { delete drafts[key]; delete attachments[key]; }
				flushDrafts();
				if (!existingId) notify('Task created. Maestro is preparing a plan.');
			});
		},
		async action(action: 'approve' | 'cancel' | 'verify' | 'accept') {
			if (!state.taskId) return;
			await mutate(async () => { await request(`/tasks/${state.taskId}/${action}`, 'POST', {}); notify(({ approve: 'Plan approved. Work is starting in an isolated worktree.', cancel: 'Cancellation requested.', verify: 'Independent verification requested.', accept: 'Result integrated into the base branch.' })[action]); });
		},
		async assignTask(id: string, assignee: string) {
			await mutate(async () => {
				const task = await request<Task>(`/tasks/${id}/assignee`, 'PUT', { assignee });
				state.tasks = state.tasks.map(item => item.id === id ? task : item);
				notify(assignee ? `${task.title} assigned to ${assignee}.` : `${task.title} assignment cleared.`);
			});
		},
		async loadChanges() {
			const id = state.taskId;
			if (!id) return;
			try { const changes = await request<Changes>(`/tasks/${id}/changes`); if (id === state.taskId) state.changes = changes; } catch (error) { fail(error); }
		},
		async previewFile(path: string) { try { const id = state.taskId; const file = await request<{ path: string; content: string }>(`/tasks/${id}/file?path=${encodeURIComponent(path)}`); if (id === state.taskId) state.filePreview = file; } catch (error) { fail(error); } },
		async saveTeammate(template: Teammate) { await mutate(async () => { await request(`/teammates/${template.id}`, 'PUT', template); notify(`${template.id} saved for future runs.`); }); },
		start() {
			stopped = false;
			const poll = async () => { if (!document.hidden) await refresh(); if (!stopped) timer = setTimeout(poll, state.tasks.some(isActive) ? 2000 : 8000); };
			void poll();
			const visible = () => { if (!document.hidden) void refresh(); };
			document.addEventListener('visibilitychange', visible);
			return () => { stopped = true; controller.abort(); clearTimeout(timer); flushDrafts(); document.removeEventListener('visibilitychange', visible); };
		},
		flushDrafts
	};
	return service;
}
