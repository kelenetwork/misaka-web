import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { systemConfig } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function GET() { return json(await db.query.systemConfig.findMany()); }
export async function PUT(req: NextRequest) { const body = await req.json() as Record<string, unknown>; for (const [key, value] of Object.entries(body)) await db.insert(systemConfig).values({ key, value: JSON.stringify(value) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(value) } }); return json({ ok: true }); }
