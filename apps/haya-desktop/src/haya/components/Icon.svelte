<script lang="ts">
  // The only place icon geometry is defined. Every icon is 24×24 stroke paths.
  export const ICONS = {
    "panel-left": ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9 3v18"],
    "panel-right": ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M15 3v18"],
    "chevron-right": ["m9 6 6 6-6 6"],
    "chevron-down": ["m6 9 6 6 6-6"],
    plus: ["M12 5v14M5 12h14"],
    search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4"],
    back: ["m15 6-6 6 6 6"],
    forward: ["m9 6 6 6-6 6"],
    terminal: ["m4 17 6-6-6-6M12 19h8"],
    database: ["M4 5c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"],
    close: ["M6 6l12 12M18 6 6 18"],
    sliders: ["M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"],
    keyboard: ["M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01M7 17h10"],
    palette: ["M12 2a10 10 0 1 0 0 20c1 0 1.7-.7 1.7-1.7 0-.5-.2-.9-.4-1.2-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2c3 0 5.4-2.4 5.4-5.4C22 6 17.5 2 12 2z", "M7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01"],
  } as const;

  export type IconName = keyof typeof ICONS;

  let { name }: { name: IconName } = $props();
</script>

<svg class="haya-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#each ICONS[name] as d (d)}
    <path {d} />
  {/each}
</svg>
