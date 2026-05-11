import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.DATABASE_URL = "file::memory:";
process.env.BETTER_AUTH_SECRET = "test-secret";

const sessionState = vi.hoisted(() => ({ current: null as null | { user: { id: string; role: "user" | "admin" } } }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn(async () => sessionState.current) } } }));

const { sqlite, db } = await import("@/lib/db/client");
const { users, misakaAccounts, orders, tasks } = await import("@/lib/db/schema");
const tasksRoute = await import("../app/api/tasks/route");
const taskRoute = await import("../app/api/tasks/[id]/route");
const adminUsersRoute = await import("../app/api/admin/users/route");

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(async () => {
  sessionState.current = null;
  sqlite.exec(`
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS misaka_accounts;
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      username text NOT NULL UNIQUE,
      name text NOT NULL DEFAULT '',
      email text NOT NULL UNIQUE,
      email_verified integer NOT NULL DEFAULT 0,
      image text,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      status text NOT NULL DEFAULT 'active',
      telegram_user_id text UNIQUE,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE misaka_accounts (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label text NOT NULL,
      email text NOT NULL,
      password_encrypted text NOT NULL,
      session_cache_encrypted text,
      last_login_at integer,
      last_login_ip text,
      status text NOT NULL DEFAULT 'active',
      rate_limited_until integer,
      created_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id text NOT NULL REFERENCES misaka_accounts(id) ON DELETE CASCADE,
      name text NOT NULL,
      region text NOT NULL,
      plan_id integer NOT NULL,
      max_price real NOT NULL,
      target_count integer NOT NULL,
      image text NOT NULL DEFAULT 'debian-12',
      billing_cycle text NOT NULL DEFAULT 'monthly',
      coupon text,
      ssh_keys text,
      enabled integer NOT NULL DEFAULT 1,
      current_count integer NOT NULL DEFAULT 0,
      stop_after_target integer NOT NULL DEFAULT 1,
      failure_count integer NOT NULL DEFAULT 0,
      last_failure_at integer,
      next_retry_at integer,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      updated_at integer NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE orders (
      id text PRIMARY KEY,
      task_id text REFERENCES tasks(id) ON DELETE SET NULL,
      user_id text NOT NULL REFERENCES users(id),
      account_id text NOT NULL REFERENCES misaka_accounts(id),
      region text NOT NULL,
      plan_id integer NOT NULL,
      plan_slug text NOT NULL,
      region_name text NOT NULL,
      price real NOT NULL,
      misaka_order_id integer UNIQUE,
      invoice_id integer,
      stripe_link text,
      status text NOT NULL DEFAULT 'pending',
      error_message text,
      created_at integer NOT NULL DEFAULT (unixepoch()),
      paid_at integer
    );
  `);
  await db.insert(users).values([
    { id: "owner", username: "owner", email: "owner@example.com", passwordHash: "hash", role: "user" },
    { id: "other", username: "other", email: "other@example.com", passwordHash: "hash", role: "user" },
    { id: "admin", username: "admin", email: "admin@example.com", passwordHash: "hash", role: "admin" },
  ]);
  await db.insert(misakaAccounts).values([
    { id: "account-owner", userId: "owner", label: "owner", email: "owner@misaka.test", passwordEncrypted: "encrypted" },
    { id: "account-other", userId: "other", label: "other", email: "other@misaka.test", passwordEncrypted: "encrypted" },
  ]);
  await db.insert(tasks).values({ id: "task-owner", userId: "owner", accountId: "account-owner", name: "task", region: "HKG12", planId: 574, maxPrice: 9, targetCount: 1 });

});

describe("API auth guards", () => {
  it("returns 401 for unauthenticated /api/tasks", async () => {
    const response = await tasksRoute.GET(request("/api/tasks"));
    expect(response.status).toBe(401);
  });

  it("returns 403 when a non-owner reads another user's task", async () => {
    sessionState.current = { user: { id: "other", role: "user" } };
    const response = await taskRoute.GET(request("/api/tasks/task-owner"), { params: Promise.resolve({ id: "task-owner" }) });
    expect(response.status).toBe(403);
  });

  it("returns 200 when an owner reads their task", async () => {
    sessionState.current = { user: { id: "owner", role: "user" } };
    const response = await taskRoute.GET(request("/api/tasks/task-owner"), { params: Promise.resolve({ id: "task-owner" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "task-owner", userId: "owner" });
  });

  it("returns 403 for non-admin /api/admin/users", async () => {
    sessionState.current = { user: { id: "owner", role: "user" } };
    const response = await adminUsersRoute.GET(request("/api/admin/users"));
    expect(response.status).toBe(403);
  });

  it("returns 200 for admin /api/admin/users", async () => {
    sessionState.current = { user: { id: "admin", role: "admin" } };
    const response = await adminUsersRoute.GET(request("/api/admin/users"));
    expect(response.status).toBe(200);
  });

  it("deletes a task and its order history for the owner", async () => {
    sessionState.current = { user: { id: "owner", role: "user" } };
    await db.insert(orders).values({ id: "order-1", taskId: "task-owner", userId: "owner", accountId: "account-owner", region: "HKG12", planId: 574, planSlug: "starter", regionName: "Hong Kong", price: 9, status: "created" });

    const response = await taskRoute.DELETE(request("/api/tasks/task-owner"), { params: Promise.resolve({ id: "task-owner" }) });

    expect(response.status).toBe(200);
    expect(await db.select().from(tasks)).toHaveLength(0);
    expect(await db.select().from(orders)).toHaveLength(0);
  });
});
