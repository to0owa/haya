<script lang="ts">
  // Four colour dots that preview a theme. Used by the theme picker.
  let { colors, label }: { colors: [string, string, string, string]; label: string } = $props();
</script>

<span class="haya-swatch" role="img" aria-label={label}>
  {#each colors as color, i (i)}
    <span class="haya-swatch-dot" style="background: {color}"></span>
  {/each}
</span>
