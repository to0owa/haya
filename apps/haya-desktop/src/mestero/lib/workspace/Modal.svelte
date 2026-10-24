<script lang="ts">
	import type { Snippet } from 'svelte';
	let { open, title, onclose, children }: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();
	let dialog: HTMLDialogElement;
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			dialog.querySelector<HTMLElement>('input:not([type="file"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)')?.focus();
		} else if (!open && dialog.open) dialog.close();
	});
</script>
<dialog class="workspace-dialog" bind:this={dialog} onclose={onclose} aria-label={title}>
	<div class="dialog-head"><h2>{title}</h2><button type="button" class="icon-btn" aria-label="Close dialog" onclick={() => dialog.close()}>×</button></div>
	{@render children()}
</dialog>
