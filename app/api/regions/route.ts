import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const guard = await requireUser(req); if (!guard.ok) return guard.response; return json({ regions: [] }); }
