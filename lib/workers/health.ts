import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workerHealth } from "@/lib/db/schema";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function recordTick(worker: string): Promise<void> {
  const now = new Date();
  await db.insert(workerHealth).values({ worker, lastTickAt: now, updatedAt: now }).onConflictDoUpdate({ target: workerHealth.worker, set: { lastTickAt: now, updatedAt: now } });
}

export async function recordSuccess(worker: string): Promise<void> {
  const now = new Date();
  await db.insert(workerHealth).values({ worker, lastTickAt: now, lastSuccessAt: now, lastError: null, consecutiveFailures: 0, updatedAt: now }).onConflictDoUpdate({ target: workerHealth.worker, set: { lastSuccessAt: now, lastError: null, consecutiveFailures: 0, updatedAt: now } });
}

export async function recordFailure(worker: string, error: unknown): Promise<void> {
  const now = new Date();
  await db.insert(workerHealth).values({ worker, lastTickAt: now, lastError: errorMessage(error), consecutiveFailures: 1, updatedAt: now }).onConflictDoUpdate({ target: workerHealth.worker, set: { lastError: errorMessage(error), consecutiveFailures: sql`${workerHealth.consecutiveFailures} + 1`, updatedAt: now } });
}
