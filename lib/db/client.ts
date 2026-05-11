import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL ?? "file:./data/misaka.db";
const dbPath = rawUrl.replace(/^file:/, "");
if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

// Auto-apply pending migrations on startup (idempotent, safe for repeated boots).
// Skip in test env where migrations are managed per-test.
if (process.env.NODE_ENV !== "test" && !process.env.SKIP_AUTO_MIGRATE) {
  try {
    const migrationsFolder = process.env.MIGRATIONS_DIR
      ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
    migrate(db, { migrationsFolder });
  } catch (err) {
    console.error("auto-migrate failed:", err);
    throw err;
  }
}
