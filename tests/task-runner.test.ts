import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL = "file::memory:";
process.env.BETTER_AUTH_SECRET = "test-secret";

const createInstanceMock = vi.hoisted(() => vi.fn());
const notifyOrderFailedMock = vi.hoisted(() => vi.fn());
const notifyOrderSuccessMock = vi.hoisted(() => vi.fn());
const notifyTaskAutoPausedMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/misaka/client", () => ({
  MisakaClient: class {
    createInstance = createInstanceMock;
  },
}));

vi.mock("@/lib/telegram/bot", () => ({
  notifyOrderFailed: notifyOrderFailedMock,
  notifyOrderSuccess: notifyOrderSuccessMock,
  notifyTaskAutoPaused: notifyTaskAutoPausedMock,
}));

const { sqlite, db } = await import("@/lib/db/client");
const { auditLogs, misakaAccounts, orders, tasks, users } = await import("@/lib/db/schema");
const { runTask } = await import("@/lib/workers/task-runner");

const plan = {
  region: "HKG12",
  planId: 574,
  planSlug: "starter",
  planName: "Starter",
  priceMonthly: 9,
  vcores: 1,
  memoryMb: 1024,
  diskMb: 10240,
  transferMb: 1024,
  available: true,
};

function resetDb() {
  sqlite.exec(`
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS misaka_accounts;
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

async function seedTask(overrides: Partial<typeof tasks.$inferInsert> = {}) {
  await db.insert(users).values({ id: "user-1", username: "user", email: "user@example.com" });
  await db.insert(misakaAccounts).values({ id: "account-1", userId: "user-1", label: "main", email: "misaka@example.com", passwordEncrypted: "encrypted" });
  await db.insert(tasks).values({ id: "task-1", userId: "user-1", accountId: "account-1", name: "task", region: "HKG12", planId: 574, maxPrice: 9, targetCount: 3, ...overrides });
}

beforeEach(async () => {
  resetDb();
  createInstanceMock.mockReset();
  notifyOrderFailedMock.mockReset();
  notifyOrderSuccessMock.mockReset();
  notifyTaskAutoPausedMock.mockReset();
  await seedTask();
});

describe("runTask retry state", () => {
  it("increments failureCount and sets nextRetryAt on failure", async () => {
    createInstanceMock.mockRejectedValueOnce(new Error("boom"));

    await runTask("task-1", plan);

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, "task-1") });
    const failedOrder = await db.query.orders.findFirst({ where: eq(orders.taskId, "task-1") });
    expect(task?.failureCount).toBe(1);
    expect(task?.lastFailureAt).toBeInstanceOf(Date);
    expect(task?.nextRetryAt).toBeInstanceOf(Date);
    expect(task?.enabled).toBe(true);
    expect(failedOrder?.status).toBe("failed");
    expect(notifyOrderFailedMock).toHaveBeenCalledWith("user-1", "task", "boom");
  });

  it("auto disables task and logs audit after five consecutive failures", async () => {
    createInstanceMock.mockRejectedValue(new Error("still broken"));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await db.update(tasks).set({ nextRetryAt: null }).where(eq(tasks.id, "task-1"));
      await runTask("task-1", plan);
    }

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, "task-1") });
    const autoPauseLog = await db.query.auditLogs.findFirst({ where: eq(auditLogs.action, "task.auto_paused") });
    expect(task?.failureCount).toBe(5);
    expect(task?.enabled).toBe(false);
    expect(task?.nextRetryAt).toBeNull();
    expect(autoPauseLog?.target).toBe("task-1");
    expect(notifyTaskAutoPausedMock).toHaveBeenCalledWith("user-1", "task", 5, "still broken");
  });

  it("resets failure state after a successful order", async () => {
    await db.update(tasks).set({ failureCount: 2, lastFailureAt: new Date(Date.now() - 120_000), nextRetryAt: null }).where(eq(tasks.id, "task-1"));
    createInstanceMock.mockResolvedValueOnce({ orderIds: [123], invoiceId: 456, invoiceUrl: "https://pay.example/456" });

    await runTask("task-1", plan);

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, "task-1") });
    const order = await db.query.orders.findFirst({ where: eq(orders.misakaOrderId, 123) });
    expect(task?.failureCount).toBe(0);
    expect(task?.lastFailureAt).toBeNull();
    expect(task?.nextRetryAt).toBeNull();
    expect(order?.status).toBe("created");
    expect(notifyOrderSuccessMock).toHaveBeenCalled();
  });

  it("skips execution while nextRetryAt is in the future", async () => {
    await db.update(tasks).set({ nextRetryAt: new Date(Date.now() + 60_000) }).where(eq(tasks.id, "task-1"));

    await runTask("task-1", plan);

    expect(createInstanceMock).not.toHaveBeenCalled();
    expect(await db.select().from(orders)).toHaveLength(0);
  });
});


describe("runTask concurrency / race conditions", () => {
  it("two concurrent runTask calls on the same task with targetCount=3 should not exceed 3 orders", async () => {
    // 把 task targetCount 设 3，并发跑 5 次 runTask
    // 每次 createInstance 成功返回不同 orderId
    await db.update(tasks).set({ targetCount: 3 }).where(eq(tasks.id, "task-1"));

    let nextOrderId = 1000;
    createInstanceMock.mockImplementation(async () => {
      // 模拟 misaka.io 真实 API 50ms 延迟，让事务竞态有机会暴露
      await new Promise((r) => setTimeout(r, 50));
      const orderId = nextOrderId++;
      return { orderIds: [orderId], invoiceId: orderId * 10, invoiceUrl: `https://pay.example/${orderId}` };
    });

    await Promise.all(Array.from({ length: 5 }, () => runTask("task-1", plan)));

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, "task-1") });
    const created = await db.query.orders.findMany({ where: eq(orders.status, "created") });
    // task-runner 内部用 sqlite.transaction + currentCount 检查保证幂等
    // 但 createInstance 已经被调多次（misaka 已经收到下单），所以 misaka 那边可能产生多余订单
    // 我们这里只断言 DB 一致性：currentCount 不超过 targetCount，且 orders 表 created 行数 == currentCount
    expect(task?.currentCount).toBeLessThanOrEqual(3);
    expect(created.length).toBe(task?.currentCount);
    // task 应该已经 disabled（stopAfterTarget = true，达到 targetCount）
    if (task?.currentCount === 3) {
      expect(task?.enabled).toBe(false);
    }
  });

  it("task with targetCount=1 should not create duplicate order under high concurrency", async () => {
    await db.update(tasks).set({ targetCount: 1 }).where(eq(tasks.id, "task-1"));

    createInstanceMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return { orderIds: [9999], invoiceId: 88888, invoiceUrl: "https://pay.example/x" };
    });

    // 10 个并发 runTask 模拟极端竞态
    await Promise.all(Array.from({ length: 10 }, () => runTask("task-1", plan)));

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, "task-1") });
    const created = await db.query.orders.findMany({ where: eq(orders.status, "created") });
    // DB 层最多 1 单
    expect(task?.currentCount).toBe(1);
    expect(created.length).toBe(1);
    expect(task?.enabled).toBe(false);
  });
});
