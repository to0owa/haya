// Project files: one folder per project, with a small project.json and a windows.json.
// Live sessions are never stored here. Only descriptions are, so a project can be rebuilt on open.

import type { Config } from "./model";
import { normalize } from "./model";

export interface ProjectMeta {
  id: string;
  name: string;
  /** Folder group the project sits in, for example "Office" or "Freelance". Empty means ungrouped. */
  group: string;
  /** Folder the terminals start in, or null when the project has none. */
  folder: string | null;
  /** Saved database profile name, or null. */
  profile: string | null;
  /** Last time the project was seen, in ms since epoch. The idle timer counts from here. */
  lastSeen: number;
}

export interface ProjectFile {
  version: 1;
  meta: ProjectMeta;
  config: Config;
}

/** A window description. Terminals keep their folder, tables their schema and name. No live state. */
export type WindowDescription =
  | { kind: "terminal"; folder: string | null }
  | { kind: "table"; schema: string; table: string }
  | { kind: "other"; title: string };

export function parseProject(text: string): ProjectFile | null {
  try {
    const raw = JSON.parse(text) as Partial<ProjectFile>;
    if (raw.version !== 1 || !raw.meta || typeof raw.meta.id !== "string") return null;
    return {
      version: 1,
      meta: {
        id: raw.meta.id,
        name: typeof raw.meta.name === "string" && raw.meta.name.trim() ? raw.meta.name.trim().slice(0, 40) : raw.meta.id,
        group: typeof raw.meta.group === "string" ? raw.meta.group.slice(0, 40) : "",
        folder: typeof raw.meta.folder === "string" ? raw.meta.folder : null,
        profile: typeof raw.meta.profile === "string" ? raw.meta.profile : null,
        lastSeen: typeof raw.meta.lastSeen === "number" && Number.isFinite(raw.meta.lastSeen) ? raw.meta.lastSeen : 0,
      },
      config: normalize(raw.config),
    };
  } catch {
    return null;
  }
}

/** A project id is a short slug. Anything else is refused, so it cannot escape the projects folder. */
export function isSafeProjectId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
}

/** Minutes a project may stay unopened before the reminder appears. */
export const IDLE_OPTIONS_MIN = [15, 60, 240, 0] as const;

/** True when the project has been away long enough to remind the user. 0 means never. */
export function isIdle(meta: ProjectMeta, now: number, idleMinutes: number): boolean {
  if (idleMinutes === 0) return false;
  return now - meta.lastSeen >= idleMinutes * 60_000;
}
