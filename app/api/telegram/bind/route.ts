import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { json } from "@/lib/http";
export async function POST(req: NextRequest) { const guard = await requireUser(req); if (!guard.ok) return guard.response; return json({ userId: guard.user.id, bindCode: crypto.randomUUID(), expiresIn: 300, todo: "persist bind code and verify from /start" }); }
