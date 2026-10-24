<script lang="ts">
	let { files, onremove }: { files: File[]; onremove?: (index: number) => void } = $props();
	function size(bytes: number) {
		return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<ul class="attachment-list" aria-label="Attachments">
	{#each files as file, index}
		<li class="attachment-chip">
			<span class="attachment-name" title={file.name}>{file.name}</span>
			<span class="attachment-size">{size(file.size)}</span>
			{#if onremove}<button type="button" aria-label={`Remove ${file.name}`} onclick={() => onremove?.(index)}>×</button>{/if}
		</li>
	{/each}
</ul>
