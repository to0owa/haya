<script lang="ts">
	import type { GitSetupPreview } from './service.svelte.js';
	let { preview, pending, error, onback, onconfirm }: { preview: GitSetupPreview; pending: boolean; error: string; onback: () => void; onconfirm: () => Promise<void> } = $props();
	let consent = $state(false), submitted = $state(false);
	const totalBytes = $derived(preview.files.reduce((total, file) => total + file.bytes, 0));
	function size(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
</script>

<p class="muted">{preview.initialize ? 'This folder is not a Git workspace yet.' : 'This Git workspace has no initial commit yet.'} Git is required so tasks can use separate worktrees.</p>
<dl class="setup-summary"><div><dt>Workspace</dt><dd>{preview.name}</dd></div><div><dt>Folder</dt><dd class="setup-path">{preview.path}</dd></div><div><dt>Branch</dt><dd>{preview.branch}</dd></div></dl>
<p>Mestero will {preview.initialize ? 'initialize Git, ' : ''}append the exclusions below to <code>.gitignore</code> and create an initial local commit as <strong>Mestero &lt;mestero@localhost&gt;</strong>.</p>
<details><summary>Review .gitignore additions</summary><pre>{preview.ignore_additions.trim()}</pre></details>
<details open><summary>Initial commit · {preview.files.length} files · {size(totalBytes)}</summary><ul class="setup-files" aria-label="Files in the initial commit">{#each preview.files as file (file.path)}<li><code>{file.path}</code><span>{size(file.bytes)}</span></li>{/each}</ul></details>
<p class="muted">Review this list before allowing setup. Existing file contents are preserved, except for the listed .gitignore additions. Nothing is pushed. Each task gets its own branch and worktree after you approve its plan.</p>
<label class="setup-consent"><input type="checkbox" bind:checked={consent} disabled={pending || submitted} /><span>I allow Mestero to {preview.initialize ? 'initialize Git and ' : ''}create the initial commit with these files.</span></label>
{#if error}<p class="form-error" role="alert">{error}</p><p class="muted">Go back to review a new preview. If setup started before an error, inspect the folder’s Git state; completed steps are preserved.</p>{/if}
<div class="dialog-actions"><button type="button" class="ghost" disabled={pending} onclick={onback}>Back</button><button type="button" class="primary" disabled={!consent || pending || submitted} onclick={async () => { submitted = true; await onconfirm(); }}>{pending ? 'Setting up Git…' : 'Set up Git and connect workspace'}</button></div>

<style>
	.setup-summary { display: grid; gap: 8px; margin: 20px 0; }
	.setup-summary div { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 12px; }
	dt { color: var(--muted); }
	dd { margin: 0; overflow-wrap: anywhere; }
	.setup-path, pre, code { font-family: var(--font-mono, monospace); font-size: .875em; }
	details { margin: 12px 0; border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
	summary { cursor: pointer; }
	pre { max-height: 180px; overflow: auto; white-space: pre-wrap; margin-bottom: 0; }
	.setup-files { max-height: 210px; overflow: auto; list-style: none; margin: 12px 0 0; padding: 0; }
	.setup-files li { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 5px 0; }
	.setup-files code { overflow-wrap: anywhere; min-width: 0; }
	.setup-files span { color: var(--muted); font-size: .8em; white-space: nowrap; }
	.setup-consent { display: flex; gap: 10px; align-items: flex-start; margin-top: 20px; cursor: pointer; }
	.setup-consent input { flex: none; margin-top: 5px; accent-color: var(--text); }
	.dialog-actions { flex-wrap: wrap; }
</style>
