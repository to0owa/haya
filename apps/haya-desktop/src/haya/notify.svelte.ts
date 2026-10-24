// In-app notifications. Errors stay until dismissed; info and success fade out.

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; kind: ToastKind; message: string };

let nextId = 1;
export const toasts = $state<Toast[]>([]);

export function notify(kind: ToastKind, message: string) {
  const id = nextId++;
  toasts.push({ id, kind, message });
  if (kind !== "error") {
    setTimeout(() => dismiss(id), 4000);
  }
  return id;
}

export function dismiss(id: number) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

// Desktop notifications (OS level). Only sent when the window is not focused,
// so they never duplicate an in-app toast the user is already looking at.
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

export async function notifyDesktop(title: string, body: string) {
  if (document.hasFocus()) return;
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (granted) sendNotification({ title, body });
}
