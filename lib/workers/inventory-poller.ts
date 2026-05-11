import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { systemConfig } from "@/lib/db/schema";
import { inventoryEvents, pollInventoryPublic } from "@/lib/misaka/inventory";
import { runMatchingTasks } from "./task-runner";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";
import { recordFailure, recordSuccess, recordTick } from "./health";

let timer: NodeJS.Timeout | null = null;

// Wire task runner to inventory events
inventoryEvents.on("available", runMatchingTasks);

async function getPollIntervalMs() {
  const value = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, "pollIntervalSec") });
  return Number(JSON.parse(value?.value ?? "30")) * 1000;
}

export async function seedSystemConfig() {
  const defaults = { pollIntervalSec: 30, circuitBreakerMinutes: 30, applyRateLimitPerHour: 5, applyRateLimitPer5Min: 1 };
  for (const [key, value] of Object.entries(defaults)) {
    await db.insert(systemConfig).values({ key, value: JSON.stringify(value) }).onConflictDoNothing();
  }
}

export async function tickInventoryPoller() {
  await recordTick("inventory_poller");
  try {
    await cleanupExpiredRateLimits();
    await pollInventoryPublic();
    await recordSuccess("inventory_poller");
  } catch (err) {
    await recordFailure("inventory_poller", err);
    console.warn("[inventory-poller] tick failed:", err instanceof Error ? err.message : err);
  }
}

export async function startInventoryPoller() {
  await seedSystemConfig();
  const loop = async () => {
    try {
      await tickInventoryPoller();
    } finally {
      const interval = await getPollIntervalMs().catch(() => 30_000);
      timer = setTimeout(loop, interval);
    }
  };
  if (!timer) timer = setTimeout(loop, 1000);
}

export function stopInventoryPoller() {
  if (timer) clearTimeout(timer);
  timer = null;
}
