import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireAdmin } from "@/lib/api-guard";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; return json(await db.query.users.findMany()); }
