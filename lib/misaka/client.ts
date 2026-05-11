import fetch, { type RequestInit } from "node-fetch";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

export type MisakaAccountRecord = typeof misakaAccounts.$inferSelect;
export type CreateInstanceParams = { region: string; plan: number; image?: string; count?: number; keys?: string[]; billingCycle?: string; coupon?: string | null; name?: string; issueInvoice?: boolean };
export type CreateInstanceResult = { order_id: number; invoice_id: number; stripe_url: string };
export type MisakaFetch = (url: string, init?: RequestInit) => Promise<{ status: number; ok: boolean; headers: { get(name: string): string | null }; json(): Promise<unknown>; text(): Promise<string> }>;

const API_BASE = "https://app.misaka.io";

export class MisakaClient {
  private forbiddenCount = 0;
  constructor(private readonly account: MisakaAccountRecord, private readonly fetcher: MisakaFetch = fetch as unknown as MisakaFetch) {}

  async login() {
    // TODO: reverse engineer the current misaka.io login endpoint and payload from an authenticated browser capture.
    const password = decrypt(this.account.passwordEncrypted);
    const session = JSON.stringify({ placeholder: true, email: this.account.email, passwordLength: password.length, createdAt: new Date().toISOString() });
    await db.update(misakaAccounts).set({ sessionCacheEncrypted: encrypt(session), lastLoginAt: new Date(), status: "active", rateLimitedUntil: null }).where(eq(misakaAccounts.id, this.account.id));
    return session;
  }

  async refreshSession() { return this.login(); }

  async getRegions() { return this.request("/api/mc2/regions"); }

  async getPlans(regionId: string) { return this.request(`/api/mc2/regions/${encodeURIComponent(regionId)}/plans`); }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    const timestamp = Date.now();
    const body = {
      region: params.region,
      plan: params.plan,
      image: params.image ?? "debian-12",
      count: params.count ?? 1,
      keys: params.keys ?? [],
      billing_cycle: params.billingCycle ?? "monthly",
      config: [{ name: params.name ?? `${params.region.toLowerCase()}-${params.plan}-${timestamp}` }],
      coupon: params.coupon ?? "",
      issue_invoice: params.issueInvoice ?? true,
    };
    // TODO: confirm whether /api/mc2/instances/ requires extra CSRF headers/cookies before real ordering is enabled.
    const result = await this.request("/api/mc2/instances/", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    return result as CreateInstanceResult;
  }

  private async request(path: string, init: RequestInit = {}) {
    if (this.account.status === "rate_limited" && this.account.rateLimitedUntil && this.account.rateLimitedUntil > new Date()) throw new Error("Misaka account is rate limited");
    const session = this.account.sessionCacheEncrypted ? decrypt(this.account.sessionCacheEncrypted) : await this.login();
    const response = await this.fetcher(`${API_BASE}${path}`, { ...init, headers: { cookie: session, ...(init.headers ?? {}) } });
    if (response.status === 403) await this.recordForbidden();
    if (!response.ok) throw new Error(`misaka.io request failed: ${response.status} ${await response.text()}`);
    return response.json();
  }

  private async recordForbidden() {
    this.forbiddenCount += 1;
    if (this.forbiddenCount >= 3) {
      await db.update(misakaAccounts).set({ status: "rate_limited", rateLimitedUntil: new Date(Date.now() + 30 * 60_000) }).where(and(eq(misakaAccounts.id, this.account.id), eq(misakaAccounts.status, "active")));
    }
  }
}
