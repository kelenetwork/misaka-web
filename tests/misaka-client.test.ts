import { beforeEach, describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "b".repeat(64);
process.env.DATABASE_URL = "file::memory:";

const { encrypt, decrypt } = await import("../lib/crypto");
const { db, sqlite } = await import("../lib/db/client");
const { misakaAccounts, users } = await import("../lib/db/schema");
import type { MisakaFetch } from "../lib/misaka/client";
const { MisakaClient } = await import("../lib/misaka/client");

/** 造一个 JWT 用于 jwtExp 解析；payload 只放 exp 字段。 */
function fakeJwt(expSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSec })).toString("base64url");
  return `${header}.${payload}.sig`;
}

type FetchCall = { url: string; method: string; headers: Record<string, string>; body: unknown };

function mockResponse(status: number, body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => text,
  };
}

async function seedAccount(opts: { sessionCache?: string | null } = {}) {
  const userId = "u-test";
  const accountId = "a-test";
  await db.insert(users).values({ id: userId, email: "u@example.com", username: "u", role: "user", passwordHash: "h" } as any);
  const row: any = {
    id: accountId,
    userId,
    label: "main",
    email: "alice@example.com",
    passwordEncrypted: encrypt("hunter2"),
    sessionCacheEncrypted: opts.sessionCache !== null && opts.sessionCache !== undefined ? opts.sessionCache : null,
    lastLoginAt: null,
    lastLoginIp: null,
    status: "active" as const,
    rateLimitedUntil: null,
    createdAt: new Date(),
  };
  await db.insert(misakaAccounts).values(row);
  const fetched = await db.query.misakaAccounts.findFirst({
    where: (await import("drizzle-orm")).eq(misakaAccounts.id, accountId),
  });
  return fetched!;
}


const setupSchema = () => {
  sqlite.exec(`
    DROP TABLE IF EXISTS misaka_accounts;
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      username text NOT NULL UNIQUE,
      name text NOT NULL DEFAULT '',
      email text NOT NULL UNIQUE,
      email_verified integer NOT NULL DEFAULT 0,
      image text,
      password_hash text NOT NULL DEFAULT '',
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
  `);
};


