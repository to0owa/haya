<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { DirectoryListing } from './service.svelte.js';
	import { pickerFilter, pickerTargetIsNavigable, readPickerView, resolvePickerPath, writePickerView, type PickerView } from './picker.js';
	let { initialPath = '', load, onselect, onclose }: {
		initialPath?: string;
		load: (path?: string, hidden?: boolean, signal?: AbortSignal) => Promise<DirectoryListing>;
		onselect: (workspace: { path: string; name: string }) => void;
		onclose: () => void;
	} = $props();
	let listing = $state<DirectoryListing | null>(null);
	let loading = $state(false), error = $state(''), draft = $state(untrack(() => initialPath)), showHidden = $state(false);
	let view = $state<PickerView>(readPickerView());
	let controller: AbortController | undefined;
	let generation = 0;
	const filter = $derived(pickerFilter(draft, listing?.path || initialPath));
	const folders = $derived(listing?.directories.filter(folder => folder.name.toLowerCase().includes(filter.trim().toLowerCase())) || []);
	const home = $derived(listing?.locations.find(location => location.name === 'Home')?.path);
	const target = $derived(listing ? resolvePickerPath(draft, listing.path, home, listing.directories) : null);
	const canOpen = $derived(Boolean(target && listing && target !== listing.path && pickerTargetIsNavigable(draft, listing.directories)));
	const committed = $derived(Boolean(listing && target === listing.path));
	async function navigate(path?: string) {
		controller?.abort();
		controller = new AbortController();
		const token = ++generation;
		loading = true; error = '';
		try {
			const result = await load(path, showHidden, controller.signal);
			if (token === generation) { listing = result; draft = result.path; }
		}
		catch (cause) { if (token === generation && !controller.signal.aborted) error = cause instanceof Error ? cause.message : 'Could not open server folder.'; }
		finally { if (token === generation) loading = false; }
	}
	function openPath() {
		if (!listing) return;
		const destination = resolvePickerPath(draft, listing.path, home, listing.directories);
		if (!destination) { error = 'Set a Home location to use ~ paths on this server.'; return; }
		if (destination === listing.path) { draft = listing.path; error = ''; return; }
		if (!pickerTargetIsNavigable(draft, listing.directories)) return;
		void navigate(destination);
	}
	function chooseView(next: PickerView) {
		view = next;
		writePickerView(next);
	}
	function addressKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			openPath();
		}
	}
	function selectPath(event: FocusEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (input.selectionStart === input.selectionEnd) input.select();
	}
	onMount(() => {
		void (async () => {
			await navigate(initialPath || undefined);
			if (!listing && error) { const firstError = error; await navigate(); if (listing) error = firstError; }
		})();
		return () => { generation++; controller?.abort(); };
	});
</script>

