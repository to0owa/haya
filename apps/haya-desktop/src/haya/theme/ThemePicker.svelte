<script lang="ts">
  import Swatch from "../components/Swatch.svelte";
  import { THEMES, type Theme, type ThemeMode } from "./themes";
  import { closePicker, setTheme, themeState } from "./theme.svelte";

  const GROUPS: { mode: ThemeMode; label: string }[] = [
    { mode: "dark", label: "Dark" },
    { mode: "light", label: "Light" },
  ];

  // The first theme of each mode is that mode's default.
  function isDefault(theme: Theme) {
    return THEMES.find((t) => t.mode === theme.mode) === theme;
  }

  function onkey(event: KeyboardEvent) {
    if (event.key === "Escape") closePicker();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="haya-theme-picker" role="listbox" aria-label="Color themes">
  {#each GROUPS as group, i (group.mode)}
    {#if i > 0}<div class="haya-theme-divider"></div>{/if}
    <div class="haya-theme-group-label">{group.label}</div>
    {#each THEMES.filter((t) => t.mode === group.mode) as theme (theme.id)}
      <button
        class="haya-theme-row"
        class:is-on={themeState.id === theme.id}
        role="option"
        aria-selected={themeState.id === theme.id}
        onclick={() => setTheme(theme.id)}
      >
        <Swatch colors={theme.swatches} label={theme.name} />
        <span class="haya-theme-name">{theme.name}</span>
        {#if isDefault(theme)}<span class="haya-theme-default">default</span>{/if}
      </button>
    {/each}
  {/each}
</div>
