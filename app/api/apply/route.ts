import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIp, json } from "@/lib/http";

const schema = z.object({ username: z.string().min(3), email: z.email(), reason: z.string().min(5) });
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const fiveMin = await checkRateLimit(`apply:${ip}:5m`, 1, 5 * 60_000);
  if (!fiveMin.ok) return json({ error: "rate_limited", retryAfter: fiveMin.retryAfter }, 429);
  const day = await checkRateLimit(`apply:${ip}:24h`, 5, 24 * 60 * 60_000);
  if (!day.ok) return json({ error: "rate_limited", retryAfter: day.retryAfter }, 429);
  const body = schema.parse(await req.json());
  const [row] = await db.insert(applications).values({ ...body, ip }).returning();
  return json(row, 201);
}
