import { members, tasks, threads, type BoardLayout, type MemberName, type PreviewTab, type SidebarMode, type View } from './workspace-data.js';
import { MAX_PANEL_WIDTH } from './layout.js';

// Persist layout and navigation only. Task execution and teammate configuration belong to the service.
export const WORKSPACE_PREFERENCES_KEY = 'mestero-workspace';

export type SidebarLayout = { mode: SidebarMode; width: number; expandedWidth: number };
export type WorkspacePreferences = {
	version: 1;
	sidebar: { mode: SidebarMode; expandedWidth: number };
	inspector: { width: number; mode: SidebarMode; open: boolean; panel: 'preview' | 'changes'; tab: PreviewTab; title: string };
	terminalOpen: boolean;
	view: View;
	boardLayout: BoardLayout;
	listMode: 'tasks' | 'threads';
	selectedTask: string;
	selectedThread: string;
	selectedCard: string;
	selectedMember: MemberName;
};

export function defaultWorkspacePreferences(): WorkspacePreferences {
	return {
		version: 1,
		sidebar: { mode: 'expanded', expandedWidth: 304 },
		inspector: { width: 304, mode: 'mini', open: false, panel: 'preview', tab: 'brief', title: 'Preview' },
		terminalOpen: false,
		view: 'overview',
		boardLayout: 'horizontal',
		listMode: 'tasks',
		selectedTask: 'Storefront brief',
		selectedThread: 'Storefront planning',
		selectedCard: 'Build catalog and product pages',
		selectedMember: 'Maestro'
	};
}

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function choice<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
	return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

function selection(value: unknown, values: readonly string[], fallback: string): string {
	return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : choice(value, values, fallback);
}

function dimension(value: unknown, minimum: number, maximum: number, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(minimum, Math.min(maximum, value))) : fallback;
}

const taskTitles = tasks.map(task => task.title);
const memberNames = members.map(member => member.name);
const previewTitles = ['Preview', 'Plan preview', 'Activity', 'Task preview', 'Teammate preview', 'Changes · 3', ...taskTitles, ...memberNames.map(name => `${name} preview`)];

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences {
	const fallback = defaultWorkspacePreferences();
	const root = record(value);
	if (root.version !== 1) return fallback;
	const sidebar = record(root.sidebar);
	const inspector = record(root.inspector);
	const inspectorOpen = typeof inspector.open === 'boolean' ? inspector.open : fallback.inspector.open;
	const inspectorMode = choice(inspector.mode, ['expanded', 'compact', 'mini'], inspectorOpen ? 'expanded' : 'mini');
	return {
		version: 1,
		sidebar: {
			mode: choice(sidebar.mode, ['expanded', 'compact', 'mini'], fallback.sidebar.mode),
			expandedWidth: dimension(sidebar.expandedWidth, 200, MAX_PANEL_WIDTH, fallback.sidebar.expandedWidth)
		},
		inspector: {
			width: dimension(inspector.width, 240, MAX_PANEL_WIDTH, fallback.inspector.width),
			mode: inspectorMode,
			open: inspectorMode !== 'mini',
			panel: choice(inspector.panel, ['preview', 'changes'], fallback.inspector.panel),
			tab: choice(inspector.tab, ['brief', 'activity', 'tasks', 'team'], fallback.inspector.tab),
			title: choice(inspector.title, previewTitles, fallback.inspector.title)
		},
		terminalOpen: typeof root.terminalOpen === 'boolean' ? root.terminalOpen : fallback.terminalOpen,
		view: choice(root.view, ['overview', 'editor', 'board', 'team'], fallback.view),
		boardLayout: choice(root.boardLayout, ['horizontal', 'vertical'], fallback.boardLayout),
		listMode: choice(root.listMode, ['tasks', 'threads'], fallback.listMode),
		selectedTask: selection(root.selectedTask, taskTitles, fallback.selectedTask),
		selectedThread: selection(root.selectedThread, threads, fallback.selectedThread),
		selectedCard: selection(root.selectedCard, taskTitles, fallback.selectedCard),
		selectedMember: choice(root.selectedMember, memberNames, fallback.selectedMember)
	};
}

function browserStorage(): Storage | undefined {
	try { return typeof window === 'undefined' ? undefined : window.localStorage; }
	catch { return undefined; }
}

export function readWorkspacePreferences(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): WorkspacePreferences {
	try {
		const raw = storage?.getItem(WORKSPACE_PREFERENCES_KEY);
		return raw ? normalizeWorkspacePreferences(JSON.parse(raw)) : defaultWorkspacePreferences();
	} catch { return defaultWorkspacePreferences(); }
}

export function writeWorkspacePreferences(preferences: WorkspacePreferences, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): boolean {
	if (!storage) return false;
	try { storage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(preferences)); return true; }
	catch { return false; }
}
