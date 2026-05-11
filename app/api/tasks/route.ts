import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts, tasks } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { createTaskSchema } from "@/lib/schemas";
import { json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { user } = guard;
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const userId = user.role === "admin" && requestedUserId ? requestedUserId : user.id;
  return json(await db.query.tasks.findMany({ where: eq(tasks.userId, userId) }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { user } = guard;
  const body = createTaskSchema.parse(await req.json());
  const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, body.accountId) });
  if (!account || account.userId !== user.id) return json({ error: "account_not_found" }, 403);
  const [row] = await db.insert(tasks).values({ ...body, userId: user.id }).returning();
  return json(row, 201);
}
