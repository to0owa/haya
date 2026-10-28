<script lang="ts">
  import Disclosure from "../components/Disclosure.svelte";
  import type { GlassLook, GlassSurface } from "../wm/model";
  import { setGlass, wm } from "../wm/store.svelte";

  // The same five controls for every surface. Each surface keeps its own values.
  let { surface, title }: { surface: GlassSurface; title: string } = $props();

  // scale turns the stored value into the number the slider shows (0 to 1 becomes 0 to 100).
  const ROWS: { key: keyof GlassLook; label: string; min: number; max: number; step: number; scale: number; unit: string }[] = [
    { key: "opacity", label: "Opacity", min: 30, max: 100, step: 5, scale: 100, unit: "%" },
    { key: "blur", label: "Blur", min: 0, max: 40, step: 1, scale: 1, unit: "px" },
    { key: "highlight", label: "Highlight", min: 0, max: 100, step: 5, scale: 100, unit: "%" },
    { key: "sheen", label: "Sheen", min: 0, max: 100, step: 5, scale: 100, unit: "%" },
    { key: "saturation", label: "Saturation", min: 100, max: 200, step: 5, scale: 1, unit: "%" },
  ];

  const look = $derived(wm.config.glass[surface]);
  let open = $state(false);
</script>

<Disclosure {title} bind:open>
  {#each ROWS as row (row.key)}
    <label class="haya-prefs-slider">
      <span>{row.label}</span>
      <input
        type="range"
        min={row.min}
        max={row.max}
        step={row.step}
        value={Math.round(look[row.key] * row.scale)}
        oninput={(e) => setGlass(surface, row.key, Number((e.currentTarget as HTMLInputElement).value) / row.scale)}
      />
      <span class="haya-prefs-value">{Math.round(look[row.key] * row.scale)}{row.unit}</span>
    </label>
  {/each}
</Disclosure>
