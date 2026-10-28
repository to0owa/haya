<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { WebglAddon } from "@xterm/addon-webgl";
  import { hideRenderer, showRenderer, type Renderer } from "./terminal-pool";
  import { emitTerminalOutput } from "./plugins/events";
  import { themeState } from "./theme/theme.svelte";
  import { ANSI_LIGHT, extendedAnsiLight } from "./theme/themes";
  import "@xterm/xterm/css/xterm.css";

  let { alpha = 1, zoom = 13 }: { alpha?: number; zoom?: number } = $props();

  let host: HTMLDivElement;
  let term: Terminal;
  let fit: FitAddon;
  let id: number | null = null;
  let unlisten: UnlistenFn | undefined;
  let observer: ResizeObserver | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  // How long the pane must stay the same size before the terminal grid follows it.
  const SETTLE_MS = 100;
  let visibility: IntersectionObserver | undefined;
  let webgl: WebglAddon | undefined;

  // WebGL is only held while the terminal is on screen. See terminal-pool.ts.
  function enableWebgl() {
    if (!term || webgl) return;
    try {
      const addon = new WebglAddon();
      addon.onContextLoss(() => {
        addon.dispose();
        if (webgl === addon) webgl = undefined;
      });
      term.loadAddon(addon);
      webgl = addon;
    } catch {
      // No WebGL in this webview: the default renderer keeps working.
      webgl = undefined;
    }
  }

  function disableWebgl() {
    webgl?.dispose();
    webgl = undefined;
  }

  // A translucent terminal cannot use WebGL: its renderer paints every cell's background opaque.
  // Below full opacity the terminal stays on the DOM renderer, which honours the rgba background.
  const renderer: Renderer = {
    activate: () => {
      if (alpha >= 1) enableWebgl();
    },
    deactivate: disableWebgl,
  };
  let visible = false;

  // Colours come from the theme tokens, so the terminal follows Dark and Light.
  function termTheme() {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string) => css.getPropertyValue(name).trim();
    const base = {
      background: read("--terminal-bg"),
      foreground: read("--terminal-fg"),
      cursor: read("--terminal-cursor"),
      selectionBackground: read("--terminal-selection"),
    };
    // Light backgrounds need their own ANSI palette, so "white" text stays readable.
    const themed = document.documentElement.dataset.theme === "light" ? { ...base, ...ANSI_LIGHT, extendedAnsi: extendedAnsiLight() } : base;
    // A translucent window shows the wallpaper through the terminal too. xterm takes an rgba background.
    // Translucent: the window paints the one tint, so xterm draws no background of its own.
    // Stacking two translucent layers is what made the glass look layered.
    return alpha >= 1 ? themed : { ...themed, background: "rgba(0, 0, 0, 0)" };
  }

  function decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  onMount(async () => {
    term = new Terminal({
      fontFamily: "Menlo, monospace",
      fontSize: zoom,
      cursorBlink: true,
      theme: termTheme(),
    });
    // Re-read the tokens whenever the theme changes.
    // Re-read the tokens whenever the theme changes.
    // Font size follows ⌘+ and ⌘-. FitAddon then recounts rows and columns, and the PTY is told the new size.
    $effect(() => {
      void zoom;
      if (!term) return;
      term.options.fontSize = zoom;
      fit?.fit();
    });

    $effect(() => {
      void themeState.id;
      if (alpha < 1) disableWebgl();
      else if (visible) enableWebgl();
      if (!term) return;
      term.options.theme = termTheme();
    });
    // ⌘L clears the screen the way Ctrl-L does in the shell. xterm sends nothing for ⌘ combinations,
    // so the control code is written to the PTY here. Everything else goes through untouched.
    term.attachCustomKeyEventHandler((event) => {
      const clear = event.type === "keydown" && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "l";
      if (!clear) return true;
      event.preventDefault();
      if (id !== null) invoke("pty_write", { id, data: "\x0c" });
      return false;
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    unlisten = await listen<{ id: number; data: string }>("pty-output", (event) => {
      if (event.payload.id === id) {
        emitTerminalOutput();
        term.write(decode(event.payload.data));
      }
    });
    id = await invoke<number>("pty_spawn", { rows: term.rows, cols: term.cols });
    term.onData((data) => invoke("pty_write", { id, data }));
    term.onResize(({ rows, cols }) => invoke("pty_resize", { id, rows, cols }));
    // Fit when the pane changes size, including when it becomes visible again.
    // The PTY is resized once per fit, and the shell redraws its prompt on every resize. While a divider is dragged or a
    // window eases to a new size the pane changes every frame, and a prompt redrawn dozens of times leaves stale prompt
    // lines behind. So the grid follows only once the pane has stopped changing, and the shell is told once.
    // A pane that was hidden (no size) is fitted at once, since nothing is being dragged then.
    let lastBox = { w: 0, h: 0 };
    observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      const wasHidden = lastBox.w === 0 || lastBox.h === 0;
      lastBox = { w: box.width, h: box.height };
      clearTimeout(settleTimer);
      if (wasHidden) fit.fit();
      else settleTimer = setTimeout(() => fit.fit(), SETTLE_MS);
    });
    observer.observe(host);
    // Hidden tiles report not intersecting, so their WebGL context is released.
    visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (entry.isIntersecting) showRenderer(renderer);
      else hideRenderer(renderer);
    });
    visibility.observe(host);
  });

  onDestroy(() => {
    clearTimeout(settleTimer);
    observer?.disconnect();
    visibility?.disconnect();
    hideRenderer(renderer);
    unlisten?.();
    if (id !== null) invoke("pty_close", { id });
    term?.dispose();
  });
</script>

<div class="terminal">
  <div class="terminal-screen" bind:this={host}></div>
</div>

<style>
  /* Fills the window. Its colour matches the xterm theme, so the pixels FitAddon leaves over stay invisible. */
  .terminal { height: 100%; width: 100%; }
  .terminal-screen { height: 100%; width: 100%; overflow: hidden; background: transparent; }
</style>
