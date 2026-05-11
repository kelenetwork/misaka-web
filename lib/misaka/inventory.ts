import { EventEmitter } from "node:events";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inventorySnapshots, regions } from "@/lib/db/schema";

// === Public API endpoints (no auth required) ===
const API_BASE = "https://app.misaka.io";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; misaka-web/0.1; +https://vps.misaka.si)",
  Accept: "application/json",
};

// === Misaka.io API response types ===
export type RegionRaw = {
  id: string;
  type?: string;
  facility?: string;
  name: string;
  slug: string;
  country_code: string;
  country: string;
  contient?: string; // [sic] - misaka.io has a typo
  continent?: string;
  subdivision_code?: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  available: boolean;
  unavailable_reason?: string;
  description?: string;
  certificates?: string[];
  speedtests?: Array<{ url: string; label: string }>;
};

export type PlanRaw = {
  id: number;
  slug: string;
  name: string;
  memory: number;
  vcores: number;
  disk: number;
  transfer: number;
  network_billing_model?: string;
  nvme?: boolean;
  routing_profile?: string;
  price_monthly: number;
  price_semiannual?: number;
  price_annual?: number;
  available: boolean;
  unavailable_reason?: string;
  tags?: string[];
};

export type InventoryPlan = {
  region: string;
  planId: number;
  planSlug: string;
  planName: string;
  available: boolean;
  priceMonthly: number;
  vcores: number;
  memoryMb: number;
  diskMb: number;
};

export const inventoryEvents = new EventEmitter();

// === HTTP helpers ===
async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`misaka.io ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchRegions(): Promise<RegionRaw[]> {
  return fetchJson<RegionRaw[]>("/api/mc2/regions");
}

export async function fetchPlans(regionId: string): Promise<PlanRaw[]> {
  return fetchJson<PlanRaw[]>(`/api/mc2/regions/${encodeURIComponent(regionId)}/plans`);
}

// === Upsert helpers ===
export async function upsertRegion(raw: RegionRaw) {
  const row = {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    facility: raw.facility ?? null,
    countryCode: raw.country_code,
    country: raw.country,
    continent: raw.continent ?? raw.contient ?? null,
    type: raw.type ?? null,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    tags: raw.tags ?? null,
    available: raw.available,
    unavailableReason: raw.unavailable_reason ?? null,
    certificates: raw.certificates ?? null,
    speedtests: raw.speedtests ?? null,
    description: raw.description ?? null,
    updatedAt: new Date(),
  };
  await db.insert(regions).values(row).onConflictDoUpdate({ target: regions.id, set: row });
}

export async function upsertPlan(regionId: string, raw: PlanRaw): Promise<{ changed: boolean; becameAvailable: boolean; plan: InventoryPlan }> {
  const previous = await db.query.inventorySnapshots.findFirst({
    where: and(eq(inventorySnapshots.region, regionId), eq(inventorySnapshots.planId, raw.id)),
  });

  const row = {
    region: regionId,
    planId: raw.id,
    planSlug: raw.slug,
    planName: raw.name,
    available: raw.available,
    priceMonthly: raw.price_monthly,
    priceSemiannual: raw.price_semiannual ?? null,
    priceAnnual: raw.price_annual ?? null,
    vcores: raw.vcores,
    memoryMb: raw.memory,
    diskMb: raw.disk,
    transferMb: raw.transfer,
    networkBillingModel: raw.network_billing_model ?? null,
    routingProfile: raw.routing_profile ?? null,
    nvme: raw.nvme ?? false,
    tags: raw.tags ?? null,
    unavailableReason: raw.unavailable_reason ?? null,
    updatedAt: new Date(),
  };

  await db.insert(inventorySnapshots).values(row).onConflictDoUpdate({
    target: [inventorySnapshots.region, inventorySnapshots.planId],
    set: row,
  });

  const changed = !previous || previous.available !== raw.available || previous.priceMonthly !== raw.price_monthly;
  const becameAvailable = !!previous && !previous.available && raw.available;

  const plan: InventoryPlan = {
    region: regionId,
    planId: raw.id,
    planSlug: raw.slug,
    planName: raw.name,
    available: raw.available,
    priceMonthly: raw.price_monthly,
    vcores: raw.vcores,
    memoryMb: raw.memory,
    diskMb: raw.disk,
  };

  return { changed, becameAvailable, plan };
}

export async function pollInventoryPublic() {
  const regionList = await fetchRegions();
  for (const region of regionList) {
    await upsertRegion(region);
    try {
      const plans = await fetchPlans(region.id);
      for (const raw of plans) {
        const { changed, becameAvailable, plan } = await upsertPlan(region.id, raw);
        if (becameAvailable) inventoryEvents.emit("available", plan);
        if (changed) inventoryEvents.emit("change", plan);
      }
    } catch (err) {
      // Region 可能没有 plans 或 misaka.io 临时 5xx，跳过单 region 失败，继续其他
      console.warn(`[inventory] failed to fetch plans for ${region.id}:`, err instanceof Error ? err.message : err);
    }
  }
}
