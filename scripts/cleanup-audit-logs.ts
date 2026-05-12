import { cleanupOldAuditLogs, DEFAULT_AUDIT_LOG_RETENTION_DAYS } from "@/lib/audit-cleanup";

function parseArgs(argv: string[]) {
  let days = DEFAULT_AUDIT_LOG_RETENTION_DAYS;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--days=")) {
      days = Number(arg.slice("--days=".length));
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");
  return { days, dryRun };
}

const { days, dryRun } = parseArgs(process.argv.slice(2));
const result = await cleanupOldAuditLogs(days, dryRun);
const action = dryRun ? "would delete" : "deleted";
console.log(
  `${action} ${dryRun ? result.matched : result.deleted} rows older than ${result.cutoff.toISOString()}, kept ${result.kept} rows`,
);
