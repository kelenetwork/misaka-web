import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitResult = { ok: true; retryAfter: 0 } | { ok: false; retryAfter: number };

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const existing = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key) });
  if (!existing || existing.expiresAt <= now) {
    await db.insert(rateLimits).values({ key, count: 1, expiresAt: new Date(now.getTime() + windowMs) }).onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, expiresAt: new Date(now.getTime() + windowMs) } });
    return { ok: true, retryAfter: 0 };
  }
  if (existing.count >= limit) return { ok: false, retryAfter: Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000) };
  await db.update(rateLimits).set({ count: existing.count + 1 }).where(eq(rateLimits.key, key));
  return { ok: true, retryAfter: 0 };
}

export async function cleanupExpiredRateLimits() {
  await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
}
