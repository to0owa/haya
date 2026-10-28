<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { onTerminalOutput } from "../events";

  // Bars shown across the widget. The middle ones are the tallest, so the shape reads like a voice waveform.
  const BARS = 21;
  // How long after the last output the waveform still counts as busy, in ms.
  const BUSY_MS = 700;

  let heights = $state<number[]>(Array.from({ length: BARS }, () => 0));
  let timer: ReturnType<typeof setInterval> | undefined;
  let unlisten: (() => void) | undefined;
  let lastOutput = 0;
  // Smoothed level from 0 (idle) to 1 (busy). It eases up and down, so the bars do not snap.
  let level = $state(0);

  onMount(() => {
    unlisten = onTerminalOutput(() => {
      lastOutput = performance.now();
    });
    timer = setInterval(() => {
      const busy = performance.now() - lastOutput < BUSY_MS;
      level += ((busy ? 1 : 0) - level) * 0.18;
      const t = performance.now() / 1000;
      heights = Array.from({ length: BARS }, (_, i) => {
        const centre = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const wobble = 0.55 + 0.45 * Math.sin(t * 9 + i * 1.7);
        return level * centre * wobble;
      });
    }, 60);
  });

  onDestroy(() => {
    clearInterval(timer);
    unlisten?.();
  });
</script>

<div class="haya-wave" role="img" aria-label="Activity: {level > 0.5 ? 'busy' : 'idle'}">
  {#each heights as h, i (i)}
    <span class="haya-wave-bar" style={`height:${Math.max(2, 2 + h * 22)}px`}></span>
  {/each}
</div>
