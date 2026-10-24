import type { SidebarMode } from './workspace-data.js';
import type { SidebarLayout } from './preferences.js';

export type SidebarPolicy = { minWidth: number; maxWidth: number; compactWidth: number };
export type PointerSample = { x: number; time: number };

export function sidebarModeForWidth(width: number, previous: SidebarMode, policy: SidebarPolicy): SidebarMode {
	if (!policy.compactWidth) {
		return previous === 'mini'
			? width > policy.minWidth * 2 / 3 ? 'expanded' : 'mini'
			: width < policy.minWidth / 2 ? 'mini' : 'expanded';
	}
	if (previous === 'mini') return width > 160 ? 'expanded' : width > policy.compactWidth ? 'compact' : 'mini';
	if (previous === 'compact') return width < 36 ? 'mini' : width > 160 ? 'expanded' : 'compact';
	return width < 36 ? 'mini' : width < 140 ? 'compact' : 'expanded';
}

export function resistedSidebarWidth(width: number, maxWidth: number): number {
	return width <= maxWidth ? Math.max(0, width) : maxWidth + Math.min(24, (width - maxWidth) * .25);
}

export function sidebarRelease(width: number, previous: SidebarMode, velocity: number, expandedWidth: number, policy: SidebarPolicy): SidebarLayout {
	const remembered = Math.max(policy.minWidth, Math.min(policy.maxWidth, expandedWidth));
	const closeThreshold = policy.compactWidth ? 36 : policy.minWidth / 2;
	// Reaching the closed edge wins over a noisy or reversing release velocity.
	if (width <= closeThreshold) return { mode: 'mini', width: 0, expandedWidth: remembered };
	const projected = Math.max(0, Math.min(policy.maxWidth, width + velocity * .2));
	let mode = sidebarModeForWidth(projected, previous, policy);
	if (Math.abs(velocity) > 600 && mode === previous) {
		if (velocity < 0) mode = previous === 'expanded' && policy.compactWidth ? 'compact' : 'mini';
		else mode = previous === 'mini' && policy.compactWidth ? 'compact' : 'expanded';
	}
	const nextExpandedWidth = mode === 'expanded' ? Math.max(policy.minWidth, Math.min(policy.maxWidth, projected)) : remembered;
	return { mode, width: mode === 'mini' ? 0 : mode === 'compact' ? policy.compactWidth : nextExpandedWidth, expandedWidth: nextExpandedWidth };
}

export function sidebarVelocity(samples: PointerSample[], releaseTime: number, direction: number): number {
	const last = samples.at(-1);
	if (!last || releaseTime - last.time > 50) return 0;
	const points = samples.filter(sample => last.time - sample.time <= 80);
	if (points.length < 2) return 0;
	const meanTime = points.reduce((sum, point) => sum + point.time, 0) / points.length;
	const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
	const denominator = points.reduce((sum, point) => sum + (point.time - meanTime) ** 2, 0);
	const numerator = points.reduce((sum, point) => sum + (point.time - meanTime) * (point.x - meanX), 0);
	return denominator ? Math.max(-4000, Math.min(4000, numerator / denominator * 1000 * direction)) : 0;
}
