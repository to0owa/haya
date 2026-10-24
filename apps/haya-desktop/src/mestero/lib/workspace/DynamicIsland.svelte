<script lang="ts">
import type { Workspace } from './workspace.svelte.js';
let { workspace, boundary }: { workspace: Workspace; boundary: HTMLElement | undefined } = $props();
let element: HTMLDivElement;
let visible = $state(false), expanded = $state(false), message = $state('');
function sync() {
 if (!boundary || !element) return;
 const bounds = boundary.getBoundingClientRect();
 element.style.setProperty('--island-center', `${bounds.left + bounds.width / 2}px`);
 element.style.setProperty('--island-edge', `${bounds.top + .5}px`);
 element.style.setProperty('--island-boundary-width', `${bounds.width}px`);
}
$effect(() => {
 if (!boundary) return;
 const observer = new ResizeObserver(sync); observer.observe(boundary);
 window.addEventListener('resize', sync); sync();
 return () => { observer.disconnect(); window.removeEventListener('resize', sync); };
});
$effect(() => {
 const notice = workspace.state.notice;
 if (!notice.id) return;
 message = notice.message; visible = true; sync();
 const frame = requestAnimationFrame(() => expanded = true);
 let hide: ReturnType<typeof setTimeout>;
 const collapse = setTimeout(() => { expanded = false; hide = setTimeout(() => { visible = false; message = ''; }, 390); }, 2300);
 return () => { cancelAnimationFrame(frame); clearTimeout(collapse); clearTimeout(hide); };
});
</script>
<div class="dynamic-island" bind:this={element} class:is-visible={visible} class:is-expanded={expanded} id="dynamic-island" role="status" aria-live="polite">
      <svg class="island-surface" viewBox="0 0 440 52" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="island-fill" x1="0" y1="0" x2="0" y2="52" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1E2020"/><stop offset=".48" stop-color="#171b1a"/><stop offset="1" stop-color="#121615"/></linearGradient></defs>
        <!-- Both roots remain on the existing border while the underside unfolds below them. -->
        <g class="island-shape">
        <path fill="url(#island-fill)" d="M0 -2H440V0C414 0 409 9 400 25C390 44 378 52 354 52H86C62 52 50 44 40 25C31 9 26 0 0 0Z"/>
        <path fill="none" stroke="#2b3431" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="butt" stroke-linejoin="round" d="M0 0C26 0 31 9 40 25C50 44 62 52 86 52H354C378 52 390 44 400 25C409 9 414 0 440 0"/>
        </g>
      </svg>
      <span class="island-content"><span class="island-dot" aria-hidden="true"></span><span class="island-message" id="island-message">{message}</span></span>
    </div>
