// App updates. Haya checks the GitHub release feed (see plugins.updater in tauri.conf.json) and installs signed builds.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { notify } from "./notify.svelte";

export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "current" | "failed";

export const updates = $state({
  phase: "idle" as UpdatePhase,
  version: "" as string,
  /** Download progress from 0 to 1, or null while the size is unknown. */
  progress: null as number | null,
  error: "" as string,
});

let pending: Update | null = null;

/** Looks for a newer release. A quiet check reports nothing when the app is current or offline. */
export async function checkForUpdate(quiet = false) {
  if (updates.phase === "checking" || updates.phase === "downloading") return;
  updates.phase = "checking";
  updates.error = "";
  try {
    pending = await check();
    if (pending) {
      updates.phase = "available";
      updates.version = pending.version;
      if (quiet) notify("info", `Haya ${pending.version} is available. Install it from Preferences > About.`);
    } else {
      updates.phase = "current";
    }
  } catch (error) {
    updates.phase = quiet ? "idle" : "failed";
    updates.error = String(error);
  }
}

/** Downloads and installs the release found by checkForUpdate, then restarts into it. */
export async function installUpdate() {
  if (!pending || updates.phase !== "available") return;
  updates.phase = "downloading";
  updates.progress = null;
  let total = 0;
  let received = 0;
  try {
    await pending.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      else if (event.event === "Progress") {
        received += event.data.chunkLength;
        updates.progress = total ? Math.min(1, received / total) : null;
      }
    });
    updates.phase = "ready";
    await relaunch();
  } catch (error) {
    updates.phase = "failed";
    updates.error = String(error);
  }
}
