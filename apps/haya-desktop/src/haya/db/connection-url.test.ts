import { describe, expect, test } from "bun:test";
import { parseConnectionUrl } from "./connection-url";

describe("parseConnectionUrl", () => {
  test("reads a full PostgreSQL URL", () => {
    expect(parseConnectionUrl("postgres://alice:secret@db.local:6543/shop")).toEqual({
      dialect: "postgres",
      host: "db.local",
      port: 6543,
      user: "alice",
      password: "secret",
      database: "shop",
    });
  });

  test("uses the default port when none is given", () => {
    const parsed = parseConnectionUrl("postgresql://alice@localhost/shop");
    expect(parsed?.port).toBe(5432);
    expect(parsed?.password).toBe("");
  });

  test("maps crate URLs to CrateDB with its default port", () => {
    expect(parseConnectionUrl("crate://crate@127.0.0.1/doc")).toMatchObject({ dialect: "cratedb", port: 5433, database: "doc" });
  });

  test("decodes percent-encoded user and password", () => {
    expect(parseConnectionUrl("postgres://me:p%40ss%3Aword@host/db")?.password).toBe("p@ss:word");
  });

  test("returns null for text that is not a connection URL", () => {
    expect(parseConnectionUrl("127.0.0.1")).toBeNull();
    expect(parseConnectionUrl("https://example.com/path")).toBeNull();
    expect(parseConnectionUrl("postgres://")).toBeNull();
  });
});
