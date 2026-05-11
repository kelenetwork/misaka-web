import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts, tasks } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { patchTaskSchema } from "@/lib/schemas";
import { json } from "@/lib/http";

async function getOwnedTask(id: string, user: { id: string; role: "user" | "admin" }) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) return { ok: false as const, response: json({ error: "not_found" }, 404) };
  if (task.userId !== user.id && user.role !== "admin") return { ok: false as const, response: json({ error: "forbidden" }, 403) };
  return { ok: true as const, task };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const owned = await getOwnedTask(id, guard.user); if (!owned.ok) return owned.response;
  return json(owned.task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const owned = await getOwnedTask(id, guard.user); if (!owned.ok) return owned.response;
  const body = patchTaskSchema.parse(await req.json());
  if (body.accountId) {
    const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, body.accountId) });
    if (!account || account.userId !== owned.task.userId) return json({ error: "account_not_found" }, 403);
  }
  const [row] = await db.update(tasks).set({ ...body, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
  return json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const owned = await getOwnedTask(id, guard.user); if (!owned.ok) return owned.response;
  await db.delete(tasks).where(eq(tasks.id, id));
  return json({ ok: true });
}
