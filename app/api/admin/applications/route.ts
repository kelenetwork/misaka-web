import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const guard = await requireAdmin(req); if (!guard.ok) return guard.response; return json(await db.query.applications.findMany({ where: eq(applications.status, "pending") })); }
