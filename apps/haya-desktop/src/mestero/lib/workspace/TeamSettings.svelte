<script lang="ts">
import { onMount } from 'svelte';
import { type Workspace } from './workspace.svelte.js';
import BotAvatar from './BotAvatar.svelte';
import ModelRouteFields from './ModelRouteFields.svelte';
let { workspace }: { workspace: Workspace } = $props();
const ui = $derived(workspace.state);
let reducedMotion = $state(false);
let playing = $state('');
let liveAvatar: { play(preset: string): Promise<boolean> };
let playback = 0;
async function play(preset: string) {
 const token = ++playback; playing = preset;
 await liveAvatar.play(preset);
 if (playback === token) playing = '';
}
onMount(() => {
 const media = matchMedia('(prefers-reduced-motion: reduce)');
 const update = () => { reducedMotion = media.matches; };
 update(); media.addEventListener('change', update);
 return () => media.removeEventListener('change', update);
});
</script>
<div class="team-content">
            {#if workspace.service.state.error}<p class="form-error" role="alert">{workspace.service.state.error}</p>{/if}
            <div class="team-layout">
              <div class="member-list">
                <div class="section-row" style="padding-left:7px"><span>Teammates</span></div>
                {#each (['Maestro', 'Virtuoso', 'Soundcheck'] as const) as name}
                  <button type="button" class="member" class:active={ui.selectedMember === name} onclick={() => workspace.selectMember(name)}><BotAvatar {name} /><div><div class="member-title">{name}</div><div class="member-sub">{workspace.service.state.teammates.find(member => member.id === name)?.role || 'Loading…'}</div></div></button>
                {/each}
              </div>
              <div>
                <div class="profile-header"><BotAvatar name={ui.selectedMember} id="profile-avatar" /><div><div class="profile-name" id="profile-name">{ui.selectedMember}</div><div class="profile-role">Behavior template · model can be changed</div></div></div>
                <div class="avatar-preview"><BotAvatar name={ui.selectedMember} bind:this={liveAvatar} id="live-avatar" large /><div class="avatar-preview-copy"><div class="avatar-preview-title">Live teammate avatar</div><div class="avatar-preview-hint">A little curiosity, focus, and celebration. Try an expression.</div><div class="avatar-action-picker" role="group" aria-label="Preview avatar expressions"><button class="avatar-action-button" class:is-playing={playing === "bounce"} disabled={reducedMotion} onclick={() => play("bounce")} data-avatar-action="bounce">Bounce</button><button class="avatar-action-button" class:is-playing={playing === "lookAround"} disabled={reducedMotion} onclick={() => play("lookAround")} data-avatar-action="lookAround">Look around</button><button class="avatar-action-button" class:is-playing={playing === "curious"} disabled={reducedMotion} onclick={() => play("curious")} data-avatar-action="curious">Curious</button><button class="avatar-action-button" class:is-playing={playing === "happy"} disabled={reducedMotion} onclick={() => play("happy")} data-avatar-action="happy">Happy</button><button class="avatar-action-button" class:is-playing={playing === "nod"} disabled={reducedMotion} onclick={() => play("nod")} data-avatar-action="nod">Nod</button><button class="avatar-action-button" class:is-playing={playing === "focus"} disabled={reducedMotion} onclick={() => play("focus")} data-avatar-action="focus">Focus</button></div></div><span class="status-tag avatar-preview-state" id="avatar-state-label">{workspace.service.state.connected ? 'Connected' : 'Offline'}</span></div>
                <label class="form-label" for="role-field">Role</label><input class="field" id="role-field" bind:value={ui.teamDraft.role}>
                <label class="form-label" for="behavior-field">Behavior</label><textarea class="textarea-field" id="behavior-field" bind:value={ui.teamDraft.behavior}></textarea>
                <ModelRouteFields id="worker" title="Default route · inexpensive first" bind:harness={ui.teamDraft.harness} bind:model={ui.teamDraft.model} harnesses={workspace.service.state.harnesses} />
                <ModelRouteFields id="escalation" title="Escalation · when needed" bind:harness={ui.teamDraft.escalation_harness} bind:model={ui.teamDraft.escalation_model} harnesses={workspace.service.state.harnesses} optional />
                <p class="route-hint">Detection checks the installed CLI, not login status or model access. Existing agent authentication is used when a run starts.</p>
                <label class="form-label" for="capabilities-field">Capabilities</label><input class="field" id="capabilities-field" bind:value={ui.teamDraft.capabilities}>
              </div>
            </div>
          </div>
          <div class="team-footer"><span>Saved settings apply to future workflows.</span><span class="status-tag">Template · v2</span></div>
