import { EventEmitter } from "node:events";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inventorySnapshots } from "@/lib/db/schema";
import { MisakaClient } from "./client";

export type InventoryPlan = { region: string; planId: number; available: boolean; planSlug: string; planName: string; price: number; cpu: number; ram: number; disk: Record<string, unknown> };
export const inventoryEvents = new EventEmitter();

export async function upsertInventorySnapshot(plan: InventoryPlan) {
  const previous = await db.query.inventorySnapshots.findFirst({ where: and(eq(inventorySnapshots.region, plan.region), eq(inventorySnapshots.planId, plan.planId)) });
  await db.insert(inventorySnapshots).values({ ...plan, updatedAt: new Date() }).onConflictDoUpdate({ target: [inventorySnapshots.region, inventorySnapshots.planId], set: { ...plan, updatedAt: new Date() } });
  if (previous && !previous.available && plan.available) inventoryEvents.emit("available", plan);
  inventoryEvents.emit("change", plan);
}

export function normalizePlan(region: string, raw: Record<string, unknown>): InventoryPlan {
  return { region, planId: Number(raw.id ?? raw.plan_id), available: Boolean(raw.available ?? raw.stock ?? raw.in_stock), planSlug: String(raw.slug ?? raw.plan_slug ?? raw.id), planName: String(raw.name ?? raw.plan_name ?? raw.slug ?? raw.id), price: Number(raw.price ?? 0), cpu: Number(raw.cpu ?? 0), ram: Number(raw.ram ?? 0), disk: (raw.disk as Record<string, unknown>) ?? {} };
}

export async function pollInventory(client: MisakaClient) {
  const regions = await client.getRegions() as Array<{ id?: string; region?: string }>;
  for (const region of regions) {
    const regionId = String(region.id ?? region.region);
    const plans = await client.getPlans(regionId) as Array<Record<string, unknown>>;
    for (const rawPlan of plans) await upsertInventorySnapshot(normalizePlan(regionId, rawPlan));
  }
}
