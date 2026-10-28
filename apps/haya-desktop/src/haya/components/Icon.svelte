<script module lang="ts">
  // The only place icon geometry is defined. Every icon is 24×24 stroke paths.
  export const ICONS = {
    "panel-left": ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9 3v18"],
    "panel-right": ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M15 3v18"],
    "chevron-right": ["m9 6 6 6-6 6"],
    "chevron-down": ["m6 9 6 6 6-6"],
    plus: ["M12 5v14M5 12h14"],
    trash: ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
    search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4"],
    back: ["m15 6-6 6 6 6"],
    forward: ["m9 6 6 6-6 6"],
    terminal: ["m4 17 6-6-6-6M12 19h8"],
    database: ["M4 5c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"],
    close: ["M6 6l12 12M18 6 6 18"],
    sliders: ["M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"],
    keyboard: ["M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01M7 17h10"],
    file: ["M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"],
    chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
    git: ["M6 3v12M18 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9"],
    folder: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
    "layout-tile": ["M4 4h16v16H4zM4 4h7v16", "M11 12h9"],
    "layout-bstack": ["M4 4h16v16H4zM4 12h16", "M12 12v8"],
    "layout-monocle": ["M4 4h16v16H4z", "M4 4h16", "M4 20h16"],
    "layout-grid": ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
    "layout-ide": ["M4 4h16v16H4z", "M4 4h5v16", "M9 15h11"],
    pencil: ["M4 20h4L19 9l-4-4L4 16zM14 6l4 4"],
    grid: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
    info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01"],
    palette: ["M12 2a10 10 0 1 0 0 20c1 0 1.7-.7 1.7-1.7 0-.5-.2-.9-.4-1.2-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2c3 0 5.4-2.4 5.4-5.4C22 6 17.5 2 12 2z", "M7.5 11h.01M10 7.5h.01M14.5 7.5h.01M17 11h.01"],
  } as const;


  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg class="haya-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#each ICONS[name] as d (d)}
    <path {d} />
  {/each}
</svg>
