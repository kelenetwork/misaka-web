import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { patchAdminUserSchema } from "@/lib/schemas";
import { json } from "@/lib/http";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; const { id } = await params; return json(await db.query.users.findFirst({ where: eq(users.id, id) })); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; const { id } = await params; const body = patchAdminUserSchema.parse(await req.json()); const [row] = await db.update(users).set({ ...body, updatedAt: new Date() }).where(eq(users.id, id)).returning(); return json(row); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; const { id } = await params; await db.delete(users).where(eq(users.id, id)); return json({ ok: true }); }
