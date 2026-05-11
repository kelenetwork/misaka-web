import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { systemConfig } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { patchSystemConfigSchema } from "@/lib/schemas";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; return json(await db.query.systemConfig.findMany()); }
export async function PATCH(req: NextRequest) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; const body = patchSystemConfigSchema.parse(await req.json()); await db.insert(systemConfig).values({ key: body.key, value: JSON.stringify(body.value) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(body.value) } }); return json({ ok: true }); }
