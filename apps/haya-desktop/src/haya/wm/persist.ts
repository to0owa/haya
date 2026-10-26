// Saves and restores the workspace layout through two Tauri commands. A bad or missing file falls back to defaults.

import { invoke } from "@tauri-apps/api/core";
import { normalize } from "./model";
import { hydrate, type Instance, snapshot, ensureDefaultWindows } from "./store.svelte";
import { notify } from "../notify.svelte";

interface Saved {
  config: unknown;
  instances: Record<number, Instance>;
}

export async function loadWorkspaces() {
  try {
    const text = await invoke<string | null>("workspaces_load");
    if (text) {
      const saved = JSON.parse(text) as Saved;
      hydrate(normalize(saved.config), saved.instances ?? {});
    }
  } catch {
    // Corrupt file: keep defaults and overwrite on the next save.
  }
  ensureDefaultWindows();
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Writes the current snapshot after a short quiet period. */
export function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    // A failed save must be visible, otherwise later changes look saved when they are not.
    try {
      invoke("workspaces_save", { json: snapshot() }).catch((error) => notify("error", `Could not save layout: ${error}`));
    } catch (error) {
      notify("error", `Could not save layout: ${error}`);
    }
  }, 400);
}
