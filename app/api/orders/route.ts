import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const userId = guard.user.role === "admin" && requestedUserId ? requestedUserId : guard.user.id;
  return json(await db.query.orders.findMany({ where: eq(orders.userId, userId) }));
}
