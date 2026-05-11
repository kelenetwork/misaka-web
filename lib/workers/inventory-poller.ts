import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts, systemConfig } from "@/lib/db/schema";
import { MisakaClient } from "@/lib/misaka/client";
import { inventoryEvents, pollInventory } from "@/lib/misaka/inventory";
import { logAudit } from "@/lib/audit";
import { runMatchingTasks } from "./task-runner";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";

let timer: NodeJS.Timeout | null = null;
inventoryEvents.on("available", runMatchingTasks);

async function getPollIntervalMs() {
  const value = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, "pollIntervalSec") });
  return Number(value?.value ?? "30") * 1000;
}

export async function seedSystemConfig() {
  const defaults = { pollIntervalSec: 30, circuitBreakerMinutes: 30, applyRateLimitPerHour: 5, applyRateLimitPer5Min: 1 };
  for (const [key, value] of Object.entries(defaults)) await db.insert(systemConfig).values({ key, value: JSON.stringify(value) }).onConflictDoNothing();
}

export async function tickInventoryPoller() {
  await cleanupExpiredRateLimits();
  try {
    await pollInventory(new MisakaClient(null));
    return;
  } catch (error) {
    const publicError = error instanceof Error ? error.message : String(error);
    const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.status, "active") });
    if (!account) {
      await logAudit(null, "inventory.poll.skipped", "misaka", { publicError }, null);
      return;
    }
    try {
      await pollInventory(new MisakaClient(account));
    } catch (fallbackError) {
      await logAudit(null, "inventory.poll.skipped", "misaka", { publicError, fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) }, null);
    }
  }
}

export async function startInventoryPoller() {
  await seedSystemConfig();
  const loop = async () => { try { await tickInventoryPoller(); } finally { timer = setTimeout(loop, await getPollIntervalMs()); } };
  if (!timer) timer = setTimeout(loop, 1000);
}
export function stopInventoryPoller() { if (timer) clearTimeout(timer); timer = null; }