<section class="workspace-picker" aria-label="Browse server workspaces" aria-busy={loading}>
	<div class="picker-heading"><strong>Folders on the Mestero server</strong><button type="button" class="icon-btn" aria-label="Close folder browser" onclick={onclose}>×</button></div>
	{#if listing}
		<div class="picker-toolbar">
			<nav class="picker-locations" aria-label="Server locations">
				{#each listing.locations as location}<button type="button" class="ghost" disabled={loading} onclick={() => navigate(location.path)}>{location.name}</button>{/each}
			</nav>
			<div class="picker-view" role="group" aria-label="Folder layout">
				<button type="button" class="picker-view-button" aria-label="List view" title="List view" aria-pressed={view === 'list'} onclick={() => chooseView('list')}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
				</button>
				<button type="button" class="picker-view-button" aria-label="Grid view" title="Grid view" aria-pressed={view === 'grid'} onclick={() => chooseView('grid')}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
				</button>
			</div>
		</div>
		<div class="picker-path">
			<button type="button" class="ghost picker-up" disabled={!listing.parent || loading} aria-label="Open parent folder" title="Open parent folder" onclick={() => navigate(listing?.parent || undefined)}>↑</button>
			<input class="field picker-address" aria-label="Folder path" placeholder="Type a path or folder name" spellcheck="false" autocomplete="off" autocapitalize="off" bind:value={draft} disabled={loading} onkeydown={addressKeydown} oninput={() => error = ''} onfocus={selectPath} />
		</div>
		<div class="picker-meta">
			<label><input type="checkbox" checked={showHidden} disabled={loading} onchange={event => { showHidden = event.currentTarget.checked; void navigate(listing?.path); }} /> Hidden</label>
			<span class="muted">{folders.length} {folders.length === 1 ? 'folder' : 'folders'}</span>
		</div>
		{#if canOpen && target}
			<button type="button" class="picker-hint" onclick={openPath} title={target}><span aria-hidden="true">↵</span> Open <code>{target}</code></button>
		{/if}
	{/if}
	{#if error}<p class="form-error" role="alert">{error}</p>{/if}
	<div class="picker-folders" class:is-grid={view === 'grid'}>
		{#if loading}<p class="muted" role="status">Opening server folder…</p>
		{:else if listing}
			{#each folders as folder (folder.path)}
				<button type="button" class="folder-row" onclick={() => navigate(folder.path)}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3Z" /></svg>
					<span class="folder-name">{folder.name}</span>{#if folder.is_repository}<span class="repo-badge">Git</span>{/if}<span class="folder-arrow" aria-hidden="true">›</span>
				</button>
			{:else}<p class="muted">{filter ? 'No matching folders.' : 'No accessible subfolders.'}</p>{/each}
		{/if}
	</div>
	{#if listing?.truncated}<p class="muted picker-note">This folder is large; the list is limited. Open a subfolder or type a path in the field.</p>{/if}
	<div class="picker-footer">
		<span class="muted">{!committed ? 'Press Enter to open the typed path.' : listing?.repository ? `Git ready · ${listing.repository.branch}` : 'Use this folder as your workspace.'}</span>
		<button type="button" class="primary" disabled={loading || !listing?.workspace || !committed} title={committed ? 'Use this folder' : 'Press Enter to open the typed path first'} onclick={() => { if (listing?.workspace && committed) onselect(listing.workspace); }}>Use workspace</button>
	</div>
</section>

<style>
	.workspace-picker { margin-top: 12px; border: 1px solid var(--line2); border-radius: 10px; padding: 12px; font-size: 12px; min-width: 0; }
	.picker-heading, .picker-toolbar, .picker-path, .picker-meta, .picker-footer { display: flex; align-items: center; gap: 8px; }
	.picker-heading { justify-content: space-between; }
	.picker-toolbar { justify-content: space-between; gap: 6px; margin: 8px 0; }
	.picker-locations { display: flex; gap: 6px; flex-wrap: wrap; min-width: 0; }
	.picker-locations button, .picker-path button { font-size: 11px; padding: 6px 10px; }
	.picker-view { display: flex; gap: 2px; flex: none; padding: 2px; border: 1px solid var(--line2); border-radius: 7px; }
	.picker-view-button { display: grid; place-items: center; width: 26px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--muted); }
	.picker-view-button:hover { background: var(--hover); color: var(--text); }
	.picker-view-button[aria-pressed="true"] { background: var(--selected); color: var(--text); }
	.picker-view-button svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
	.picker-path { gap: 6px; }
	.picker-path .picker-address { flex: 1; min-width: 0; padding: 7px 10px; font-family: ui-monospace, monospace; font-size: 11px; }
	.picker-up { flex: none; display: grid; place-items: center; width: 34px; height: 34px; padding: 0; font-size: 13px; }
	.picker-meta { justify-content: space-between; margin: 6px 0 8px; }
	.picker-meta label { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
	.picker-meta .muted { font-size: 11px; }
	.picker-hint { display: flex; align-items: center; gap: 6px; width: 100%; margin-bottom: 6px; padding: 6px 8px; border: 1px dashed var(--line2); border-radius: 6px; background: transparent; color: var(--muted); text-align: left; font-size: 11px; }
	.picker-hint:hover, .picker-hint:focus-visible { background: var(--hover); color: var(--text); }
	.picker-hint code { font-family: ui-monospace, monospace; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.picker-folders { max-height: 220px; overflow-y: auto; min-height: 70px; }
	.folder-row { display: flex; gap: 10px; align-items: center; width: 100%; padding: 8px 6px; border: 0; background: transparent; text-align: left; border-radius: 6px; }
	.folder-row:hover, .folder-row:focus-visible { background: var(--hover); }
	.folder-row svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.5; flex: none; color: var(--muted); }
	.folder-name { flex: 1; overflow-wrap: anywhere; min-width: 0; }
	.repo-badge { color: var(--muted); font-size: 10px; }
	.folder-arrow { color: var(--quiet); }
	.picker-folders.is-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); align-content: start; gap: 6px; }
	.is-grid .folder-row { flex-direction: column; align-items: flex-start; gap: 4px; min-height: 66px; padding: 8px; border: 1px solid var(--line); background: var(--soft); }
	.is-grid .folder-row:hover, .is-grid .folder-row:focus-visible { border-color: var(--line2); background: var(--hover); }
	.is-grid .folder-name { flex: none; font-weight: 600; }
	.is-grid .folder-arrow { display: none; }
	.is-grid > p { grid-column: 1 / -1; }
	.picker-footer { justify-content: space-between; border-top: 1px solid var(--line); padding-top: 10px; margin-top: 8px; }
	.picker-footer button { white-space: nowrap; font-size: 11px; padding: 8px 10px; }
	.picker-footer button:disabled { opacity: .45; }
	.picker-note, .picker-footer span { font-size: 11px; line-height: 1.5; }
	@media (max-width: 480px) { .picker-toolbar { align-items: flex-start; } .picker-footer { align-items: flex-start; flex-direction: column; } .picker-footer button { align-self: flex-end; } }
</style>
