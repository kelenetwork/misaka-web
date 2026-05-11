import { beforeEach, describe, expect, it } from "vitest";
process.env.DATABASE_URL = "file::memory:";
const { sqlite } = await import("../lib/db/client");
const { checkRateLimit } = await import("../lib/rate-limit");

beforeEach(() => { sqlite.exec("DROP TABLE IF EXISTS rate_limits; CREATE TABLE rate_limits (key text PRIMARY KEY NOT NULL, count integer NOT NULL, expires_at integer NOT NULL);"); });
describe("rate limit", () => { it("allows within limit and blocks after limit", async () => { expect((await checkRateLimit("k", 2, 60_000)).ok).toBe(true); expect((await checkRateLimit("k", 2, 60_000)).ok).toBe(true); const third = await checkRateLimit("k", 2, 60_000); expect(third.ok).toBe(false); expect(third.retryAfter).toBeGreaterThan(0); }); });
