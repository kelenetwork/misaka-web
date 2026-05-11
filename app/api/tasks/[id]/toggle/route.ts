import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { json } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) return json({ error: "not_found" }, 404);
  if (task.userId !== guard.user.id && guard.user.role !== "admin") return json({ error: "forbidden" }, 403);
  const [row] = await db.update(tasks).set({ enabled: !task.enabled, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
  return json(row);
}
