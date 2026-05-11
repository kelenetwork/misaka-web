import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL ?? "file:./data/misaka.db";
const dbPath = rawUrl.replace(/^file:/, "");
if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
