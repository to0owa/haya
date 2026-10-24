<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import type { SidebarMode } from './workspace/workspace.svelte.js';
	import type { SidebarLayout } from './workspace/preferences.js';
	import { resistedSidebarWidth, sidebarModeForWidth, sidebarRelease, sidebarVelocity, type PointerSample } from './workspace/sidebar-motion.js';

	let { side, width = $bindable(304), expandedWidth = $bindable(304), mode = $bindable<SidebarMode>('expanded'), minWidth = 200, maxWidth = 420, compactWidth = 0, toggleRequest = 0, open = $bindable(true), panel = 'preview', onLayoutChange, onResize, children }: {
		side: 'left' | 'right'; width?: number; mode?: SidebarMode; minWidth?: number; maxWidth?: number;
		expandedWidth?: number; onLayoutChange?: (layout: SidebarLayout) => void; onResize?: (width: number) => void;
		compactWidth?: number; toggleRequest?: number; open?: boolean; panel?: string; children: Snippet;
	} = $props();
	let spring = 0;
	let velocity = 0;
	let frame = 0;
	let drag: { x: number; width: number; mode: SidebarMode; moved: boolean; samples: PointerSample[] } | null = null;
	let dragging = $state(false);
	let lastToggle = untrack(() => toggleRequest);
	let lastOpen = untrack(() => open);
	const direction = $derived(side === 'left' ? 1 : -1);
	const policy = $derived({ minWidth, maxWidth, compactWidth });

	function setWidth(value: number) {
		width = Math.max(0, Math.min(maxWidth + 24, value));
		mode = sidebarModeForWidth(width, mode, policy);
		onResize?.(width);
	}
	function cancelSpring() { cancelAnimationFrame(spring); spring = 0; }
	function settle(next: SidebarMode, target: number, speed = velocity) {
		cancelSpring();
		lastOpen = next !== 'mini';
		open = lastOpen;
		onLayoutChange?.({ mode: next, width: target, expandedWidth });
		const finish = () => { setWidth(target); mode = next; };
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); velocity = 0; return; }
		let position = width;
		velocity = Math.max(-4000, Math.min(4000, speed));
		const remaining = target - position;
		if ((target === maxWidth && position >= maxWidth && velocity > 0) || (target === 0 && position <= 0 && velocity < 0)) velocity = 0;
		if (remaining * velocity > 0) velocity = Math.sign(remaining) * Math.min(Math.abs(velocity), 20 * Math.abs(remaining));
		let previous = performance.now(), accumulator = 0;
		const tick = (now: number) => {
			accumulator += Math.min(.032, Math.max(0, (now - previous) / 1000)); previous = now;
			while (accumulator >= 1 / 240) {
				velocity += (-400 * (position - target) - 40 * velocity) / 240;
				position += velocity / 240; accumulator -= 1 / 240;
			}
			if (Math.abs(position - target) < .25 && Math.abs(velocity) < 2) { finish(); velocity = 0; spring = 0; return; }
			setWidth(position); spring = requestAnimationFrame(tick);
		};
		spring = requestAnimationFrame(tick);
	}
	function choose(next: SidebarMode, target = expandedWidth) {
		if (mode === 'expanded' && next !== 'expanded' && !spring) expandedWidth = Math.max(minWidth, Math.min(maxWidth, width));
		if (next === 'expanded') expandedWidth = Math.max(minWidth, Math.min(maxWidth, target));
		settle(next, next === 'mini' ? 0 : next === 'compact' ? compactWidth : expandedWidth);
	}
	$effect(() => {
		if (toggleRequest !== lastToggle) {
			lastToggle = toggleRequest;
			untrack(() => choose(mode === 'mini' ? 'expanded' : 'mini'));
		}
	});
	$effect(() => {
		if (open !== lastOpen) {
			lastOpen = open;
			untrack(() => choose(open ? 'expanded' : 'mini'));
		}
	});
	function begin(event: PointerEvent) {
		if (drag || event.button !== 0 || matchMedia('(max-width: 760px)').matches) return;
		event.preventDefault(); cancelSpring();
		(event.currentTarget as HTMLElement).focus({ preventScroll: true });
		drag = { x: event.clientX, width, mode, moved: false, samples: [{ x: event.clientX, time: event.timeStamp }] };
		dragging = true; document.body.classList.add('sidebar-resizing');
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	function updateDrag(event: PointerEvent) {
		if (!drag) return;
		drag.moved ||= Math.abs(event.clientX - drag.x) >= 3;
		drag.samples.push({ x: event.clientX, time: event.timeStamp });
		while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].time > 80) drag.samples.shift();
		const value = resistedSidebarWidth(drag.width + (event.clientX - drag.x) * direction, maxWidth);
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => setWidth(value));
	}
	function stop(event: PointerEvent) {
		if (!drag) return;
		cancelAnimationFrame(frame);
		const release = drag;
		if (event.type === 'pointerup') {
			setWidth(resistedSidebarWidth(release.width + (event.clientX - release.x) * direction, maxWidth));
			release.samples.push({ x: event.clientX, time: event.timeStamp });
		}
		velocity = event.type === 'pointerup' ? sidebarVelocity(release.samples, event.timeStamp, direction) : 0;
		drag = null; dragging = false; document.body.classList.remove('sidebar-resizing');
		if (!release.moved) { choose(release.mode); return; }
		const layout = sidebarRelease(width, mode, velocity, expandedWidth, policy);
		expandedWidth = layout.expandedWidth;
		settle(layout.mode, layout.width);
	}
	function keyboard(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
		event.preventDefault();
		if (event.key === 'Home') { choose('mini'); return; }
		if (event.key === 'End') { choose('expanded', maxWidth); return; }
		if (event.key === 'Enter') { choose(mode === 'mini' ? 'expanded' : 'mini'); return; }
		const growing = (event.key === 'ArrowRight' ? 1 : -1) * direction > 0;
		if (growing) {
			if (mode === 'mini') choose(compactWidth ? 'compact' : 'expanded');
			else choose('expanded', mode === 'compact' ? expandedWidth : Math.min(maxWidth, width + 24));
		} else {
			if (mode === 'expanded' && width > minWidth) choose('expanded', Math.max(minWidth, width - 24));
			else choose(mode === 'expanded' && compactWidth ? 'compact' : 'mini');
		}
	}
	onDestroy(() => { cancelAnimationFrame(frame); cancelAnimationFrame(spring); if (dragging) document.body.classList.remove('sidebar-resizing'); });
