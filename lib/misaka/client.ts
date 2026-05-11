import fetch, { type RequestInit } from "node-fetch";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

export type MisakaAccountRecord = typeof misakaAccounts.$inferSelect;

export type CreateInstanceParams = {
  region: string;
  plan: number;
  image?: string;
  count?: number;
  keys?: number[] | string[];
  billingCycle?: string;
  coupon?: string | null;
  name?: string;
  issueInvoice?: boolean;
};

export type CreateInstanceResult = {
  /** misaka 返回的订单 id 数组（一笔下单可能对应多台 instance/多 order） */
  orderIds: number[];
  /** 单张发票 id（一次下单一张发票） */
  invoiceId: number;
  /** 拼出来的发票/付款链接，方便客户付款 */
  invoiceUrl: string;
};

export type MisakaFetch = (url: string, init?: RequestInit) => Promise<{
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

type CachedSession = {
  access_token: string;
  refresh_token: string;
  /** UNIX seconds */
  access_exp: number;
  /** UNIX seconds */
  refresh_exp: number;
};

const API_BASE = "https://app.misaka.io/api";
const INVOICE_URL_BASE = "https://app.misaka.io/iaas/billing/invoices";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
/** 还有多少秒过期就主动 refresh */
const ACCESS_TOKEN_REFRESH_MARGIN_SEC = 60;

/** 解 JWT payload 拿 exp（秒）。失败返 0。 */
function jwtExp(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return 0;
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const data = JSON.parse(payload) as { exp?: number };
    return typeof data.exp === "number" ? data.exp : 0;
  } catch {
    return 0;
  }
}

/** 哪些路径不发 Authorization（登录/刷新/登出本身不能依赖已有 token） */
function shouldSendAuth(path: string): boolean {
  const p = path.replace(/^\/+/, "");
  if (p.startsWith("session/login")) return false;
  if (p.startsWith("session/refresh")) return false;
  if (p.startsWith("session/logout")) return false;
  return true;
}

export class MisakaClient {
  private forbiddenCount = 0;

  constructor(
    private readonly account: MisakaAccountRecord | null,
    private readonly fetcher: MisakaFetch = fetch as unknown as MisakaFetch,
  ) {}

