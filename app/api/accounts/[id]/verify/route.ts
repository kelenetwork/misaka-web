import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { MisakaClient } from "@/lib/misaka/client";
import { json } from "@/lib/http";
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, id) }); if (!account) return json({ error: "not_found" }, 404); await new MisakaClient(account).login(); return json({ ok: true }); }
