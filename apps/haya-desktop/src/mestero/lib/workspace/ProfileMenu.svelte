<script lang="ts">
	import type { Workspace } from './workspace.svelte.js';
	let { workspace }: { workspace: Workspace } = $props();
	const ui = $derived(workspace.state);
	let root: HTMLDivElement;
	let menuOpen = $state(false);
	function close() { menuOpen = false; }
	function outside(event: MouseEvent) { if (event.target instanceof Node && !root?.contains(event.target)) close(); }
</script>
<svelte:window onclick={outside} onkeydown={event => { if (event.key === 'Escape') close(); }} />
<div class="profile-dock" bind:this={root}>
	<div class="account-menu" class:open={menuOpen} inert={!menuOpen} id="account-menu">
		<div class="theme-label">Local workspace</div>
		<button class="menu-item" onclick={() => { close(); ui.terminalOpen = true; }}><span class="menu-icon">◷</span>Run activity</button>
		<button class="menu-item" onclick={() => { close(); ui.helpOpen = true; }}><span class="menu-icon">▤</span>Help & shortcuts</button>
		<button class="menu-item" onclick={() => { close(); ui.commandOpen = true; }}><span class="menu-icon">›_</span>Command palette<span class="menu-chevron">⌘ K</span></button>
		<div class="menu-divider"></div>
		<button class="menu-item" onclick={() => { close(); workspace.service.state.dialog = 'project'; }}><span class="menu-icon">♧</span>Workspaces</button>
		<button class="menu-item" id="open-team-settings" onclick={() => { close(); workspace.setMode('team'); }}><span class="menu-icon">♬</span>Team settings</button>
		<div class="menu-divider"></div><div class="theme-label">Theme</div>
		<button class="theme-choice" aria-pressed={ui.theme === 'light'} onclick={() => workspace.setTheme('light')}><span class="menu-icon">☼</span>Light<span class="account-check">{ui.theme === 'light' ? '✓' : ''}</span></button>
		<button class="theme-choice" aria-pressed={ui.theme === 'dark'} onclick={() => workspace.setTheme('dark')}><span class="menu-icon">☾</span>Dark<span class="account-check">{ui.theme === 'dark' ? '✓' : ''}</span></button>
	</div>
	<button class="account-trigger" id="account-trigger" aria-expanded={menuOpen} onclick={() => menuOpen = !menuOpen} aria-label="Open workspace menu" aria-controls="account-menu"><span class="account-avatar" id="current-avatar">W</span><span class="account-info"><span class="account-name" id="current-name">{ui.account}</span></span><span class="muted">⌃⌄</span></button>
</div>
