<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";

  let host: HTMLDivElement;
  let term: Terminal;
  let fit: FitAddon;
  let id: number | null = null;
  let unlisten: UnlistenFn | undefined;
  let observer: ResizeObserver | undefined;

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
  });

  onDestroy(() => {
    observer?.disconnect();
    unlisten?.();
    if (id !== null) invoke("pty_close", { id });
    term?.dispose();
  });
</script>

<div class="terminal" bind:this={host}></div>

<style>
  .terminal { height: 100%; width: 100%; padding: 8px; box-sizing: border-box; background: var(--bg); }
</style>
