export type PanelMode = 'expanded' | 'compact' | 'mini';
export type PanelFit = { width: number; floor: number };
export type FitInput = {
	available: number;
	editorMin: number;
	left: PanelFit;
	right: PanelFit;
	active?: 'left' | 'right';
	requested?: number;
};
export type WorkspaceFit = { left: number; right: number; editor: number };

export const EDITOR_MIN = 480;
export const MAX_PANEL_WIDTH = 4000;

export function panelFloor(mode: PanelMode, min: number, compact = 0): number {
	return mode === 'mini' ? 0 : mode === 'compact' ? compact : min;
}

/** Responsive editor minimum: never below the room left by both panel floors. */
export function editorMinimum(available: number, leftFloor: number, rightFloor: number): number {
	return Math.max(0, Math.min(EDITOR_MIN, available - leftFloor - rightFloor));
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * Reconcile the three panes. The active pane follows the pointer; the other pane
 * yields down to its floor so the editor keeps its minimum. Without an active pane,
 * the inspector yields first, then the task sidebar.
 */
export function fitWorkspace({ available, editorMin, left, right, active, requested }: FitInput): WorkspaceFit {
	let leftWidth = active === 'left' && requested !== undefined ? Math.max(0, requested) : left.width;
	let rightWidth = active === 'right' && requested !== undefined ? Math.max(0, requested) : right.width;
	const leftCeiling = Math.max(left.floor, available - editorMin - right.floor);
	const rightCeiling = Math.max(right.floor, available - editorMin - left.floor);
	if (active === 'left') leftWidth = Math.min(leftWidth, leftCeiling);
	else if (active === 'right') rightWidth = Math.min(rightWidth, rightCeiling);
	const overflow = () => editorMin - (available - leftWidth - rightWidth);
	if (overflow() > 0) {
		if (active === 'left') rightWidth = Math.max(right.floor, rightWidth - overflow());
		else if (active === 'right') leftWidth = Math.max(left.floor, leftWidth - overflow());
		else {
			rightWidth = Math.max(right.floor, rightWidth - overflow());
			if (overflow() > 0) leftWidth = Math.max(left.floor, leftWidth - overflow());
		}
	}
	if (overflow() > 0 && active === 'left') leftWidth = Math.max(left.floor, available - editorMin - rightWidth);
	if (overflow() > 0 && active === 'right') rightWidth = Math.max(right.floor, available - editorMin - leftWidth);
	return { left: leftWidth, right: rightWidth, editor: Math.max(0, available - leftWidth - rightWidth) };
}
