import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireUser } from "@/lib/api-guard";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const guard = await requireUser(req); if (!guard.ok) return guard.response; return json(await db.query.inventorySnapshots.findMany()); }
