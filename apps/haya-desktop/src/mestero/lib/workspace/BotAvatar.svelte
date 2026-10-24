<script lang="ts">
	import { avatar, playAvatar } from './avatar.js';
	let { name = 'Maestro', id, large = false }: { name?: string; id?: string; large?: boolean } = $props();
	let element: HTMLSpanElement;
	export function play(preset: string) { return playAvatar(element, preset); }
</script>

<span bind:this={element} use:avatar={name} class="avatar" class:avatar-large={large} {id}></span>
