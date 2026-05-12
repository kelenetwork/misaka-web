import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL = "file::memory:";
process.env.BETTER_AUTH_SECRET = "test-secret";

const { sqlite, db } = await import("@/lib/db/client");
const { auditLogs, users } = await import("@/lib/db/schema");
const { cleanupOldAuditLogs } = await import("@/lib/audit-cleanup");

function resetDb() {
  sqlite.exec(`
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      username text UNIQUE,
      name text NOT NULL DEFAULT '',
      email text NOT NULL UNIQUE,
      email_verified integer NOT NULL DEFAULT 0,
      image text,
      password_hash text,
      role text NOT NULL DEFAULT 'user',
      status text NOT NULL DEFAULT 'active',
      telegram_user_id text UNIQUE,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE audit_logs (
      id text PRIMARY KEY,
      actor_id text REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      target text NOT NULL,
      details text,
      ip text,
      created_at integer NOT NULL DEFAULT (unixepoch())
    );
  `);
}

beforeEach(async () => {
  resetDb();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-12T00:00:00.000Z"));
  await db.insert(users).values({ id: "user-1", username: "user", email: "user@example.com" });
});

describe("cleanupOldAuditLogs", () => {
  it("deletes only audit logs older than retention days", async () => {
    await db.insert(auditLogs).values([
      { id: "old-1", actorId: "user-1", action: "old", target: "a", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "old-2", actorId: "user-1", action: "old", target: "b", createdAt: new Date("2026-02-10T23:59:59.000Z") },
      { id: "new-1", actorId: "user-1", action: "new", target: "c", createdAt: new Date("2026-02-11T00:00:00.000Z") },
      { id: "new-2", actorId: "user-1", action: "new", target: "d", createdAt: new Date("2026-05-01T00:00:00.000Z") },
    ]);

    const result = await cleanupOldAuditLogs(90);

    expect(result.deleted).toBe(2);
    expect(result.kept).toBe(2);
    expect(await db.query.auditLogs.findFirst({ where: eq(auditLogs.id, "old-1") })).toBeUndefined();
    expect(await db.query.auditLogs.findFirst({ where: eq(auditLogs.id, "old-2") })).toBeUndefined();
    expect(await db.query.auditLogs.findFirst({ where: eq(auditLogs.id, "new-1") })).toBeTruthy();
    expect(await db.query.auditLogs.findFirst({ where: eq(auditLogs.id, "new-2") })).toBeTruthy();
  });
});
