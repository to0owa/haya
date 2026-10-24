<script lang="ts">
	let { kind }: { kind: 'overview' | 'tasks' | 'threads' | 'board' | 'team' | 'automation' | 'plan' | 'activity' | 'task' } = $props();
</script>
<svg viewBox="0 0 24 24" aria-hidden="true">
	{#if kind === 'overview'}<path d="M3.5 10.5 12 3.5l8.5 7M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
	{:else if kind === 'tasks'}<path d="m3 6 1.5 1.5L7 5M10 6h11M3 12l1.5 1.5L7 11m3 1h11M3 18l1.5 1.5L7 17m3 1h11" />
	{:else if kind === 'threads'}<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
	{:else if kind === 'team'}<circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M18 20a6 6 0 0 0-3-5.2" />
	{:else if kind === 'automation'}<rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18m-12 6 2 2 4-4" />
	{:else if kind === 'plan'}<path d="M7 3h7l4 4v14H7zM14 3v5h5M10 12h6M10 16h6" />
	{:else if kind === 'activity'}<path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
	{:else if kind === 'task'}<rect x="3" y="4" width="18" height="16" rx="2" /><path d="m8 12 2 2 4-4" />
	{:else}<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" />{/if}
</svg>