</script>

{#snippet grabber()}
	<div id={side === 'left' ? 'sidebar-resizer' : 'inspector-resizer'} class={side === 'left' ? 'sidebar-resizer' : 'inspector-resizer'} class:is-resizing={dragging} role="slider" tabindex="0" aria-orientation="horizontal" aria-label={side === 'left' ? 'Resize task sidebar' : 'Resize preview sidebar'} aria-valuemin="0" aria-valuemax={maxWidth} aria-valuenow={Math.round(Math.min(maxWidth, width))} aria-valuetext={`${mode}, ${Math.round(width)} pixels`} title="Drag to resize · Arrow keys to adjust" onpointerdown={begin} onpointermove={updateDrag} onpointerup={stop} onpointercancel={stop} onlostpointercapture={stop} onkeydown={keyboard}></div>
{/snippet}
{#if side === 'right'}{@render grabber()}{/if}
<aside id={side === 'left' ? 'sidebar' : 'inspector'} class={`workspace-sidebar ${side === 'left' ? 'sidebar' : 'inspector'}`} class:is-resizing={dragging} class:is-compact={mode === 'compact'} class:is-mini={mode === 'mini'} class:hidden={side === 'right' && width === 0} data-panel={panel} aria-label={side === 'left' ? 'Workspace sidebar' : 'Preview sidebar'} inert={width === 0}>
	{@render children()}
</aside>
{#if side === 'left'}{@render grabber()}{/if}
