// Reads a connection URL such as postgres://user:pass@host:5432/db into form fields.
// Returns null when the text is not a URL we understand, so the paste goes through unchanged.

export interface ParsedConnection {
  dialect: "postgres" | "cratedb";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const SCHEMES: Record<string, "postgres" | "cratedb"> = {
  postgres: "postgres",
  postgresql: "postgres",
  crate: "cratedb",
  cratedb: "cratedb",
};

const DEFAULT_PORT: Record<"postgres" | "cratedb", number> = { postgres: 5432, cratedb: 5433 };

export function parseConnectionUrl(text: string): ParsedConnection | null {
  const trimmed = text.trim();
  if (!/^[a-z]+:\/\//i.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const dialect = SCHEMES[url.protocol.replace(/:$/, "").toLowerCase()];
  if (!dialect || !url.hostname) return null;

  return {
    dialect,
    host: url.hostname,
    port: url.port ? Number(url.port) : DEFAULT_PORT[dialect],
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}
