// Wallpaper files: import from a picked image, and turn a stored name into a URL the webview can load.

import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";

/** Resolved asset URLs by stored name. Filled on first use, so the stage can read it reactively. */
export const wallpaperUrls = $state<Record<string, string>>({});

const pending = new Set<string>();

/** Asks for a wallpaper's URL. Returns null until it has loaded, then the stage re-renders. */
export function wallpaperUrl(name: string | null): string | null {
  if (!name) return null;
  if (wallpaperUrls[name]) return wallpaperUrls[name];
  if (!pending.has(name)) {
    pending.add(name);
    invoke<string>("wallpaper_path", { name })
      .then((path) => {
        wallpaperUrls[name] = convertFileSrc(path);
      })
      .catch(() => {})
      .finally(() => pending.delete(name));
  }
  return null;
}

/** Reads a file as base64 without holding up the page, which a long string-building loop would. */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * Stores a picked image and returns its stored name.
 * A GIF is re-encoded and takes a while, so the backend reports `onProgress` (0 to 1) as it goes.
 * A still image reports nothing and finishes at once.
 */
export async function importWallpaper(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const dataBase64 = await readBase64(file);
  const channel = new Channel<number>();
  channel.onmessage = (fraction) => onProgress?.(fraction);
  return invoke<string>("wallpaper_import", { dataBase64, onProgress: channel });
}

/** Resolves once a stored wallpaper's URL has loaded, so a new image can replace its placeholder without a blank gap. */
export async function wallpaperReady(name: string, timeoutMs = 2000): Promise<void> {
  const start = performance.now();
  while (!wallpaperUrl(name) && performance.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

export async function removeWallpaper(name: string): Promise<void> {
  await invoke("wallpaper_remove", { name });
  delete wallpaperUrls[name];
}
