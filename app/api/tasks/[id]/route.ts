import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return json(await db.query.tasks.findFirst({ where: eq(tasks.id, id) })); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const [row] = await db.update(tasks).set({ ...(await req.json()), updatedAt: new Date() }).where(eq(tasks.id, id)).returning(); return json(row); }
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; await db.delete(tasks).where(eq(tasks.id, id)); return json({ ok: true }); }
