import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return json(await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, id) })); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const body = await req.json(); const [row] = await db.update(misakaAccounts).set(body).where(eq(misakaAccounts.id, id)).returning(); return json(row); }
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; await db.delete(misakaAccounts).where(eq(misakaAccounts.id, id)); return json({ ok: true }); }
