<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import AttachmentList from './AttachmentList.svelte';
	let { value = $bindable(''), files = $bindable<File[]>([]), onsubmit, status, actions, disabled = false, placeholder = 'Message Maestro…' }: {
		value?: string; files?: File[]; onsubmit: () => void; status: string; actions?: Snippet; disabled?: boolean; placeholder?: string;
	} = $props();
	let textarea: HTMLTextAreaElement;
	let picker: HTMLInputElement;
	const canSubmit = $derived(!disabled && Boolean(value.trim() || files.length));
	$effect(() => {
		value;
		tick().then(() => {
			if (!textarea) return;
			textarea.style.height = '48px';
			textarea.style.height = `${Math.min(180, Math.max(48, textarea.scrollHeight))}px`;
		});
	});
	function addFiles(incoming: FileList | null) {
		if (!incoming || disabled) return;
		const keys = new Set(files.map(file => `${file.name}:${file.size}:${file.lastModified}`));
		const added = Array.from(incoming).filter(file => {
			const key = `${file.name}:${file.size}:${file.lastModified}`;
			if (keys.has(key)) return false;
			keys.add(key); return true;
		});
		files = [...files, ...added];
	}
	function submit() { if (canSubmit) { onsubmit(); textarea?.focus(); } }
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
			event.preventDefault(); submit();
		}
	}
</script>

<form class="composer" onsubmit={event => { event.preventDefault(); submit(); }}>
	{#if files.length}<AttachmentList {files} onremove={disabled ? undefined : index => files = files.filter((_, i) => i !== index)} />{/if}
	<textarea {disabled} bind:this={textarea} bind:value aria-label="Message Maestro" {placeholder} onkeydown={keydown} onpaste={event => {
		if (event.clipboardData?.files.length) { event.preventDefault(); addFiles(event.clipboardData.files); }
	}}></textarea>
	<input bind:this={picker} type="file" {disabled} multiple hidden aria-label="Choose attachments" onchange={() => { addFiles(picker.files); picker.value = ''; textarea?.focus(); }} />
	<div class="composer-foot">
		<span>{status}</span>
		<div class="composer-actions">
			<button type="button" class="icon-btn" title="Attach files · up to 10 MB each" disabled={disabled} aria-label="Attach files" onclick={() => picker.click()}>＋</button>
			{@render actions?.()}
			<button type="submit" class="send" title="Send · Enter (Shift+Enter for a new line)" aria-label="Send message" disabled={!canSubmit}>↑</button>
		</div>
	</div>
</form>
