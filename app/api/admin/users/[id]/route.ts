import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const [row] = await db.update(users).set({ ...(await req.json()), updatedAt: new Date() }).where(eq(users.id, id)).returning(); return json(row); }
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; await db.delete(users).where(eq(users.id, id)); return json({ ok: true }); }
