<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import Button from "../components/Button.svelte";
  import ThemeList from "../theme/ThemeList.svelte";
  import { SHORTCUTS } from "../wm/shortcuts";
  import { closePreferences, prefs, type Section } from "./prefs-state.svelte";

  const SECTIONS: { id: Section; label: string; icon: "palette" | "keyboard" }[] = [
    { id: "interface", label: "Interface", icon: "palette" },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: "keyboard" },
  ];

  const current = $derived(SECTIONS.find((s) => s.id === prefs.section) ?? SECTIONS[0]);

  function onkey(event: KeyboardEvent) {
    if (prefs.open && event.key === "Escape") closePreferences();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if prefs.open}
  <div class="haya-prefs-scrim" role="presentation" onmousedown={(e) => e.target === e.currentTarget && closePreferences()}>
    <div class="haya-prefs" role="dialog" aria-modal="true" aria-label="Preferences">
      <nav class="haya-prefs-nav" aria-label="Preference sections">
        <div class="haya-prefs-title">Preferences</div>
        {#each SECTIONS as section (section.id)}
          <button class="haya-prefs-link" class:is-on={prefs.section === section.id} onclick={() => (prefs.section = section.id)}>
            <Icon name={section.icon} />
            <span>{section.label}</span>
          </button>
        {/each}
      </nav>

      <section class="haya-prefs-body">
        <header class="haya-prefs-head">
          <h2>{current.label}</h2>
          <Button variant="icon" label="Close preferences" onclick={closePreferences}>
            <Icon name="close" />
          </Button>
        </header>

        {#if prefs.section === "interface"}
          <h3 class="haya-prefs-sub">Color theme</h3>
          <ThemeList />
        {:else}
          <div class="haya-prefs-shortcuts">
            {#each SHORTCUTS as shortcut (shortcut.action)}
              <div class="haya-prefs-shortcut">
                <span class="haya-prefs-action">{shortcut.action}</span>
                <kbd>{shortcut.keys}</kbd>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}
