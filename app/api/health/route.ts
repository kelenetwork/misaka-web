import { db } from "@/lib/db/client";
import { workerHealth } from "@/lib/db/schema";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Overall = "healthy" | "degraded" | "down";

function workerStatus(ageSec: number, consecutiveFailures: number): Overall {
  if (ageSec > 300 || consecutiveFailures >= 3) return "down";
  if (ageSec >= 90) return "degraded";
  return "healthy";
}

function overallStatus(statuses: Overall[]): Overall {
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

export async function GET() {
  const now = Date.now();
  const statuses: Overall[] = [];
  const rows = await db.select().from(workerHealth);
  const workers = rows.map((row) => {
    const ageSec = Math.max(0, Math.floor((now - row.lastTickAt.getTime()) / 1000));
    const status = workerStatus(ageSec, row.consecutiveFailures);
    statuses.push(status);
    return { worker: row.worker, lastTickAt: row.lastTickAt.toISOString(), healthy: status === "healthy", lastError: row.lastError, ageSec };
  });
  return json({ workers, overall: overallStatus(statuses) });
}
