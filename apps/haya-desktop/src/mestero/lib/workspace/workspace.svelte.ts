import type { MemberName, PreviewTab, SidebarMode, View } from './workspace-data.js';
import { readWorkspacePreferences, writeWorkspacePreferences, type SidebarLayout, type WorkspacePreferences } from './preferences.js';
import { createService } from './service.svelte.js';
import { EDITOR_MIN, MAX_PANEL_WIDTH, editorMinimum, fitWorkspace, panelFloor } from './layout.js';
export type { MemberName, PreviewTab, SidebarMode, View } from './workspace-data.js';

const SIDEBAR_MIN = 200;
const SIDEBAR_COMPACT = 56;
const INSPECTOR_MIN = 240;
const INSPECTOR_COMPACT = 56;
const PANEL_CHROME = 16;

export function createWorkspace() {
	const initial = readWorkspacePreferences();
	const savedSidebar = $state({ ...initial.sidebar });
	let savedInspectorWidth = $state(initial.inspector.width);
	let viewport = $state(0);
	const ui = $state({
		mode: initial.view,
		boardLayout: initial.boardLayout,
		listMode: initial.listMode,
		selectedTask: initial.selectedTask,
		selectedThread: initial.selectedThread,
		selectedCard: initial.selectedCard,
		selectedMember: initial.selectedMember,
		acceptOpen: false,
		helpOpen: false,
		commandOpen: false,
		terminalOpen: initial.terminalOpen,
		inspectorOpen: initial.inspector.mode !== 'mini',
		inspectorMode: initial.inspector.mode,
		inspectorPanel: initial.inspector.panel,
		previewTab: initial.inspector.tab,
		previewTitle: initial.inspector.title,
		sidebarWidth: initial.sidebar.mode === 'mini' ? 0 : initial.sidebar.mode === 'compact' ? 56 : initial.sidebar.expandedWidth,
		sidebarMode: initial.sidebar.mode,
		sidebarExpandedWidth: initial.sidebar.expandedWidth,
		inspectorWidth: initial.inspector.mode === 'mini' ? 0 : initial.inspector.mode === 'compact' ? INSPECTOR_COMPACT : initial.inspector.width,
		inspectorExpandedWidth: initial.inspector.width,
		editorMinWidth: EDITOR_MIN,
		sidebarToggle: 0,
		theme: 'light' as 'light' | 'dark',
		account: 'Wahyu Dianto',
		notice: { id: 0, message: '' },
		teamDraft: {
			role: 'Project manager and planning lead',
			behavior: "Clarify the user's goal. Draft a product brief and task plan with acceptance criteria, dependencies, and expected outputs. Recommend teammates based on their skills and availability. Explain the plan before work begins.",
			strategy: 'Use workspace default',
			model: '',
			harness: 'codex',
			escalation_harness: '',
			escalation_model: '',
			capabilities: 'planning, requirements, delegation, progress updates'
		}
	});
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastSaved = '';
	const chat = createService(ui.selectedTask, id => { ui.selectedTask = id; ui.selectedThread = id; }, message => { ui.notice = { id: ui.notice.id + 1, message }; });

	function snapshot(): WorkspacePreferences {
		return {
			version: 1,
			sidebar: { mode: savedSidebar.mode, expandedWidth: savedSidebar.expandedWidth },
			inspector: {
				width: savedInspectorWidth,
				mode: ui.inspectorMode,
				open: ui.inspectorOpen,
				panel: ui.inspectorPanel,
				tab: ui.previewTab,
				title: ui.previewTitle
			},
			terminalOpen: ui.terminalOpen,
			view: ui.mode,
			boardLayout: ui.boardLayout,
			listMode: ui.listMode,
			selectedTask: ui.selectedTask,
			selectedThread: ui.selectedThread,
			selectedCard: ui.selectedCard,
			selectedMember: ui.selectedMember
		};
	}

	function flushPreferences() {
		chat.flushDrafts();
		clearTimeout(saveTimer);
		const preferences = snapshot();
		const serialized = JSON.stringify(preferences);
		if (serialized !== lastSaved && writeWorkspacePreferences(preferences)) lastSaved = serialized;
	}

	function floors() {
		return {
			left: panelFloor(ui.sidebarMode, SIDEBAR_MIN, SIDEBAR_COMPACT),
			right: panelFloor(ui.inspectorMode, INSPECTOR_MIN, INSPECTOR_COMPACT)
		};
	}

	function room() {
		return Math.max(0, viewport - PANEL_CHROME);
	}

	function fitPanels(active?: 'left' | 'right', requested?: number) {
		if (viewport <= 760) { ui.editorMinWidth = 0; return; }
		const space = room();
		let { left: leftFloor, right: rightFloor } = floors();
		let leftWidth = ui.sidebarWidth, rightWidth = ui.inspectorWidth;
		if (active === 'left' && requested !== undefined) {
			const ceiling = space - editorMinimum(space, leftFloor, rightFloor) - rightFloor;
			if (requested > ceiling && rightFloor > 0) {
				rightFloor = 0;
				rightWidth = 0;
				ui.inspectorWidth = 0;
				ui.inspectorMode = 'mini';
				ui.inspectorOpen = false;
			}
		} else if (active === 'right' && requested !== undefined) {
			while (leftFloor > 0 && requested > space - editorMinimum(space, leftFloor, rightFloor) - leftFloor) {
				if (leftFloor > SIDEBAR_COMPACT) {
					leftFloor = SIDEBAR_COMPACT;
					leftWidth = SIDEBAR_COMPACT;
					ui.sidebarWidth = SIDEBAR_COMPACT;
					ui.sidebarMode = 'compact';
				} else {
					leftFloor = 0;
					leftWidth = 0;
					ui.sidebarWidth = 0;
					ui.sidebarMode = 'mini';
				}
			}
		}
		const editorMin = editorMinimum(space, leftFloor, rightFloor);
		ui.editorMinWidth = editorMin;
		const fit = fitWorkspace({ available: space, editorMin, left: { width: leftWidth, floor: leftFloor }, right: { width: rightWidth, floor: rightFloor }, active, requested });
		ui.sidebarWidth = fit.left;
		ui.inspectorWidth = fit.right;
	}

	function panelMaximum(side: 'left' | 'right') {
		if (!viewport || viewport <= 760) return side === 'left' ? 420 : 520;
		const { left, right } = floors();
		return Math.max(side === 'left' ? left : right, room() - editorMinimum(room(), 0, 0));
	}

	function setViewport(width: number) {
		viewport = Math.max(0, width);
		fitPanels();
	}

	function resizePanel(side: 'left' | 'right', width: number) {
		fitPanels(side, width);
	}

	return {
		state: ui,
		chat,
		service: chat,
		commitSidebarLayout(layout: SidebarLayout) {
			savedSidebar.mode = layout.mode;
			savedSidebar.expandedWidth = Math.round(Math.max(SIDEBAR_MIN, Math.min(MAX_PANEL_WIDTH, layout.expandedWidth)));
		},
		commitInspectorLayout(layout: SidebarLayout) {
			savedInspectorWidth = Math.round(Math.max(INSPECTOR_MIN, Math.min(MAX_PANEL_WIDTH, layout.expandedWidth)));
			ui.inspectorOpen = layout.mode !== 'mini';
		},
		schedulePreferencesSave() {
			// These synchronous reads track committed layout, not live drag/spring frames.
			const preferences = snapshot();
			const serialized = JSON.stringify(preferences);
			clearTimeout(saveTimer);
			if (serialized === lastSaved) return;
			saveTimer = setTimeout(() => {
				if (writeWorkspacePreferences(preferences)) lastSaved = serialized;
			}, 150);
		},
		flushPreferences,
		panelMaximum,
		setViewport,
		resizePanel,
		notify(message: string) { ui.notice = { id: ui.notice.id + 1, message }; },
		setMode(mode: View) {
			ui.mode = mode;
			if (matchMedia('(max-width: 760px)').matches && ui.sidebarMode !== 'mini') ui.sidebarToggle++;
			if (ui.inspectorOpen && ui.inspectorPanel === 'preview') this.openPreview(mode === 'team' ? 'team' : mode === 'board' ? 'tasks' : mode === 'overview' ? 'activity' : 'brief');
		},
		setList(mode: 'tasks' | 'threads') {
			ui.listMode = mode;
			this.setMode('editor');
		},
		newTask() {
			if (!chat.project) return;
			chat.startNewTask();
			this.setMode('editor');
		},
		openPreview(tab: PreviewTab = 'brief', title = '') {
			ui.inspectorOpen = true;
			ui.inspectorPanel = 'preview';
			ui.previewTab = tab;
			ui.previewTitle = title || { brief: 'Plan preview', activity: 'Activity', tasks: 'Task preview', team: 'Teammate preview' }[tab];
		},
		expandInspector() {
			ui.inspectorOpen = true;
			ui.inspectorMode = 'expanded';
			ui.inspectorWidth = ui.inspectorExpandedWidth;
			fitPanels('right', ui.inspectorWidth);
		},
		compactInspector() {
			ui.inspectorOpen = true;
			ui.inspectorMode = 'compact';
			ui.inspectorWidth = INSPECTOR_COMPACT;
			fitPanels('right', INSPECTOR_COMPACT);
		},
		revealPreview(tab: PreviewTab = 'brief', title = '') {
			const expand = ui.inspectorMode === 'compact';
			this.openPreview(tab, title);
			if (expand) this.expandInspector();
		},
		closeInspector() {
			ui.inspectorOpen = false;
		},
		toggleInspector() {
			if (ui.inspectorOpen) this.closeInspector();
			else this.openPreview(ui.mode === 'team' ? 'team' : ui.mode === 'board' ? 'tasks' : ui.mode === 'overview' ? 'activity' : 'brief');
		},
		toggleChanges() {
			if (ui.inspectorOpen && ui.inspectorPanel === 'changes') this.closeInspector();
			else {
				ui.inspectorOpen = true;
				ui.inspectorPanel = 'changes';
				ui.previewTitle = 'Git changes';
				if (ui.inspectorMode !== 'expanded') this.expandInspector();
				void chat.loadChanges();
			}
		},
		proceed() {
			void chat.action('approve');
		},
		selectMember(name: MemberName) {
			ui.selectedMember = name;
			ui.previewTitle = `${name} preview`;
			const template = chat.state.teammates.find(member => member.id === name);
			if (template) ui.teamDraft = { ...template, strategy: 'Use workspace default' };
		},
		setTheme(theme: 'light' | 'dark', announce = true) {
			ui.theme = theme;
			document.documentElement.dataset.theme = theme;
			try { localStorage.setItem('mestero-theme', theme); } catch { /* Preference remains usable when storage is unavailable. */ }
			if (announce) this.notify(`Theme changed to ${theme}.`);
		},
		destroy() { flushPreferences(); }
	};
}

export type Workspace = ReturnType<typeof createWorkspace>;