describe("MisakaClient", () => {
  beforeEach(async () => {
    setupSchema();
  });

  it("login() 调对正确的 endpoint 和 body，并把 access/refresh + exp 写入 session cache", async () => {
    const account = await seedAccount();
    const calls: FetchCall[] = [];
    const access = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    const refresh = fakeJwt(Math.floor(Date.now() / 1000) + 86400 * 3);
    const fetcher: MisakaFetch = async (url, init) => {
      calls.push({
        url: String(url),
        method: (init?.method as string) ?? "GET",
        headers: (init?.headers as Record<string, string>) ?? {},
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return mockResponse(200, { detail: "ok", user: { access_token: access, refresh_token: refresh } });
    };
    const client = new MisakaClient(account, fetcher);
    const got = await client.login();
    expect(got).toBe(access);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://app.misaka.io/api/session/login");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ username: "alice@example.com", password: "hunter2" });
    expect(calls[0].headers.Authorization).toBeUndefined();
    const refreshed = await db.query.misakaAccounts.findFirst({
      where: (await import("drizzle-orm")).eq(misakaAccounts.id, account.id),
    });
    const cached = JSON.parse(decrypt(refreshed!.sessionCacheEncrypted!));
    expect(cached.access_token).toBe(access);
    expect(cached.refresh_token).toBe(refresh);
    expect(cached.access_exp).toBeGreaterThan(0);
    expect(cached.refresh_exp).toBeGreaterThan(0);
  });

  it("createInstance() 用 session cache 里的 access，发出预期 body，并解析新格式响应（orders[] + invoice_id）", async () => {
    const accessOld = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    const refreshOld = fakeJwt(Math.floor(Date.now() / 1000) + 86400 * 3);
    const account = await seedAccount({
      sessionCache: encrypt(
        JSON.stringify({
          access_token: accessOld,
          refresh_token: refreshOld,
          access_exp: Math.floor(Date.now() / 1000) + 3600,
          refresh_exp: Math.floor(Date.now() / 1000) + 86400 * 3,
        }),
      ),
    });
    const calls: FetchCall[] = [];
    const fetcher: MisakaFetch = async (url, init) => {
      calls.push({
        url: String(url),
        method: (init?.method as string) ?? "GET",
        headers: (init?.headers as Record<string, string>) ?? {},
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return mockResponse(200, { orders: [37906], invoice_id: 121933 });
    };
    const client = new MisakaClient(account, fetcher);
    const result = await client.createInstance({
      region: "HKG12",
      plan: 574,
      name: "hkg12-s3n-2c3g-1",
    });
    expect(result).toEqual({
      orderIds: [37906],
      invoiceId: 121933,
      invoiceUrl: "https://app.misaka.io/iaas/billing/invoices/121933",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://app.misaka.io/api/mc2/instances/");
    expect(calls[0].headers.Authorization).toBe(`Bearer ${accessOld}`);
    expect(calls[0].headers["X-Misaka-User-TZ"]).toBe("Asia/Shanghai");
    expect(calls[0].body).toMatchObject({
      region: "HKG12",
      plan: 574,
      image: "debian-12",
      count: 1,
      keys: [],
      billing_cycle: "monthly",
      config: [{ name: "hkg12-s3n-2c3g-1" }],
      coupon: "",
      issue_invoice: true,
    });
  });

  it("access 快过期时自动 refresh 再请求", async () => {
    const expiringAccess = fakeJwt(Math.floor(Date.now() / 1000) + 30); // < margin 60s
    const validRefresh = fakeJwt(Math.floor(Date.now() / 1000) + 86400 * 3);
    const newAccess = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    const account = await seedAccount({
      sessionCache: encrypt(
        JSON.stringify({
          access_token: expiringAccess,
          refresh_token: validRefresh,
          access_exp: Math.floor(Date.now() / 1000) + 30,
          refresh_exp: Math.floor(Date.now() / 1000) + 86400 * 3,
        }),
      ),
    });
    const calls: FetchCall[] = [];
    const fetcher: MisakaFetch = async (url, init) => {
      const u = String(url);
      calls.push({ url: u, method: (init?.method as string) ?? "GET", headers: (init?.headers as any) ?? {}, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (u.endsWith("/session/refresh")) {
        return mockResponse(200, { access: newAccess });
      }
      if (u.endsWith("/session/info")) {
        return mockResponse(200, { id: 100632, email: "alice@example.com" });
      }
      return mockResponse(404, { detail: "Not found" });
    };
    const client = new MisakaClient(account, fetcher);
    const info = (await client.getSessionInfo()) as { id: number };
    expect(info.id).toBe(100632);
    // 第一次先 refresh，再请求 session/info（共 2 个 call）
    expect(calls.map((c) => c.url)).toEqual([
      "https://app.misaka.io/api/session/refresh",
      "https://app.misaka.io/api/session/info",
    ]);
    expect(calls[1].headers.Authorization).toBe(`Bearer ${newAccess}`);
  });

  it("401 token_not_valid 触发一次 refresh + 重试", async () => {
    const access = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    const refresh = fakeJwt(Math.floor(Date.now() / 1000) + 86400 * 3);
    const newAccess = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    const account = await seedAccount({
      sessionCache: encrypt(
        JSON.stringify({
          access_token: access,
          refresh_token: refresh,
          access_exp: Math.floor(Date.now() / 1000) + 3600,
          refresh_exp: Math.floor(Date.now() / 1000) + 86400 * 3,
        }),
      ),
    });
    let instCalls = 0;
    const fetcher: MisakaFetch = async (url, init) => {
      const u = String(url);
      if (u.endsWith("/mc2/instances/")) {
        instCalls += 1;
        if (instCalls === 1) return mockResponse(401, { detail: "expired", code: "token_not_valid" });
        return mockResponse(200, { count: 0, results: [] });
      }
      if (u.endsWith("/session/refresh")) return mockResponse(200, { access: newAccess });
      return mockResponse(404, { detail: "Not found" });
    };
    const client = new MisakaClient(account, fetcher);
    const result = (await client.listInstances()) as { count: number };
    expect(result.count).toBe(0);
    expect(instCalls).toBe(2);
  });
});
