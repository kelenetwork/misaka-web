import { count, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

export async function countAuditLogs() {
  const [{ value }] = await db.select({ value: count() }).from(auditLogs);
  return value;
}

export async function cleanupOldAuditLogs(days = DEFAULT_AUDIT_LOG_RETENTION_DAYS, dryRun = false) {
  if (!Number.isFinite(days) || days <= 0) throw new Error("days must be a positive number");

  const cutoff = new Date(Date.now() - days * DAY_MS);
  const [{ value: deleteCount }] = await db.select({ value: count() }).from(auditLogs).where(lt(auditLogs.createdAt, cutoff));
  const totalBefore = await countAuditLogs();

  if (!dryRun && deleteCount > 0) {
    await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff));
  }

  return {
    cutoff,
    deleted: dryRun ? 0 : deleteCount,
    matched: deleteCount,
    kept: dryRun ? totalBefore : totalBefore - deleteCount,
  };
}
