<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { WebglAddon } from "@xterm/addon-webgl";
  import { hideRenderer, showRenderer, type Renderer } from "./terminal-pool";
  import "@xterm/xterm/css/xterm.css";

  let host: HTMLDivElement;
  let term: Terminal;
  let fit: FitAddon;
  let id: number | null = null;
  let unlisten: UnlistenFn | undefined;
  let observer: ResizeObserver | undefined;
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

  const renderer: Renderer = { activate: enableWebgl, deactivate: disableWebgl };

  function decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  onMount(async () => {
    term = new Terminal({
      fontFamily: "Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: { background: "#1E2020", foreground: "#e6e9e1", cursor: "#e5e9df", selectionBackground: "#303b37" },
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    unlisten = await listen<{ id: number; data: string }>("pty-output", (event) => {
      if (event.payload.id === id) term.write(decode(event.payload.data));
    });
    id = await invoke<number>("pty_spawn", { rows: term.rows, cols: term.cols });
    term.onData((data) => invoke("pty_write", { id, data }));
    term.onResize(({ rows, cols }) => invoke("pty_resize", { id, rows, cols }));
    // Fit whenever the pane changes size, including when it becomes visible again.
    observer = new ResizeObserver(() => fit.fit());
    observer.observe(host);
    // Hidden tiles report not intersecting, so their WebGL context is released.
    visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) showRenderer(renderer);
      else hideRenderer(renderer);
    });
    visibility.observe(host);
  });

  onDestroy(() => {
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
  .terminal-screen { height: 100%; width: 100%; overflow: hidden; background: #1E2020; }
</style>
