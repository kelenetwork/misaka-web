import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req); if (!guard.ok) return guard.response;
  const { id } = await params; const body = await req.json();
  await db.update(applications).set({ status: "rejected", reviewedBy: guard.user.id, rejectionReason: body.reason, reviewedAt: new Date() }).where(eq(applications.id, id));
  await logAudit(guard.user.id, "application.rejected", id, { reason: body.reason }, getIp(req));
  return json({ ok: true });
}
