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
      theme: { background: "#1c1c1e", foreground: "#d4d4d4" },
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

    window.addEventListener("resize", () => fit.fit());
  });

  onDestroy(() => {
    unlisten?.();
    if (id !== null) invoke("pty_close", { id });
    term?.dispose();
  });
</script>

<div class="terminal" bind:this={host}></div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: #1c1c1e;
  }
  .terminal {
    height: 100vh;
    padding: 8px;
    box-sizing: border-box;
  }
</style>
