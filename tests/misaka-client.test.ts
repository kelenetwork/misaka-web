import { describe, expect, it } from "vitest";
process.env.ENCRYPTION_KEY = "b".repeat(64);
process.env.DATABASE_URL = "file::memory:";
const { encrypt } = await import("../lib/crypto");
import type { MisakaFetch } from "../lib/misaka/client";
const { MisakaClient } = await import("../lib/misaka/client");

describe("MisakaClient", () => {
  it("sends expected create instance body", async () => {
    let captured: unknown;
    const fetcher: MisakaFetch = async (_url, init) => { captured = JSON.parse(String(init?.body)); return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ order_id: 26517, invoice_id: 108264, stripe_url: "https://checkout.stripe.com/test" }), text: async () => "" }; };
    const client = new MisakaClient({ id: "a", userId: "u", label: "main", email: "a@example.com", passwordEncrypted: encrypt("pw"), sessionCacheEncrypted: encrypt("session=ok"), lastLoginAt: null, lastLoginIp: null, status: "active", rateLimitedUntil: null, createdAt: new Date() }, fetcher);
    await client.createInstance({ region: "HKG12", plan: 574, name: "hkg12-s3n-2c3g-1" });
    expect(captured).toMatchObject({ region: "HKG12", plan: 574, image: "debian-12", count: 1, keys: [], billing_cycle: "monthly", config: [{ name: "hkg12-s3n-2c3g-1" }], coupon: "", issue_invoice: true });
  });
});