  /** 真实登录 misaka.io，存 session_cache。返回 access token。 */
  async login(): Promise<string> {
    if (!this.account) throw new Error("Misaka account is required");
    const password = decrypt(this.account.passwordEncrypted);
    const res = await this.rawFetch("session/login", {
      method: "POST",
      body: JSON.stringify({ username: this.account.email, password }),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`misaka.io login failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const payload = (await res.json()) as {
      user?: { access_token?: string; refresh_token?: string };
    };
    const access = payload.user?.access_token;
    const refresh = payload.user?.refresh_token;
    if (!access || !refresh) throw new Error("misaka.io login response missing tokens");

    const session: CachedSession = {
      access_token: access,
      refresh_token: refresh,
      access_exp: jwtExp(access),
      refresh_exp: jwtExp(refresh),
    };
    await db
      .update(misakaAccounts)
      .set({
        sessionCacheEncrypted: encrypt(JSON.stringify(session)),
        lastLoginAt: new Date(),
        status: "active",
        rateLimitedUntil: null,
      })
      .where(eq(misakaAccounts.id, this.account.id));
    this.forbiddenCount = 0;
    return access;
  }

  /** 用 refresh_token 换新 access；失败 fallback 到 login()。 */
  async refreshSession(): Promise<string> {
    if (!this.account) throw new Error("Misaka account is required");
    const cached = this.readCachedSession();
    if (!cached?.refresh_token) return this.login();
    const nowSec = Math.floor(Date.now() / 1000);
    if (cached.refresh_exp && cached.refresh_exp - nowSec < ACCESS_TOKEN_REFRESH_MARGIN_SEC) {
      return this.login();
    }

    const res = await this.rawFetch("session/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh: cached.refresh_token }),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) return this.login();
    const payload = (await res.json()) as { access?: string };
    if (!payload.access) return this.login();

    const next: CachedSession = {
      ...cached,
      access_token: payload.access,
      access_exp: jwtExp(payload.access),
    };
    await db
      .update(misakaAccounts)
      .set({ sessionCacheEncrypted: encrypt(JSON.stringify(next)) })
      .where(eq(misakaAccounts.id, this.account.id));
    return payload.access;
  }

  async getRegions() {
    return this.request("mc2/regions");
  }

  async getPlans(regionId: string) {
    return this.request(`mc2/regions/${encodeURIComponent(regionId)}/plans`);
  }

  async getSessionInfo() {
    return this.request("session/info");
  }

  async listInstances() {
    return this.request("mc2/instances/");
  }

  async listInvoices() {
    return this.request("billing/invoices/");
  }

  async getInvoice(id: number | string) {
    return this.request(`billing/invoices/${encodeURIComponent(String(id))}/`);
  }

  async getBalance() {
    return this.request("billing/balance");
  }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    const count = params.count ?? 1;
    const timestamp = Date.now();
    const baseName = params.name ?? `${params.region.toLowerCase()}-${params.plan}-${timestamp}`;
    const config = Array.from({ length: count }, (_, i) =>
      count === 1 ? { name: baseName } : { name: `${baseName}-${i + 1}` },
    );
    const body = {
      region: params.region,
      plan: params.plan,
      image: params.image ?? "debian-12",
      count,
      keys: params.keys ?? [],
      billing_cycle: params.billingCycle ?? "monthly",
      config,
      coupon: params.coupon ?? "",
      issue_invoice: params.issueInvoice ?? true,
    };

    const raw = (await this.request("mc2/instances/", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    })) as { orders?: number[]; invoice_id?: number };

    if (!Array.isArray(raw.orders) || raw.orders.length === 0 || typeof raw.invoice_id !== "number") {
      throw new Error(`misaka.io createInstance unexpected response: ${JSON.stringify(raw).slice(0, 200)}`);
    }
    return {
      orderIds: raw.orders,
      invoiceId: raw.invoice_id,
      invoiceUrl: `${INVOICE_URL_BASE}/${raw.invoice_id}`,
    };
  }

  // ---- internals ----

  private readCachedSession(): CachedSession | null {
    if (!this.account?.sessionCacheEncrypted) return null;
    try {
      const decoded = decrypt(this.account.sessionCacheEncrypted);
      const parsed = JSON.parse(decoded) as Partial<CachedSession>;
      if (typeof parsed.access_token === "string" && typeof parsed.refresh_token === "string") {
        return {
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
          access_exp: typeof parsed.access_exp === "number" ? parsed.access_exp : jwtExp(parsed.access_token),
          refresh_exp:
            typeof parsed.refresh_exp === "number" ? parsed.refresh_exp : jwtExp(parsed.refresh_token),
        };
      }
    } catch {
      // 缓存损坏，按未登录处理
    }
    return null;
  }

  private async getAccessToken(): Promise<string> {
    const cached = this.readCachedSession();
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      cached &&
      cached.access_token &&
      cached.access_exp &&
      cached.access_exp - nowSec > ACCESS_TOKEN_REFRESH_MARGIN_SEC
    ) {
      return cached.access_token;
    }
    if (cached?.refresh_token && cached.refresh_exp && cached.refresh_exp - nowSec > ACCESS_TOKEN_REFRESH_MARGIN_SEC) {
      try {
        return await this.refreshSession();
      } catch {
        // refresh 报错 fallback 到 login
      }
    }
    return this.login();
  }

  private buildHeaders(path: string, extra?: Record<string, string>, accessToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "X-Misaka-User-Time": new Date().toISOString(),
      "X-Misaka-User-TZ": "Asia/Shanghai",
      ...(extra ?? {}),
    };
    if (shouldSendAuth(path) && accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return headers;
  }

  /** 直接发原始请求，不做 token 处理。给 login/refresh 用。 */
  private async rawFetch(path: string, init: RequestInit = {}) {
    const headers = {
      ...this.buildHeaders(path, init.headers as Record<string, string> | undefined),
    };
    return this.fetcher(`${API_BASE}/${path.replace(/^\/+/, "")}`, { ...init, headers });
  }

  private async request(path: string, init: RequestInit = {}, opts: { skipTokenRefresh?: boolean } = {}): Promise<unknown> {
    if (!this.account) {
      // 公开端点 / 探测时无账号——直接打且不带 Authorization
      const res = await this.fetcher(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
        ...init,
        headers: this.buildHeaders(path, init.headers as Record<string, string> | undefined),
      });
      if (!res.ok) throw new Error(`misaka.io ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
      return res.json();
    }

    if (
      this.account.status === "rate_limited" &&
      this.account.rateLimitedUntil &&
      this.account.rateLimitedUntil > new Date()
    ) {
      throw new Error("Misaka account is rate limited");
    }

    const accessToken = shouldSendAuth(path) ? await this.getAccessToken() : undefined;
    const url = `${API_BASE}/${path.replace(/^\/+/, "")}`;
    const headers = this.buildHeaders(path, init.headers as Record<string, string> | undefined, accessToken);
    const res = await this.fetcher(url, { ...init, headers });

    if (res.status === 401 || res.status === 403) {
      // 尝试解析 detail/code
      const text = await res.text();
      let parsed: { detail?: string; code?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {}
      const isTokenError =
        parsed.code === "token_not_valid" ||
        (parsed.detail ?? "").toLowerCase().includes("token") ||
        (parsed.detail ?? "").toLowerCase().includes("authentication credentials");
      if (isTokenError && !opts.skipTokenRefresh && shouldSendAuth(path)) {
        // refresh 后重试一次
        await this.refreshSession();
        return this.request(path, init, { skipTokenRefresh: true });
      }
      if (res.status === 403) await this.recordForbidden();
      throw new Error(`misaka.io ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`misaka.io ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  private async recordForbidden() {
    if (!this.account) return;
    this.forbiddenCount += 1;
    if (this.forbiddenCount >= 3) {
      await db
        .update(misakaAccounts)
        .set({
          status: "rate_limited",
          rateLimitedUntil: new Date(Date.now() + 30 * 60_000),
        })
        .where(and(eq(misakaAccounts.id, this.account.id), eq(misakaAccounts.status, "active")));
    }
  }
}
