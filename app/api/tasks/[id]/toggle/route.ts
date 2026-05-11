import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) }); if (!task) return json({ error: "not_found" }, 404); const [row] = await db.update(tasks).set({ enabled: !task.enabled, updatedAt: new Date() }).where(eq(tasks.id, id)).returning(); return json(row); }
