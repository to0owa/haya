type TooltipOptions = { enabled: boolean; label: string; side?: 'left' | 'right' };

export function tooltip(node: HTMLElement, initial: TooltipOptions) {
	let options = initial;
	let label: HTMLDivElement | undefined;
	const hide = () => { label?.remove(); label = undefined; };
	const show = () => {
		if (!options.enabled) return;
		hide();
		const bounds = node.getBoundingClientRect();
		label = document.createElement('div');
		label.className = `sidebar-hover-label is-visible${options.side === 'left' ? ' is-left' : ''}`;
		label.setAttribute('role', 'tooltip');
		label.textContent = options.label;
		const left = options.side === 'left' ? bounds.left - 8 : bounds.right + 8;
		Object.assign(label.style, { position: 'fixed', left: `${left}px`, top: `${Math.max(16, Math.min(innerHeight - 16, bounds.top + bounds.height / 2))}px`, transform: options.side === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)' });
		document.body.append(label);
	};
	const controller = new AbortController();
	for (const event of ['pointerenter', 'focus']) node.addEventListener(event, show, { signal: controller.signal });
	for (const event of ['pointerleave', 'blur']) node.addEventListener(event, hide, { signal: controller.signal });
	return { update(next: TooltipOptions) { options = next; hide(); }, destroy() { controller.abort(); hide(); } };
}

/** One delegated listener set handles the prototype's press/release feedback. */
export function pressFeedback(root: HTMLElement) {
	const controller = new AbortController();
	const signal = controller.signal;
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let pressed: HTMLElement | null = null;
	let keyPressed: HTMLElement | null = null;
	const target = (event: Event) => event.target instanceof Element ? event.target.closest<HTMLElement>('button:not(:disabled)') : null;
	function release(element: HTMLElement | null, animate = true) {
		if (!element) return;
		element.classList.remove('is-pressed');
		if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		element.classList.remove('is-releasing');
		void element.offsetWidth;
		element.classList.add('is-releasing');
		const timer = setTimeout(() => { element.classList.remove('is-releasing'); timers.delete(timer); }, 290);
		timers.add(timer);
	}
	root.addEventListener('pointerdown', event => { if (event.button === 0) { pressed = target(event); pressed?.classList.remove('is-releasing'); pressed?.classList.add('is-pressed'); } }, { signal });
	window.addEventListener('pointerup', () => { release(pressed); pressed = null; }, { signal });
	window.addEventListener('pointercancel', () => { release(pressed, false); pressed = null; }, { signal });
	root.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key) && !event.repeat) { keyPressed = target(event); keyPressed?.classList.add('is-pressed'); } }, { signal });
	root.addEventListener('keyup', event => { if (['Enter', ' '].includes(event.key)) { release(keyPressed); keyPressed = null; } }, { signal });
	window.addEventListener('blur', () => { release(pressed, false); release(keyPressed, false); pressed = keyPressed = null; }, { signal });
	return { destroy() { controller.abort(); timers.forEach(clearTimeout); } };
}
