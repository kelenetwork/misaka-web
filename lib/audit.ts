import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export async function logAudit(actorId: string | null, action: string, target: string, details: Record<string, unknown> | null = null, ip?: string | null) {
  await db.insert(auditLogs).values({ actorId, action, target, details, ip: ip ?? null });
}
