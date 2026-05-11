import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar, StatusPill } from "@/components/shell/Topbar";
import { db } from "@/lib/db/client";
import { regions, inventorySnapshots } from "@/lib/db/schema";
import { fmtRelative } from "@/lib/util/format";
import { RefreshCw, Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { InventoryMatrix, type InventoryRow, type InventoryStats } from "./_components/InventoryMatrix";

export const dynamic = "force-dynamic";

const POPULAR_REGION_IDS = new Set<string>([
  "NRT04",
  "HKG12",
  "SIN03",
  "TPE01",
  "LAX02",
  "SJC10",
  "EWR02",
  "IAD01",
  "FRA13",
  "FRA02",
  "AMS02",
  "LON05",
]);

async function getInventoryData() {
  const allRegions = await db.select().from(regions).orderBy(regions.continent, regions.name);
  const allPlans = await db.select().from(inventorySnapshots);

  const byRegion = new Map<string, typeof allPlans>();
  for (const plan of allPlans) {
    const list = byRegion.get(plan.region) ?? [];
    list.push(plan);
    byRegion.set(plan.region, list);
  }

  return { allRegions, byRegion };
}

function serializeDate(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { allRegions, byRegion } = await getInventoryData();

  const rows: InventoryRow[] = allRegions
    .map((region) => {
      const plans = (byRegion.get(region.id) ?? []).sort((a, b) => a.priceMonthly - b.priceMonthly);
      const inStock = plans.filter((plan) => plan.available);
      const minPrice = inStock[0]?.priceMonthly ?? plans[0]?.priceMonthly ?? 0;
      const updatedAt = plans[0]?.updatedAt;
      return {
        region: {
          ...region,
          updatedAt: serializeDate(region.updatedAt),
        },
        plans: plans.map((plan) => ({
          ...plan,
          updatedAt: serializeDate(plan.updatedAt),
        })),
        inStock: inStock.map((plan) => ({
          ...plan,
          updatedAt: serializeDate(plan.updatedAt),
        })),
        minPrice,
        updatedAt: serializeDate(updatedAt),
      };
    })
    .filter((row) => row.plans.length > 0);

  const lastUpdate = rows.reduce<string | null>(
    (acc, row) => (row.updatedAt && (!acc || new Date(row.updatedAt) > new Date(acc)) ? row.updatedAt : acc),
    null
  );

  const stats: InventoryStats = {
    regionsTotal: allRegions.length,
    regionsAvailable: rows.filter((row) => row.inStock.length > 0).length,
    plansTotal: rows.reduce((acc, row) => acc + row.plans.length, 0),
    plansInStock: rows.reduce((acc, row) => acc + row.inStock.length, 0),
    lastUpdate,
  };

  return (
    <AppShell user={{ name: user.username, role: user.role }}>
      <Topbar
        crumb="监控 /"
        title="库存矩阵"
        right={
          <>
            <StatusPill text={stats.lastUpdate ? `实时 · ${fmtRelative(stats.lastUpdate)}` : "等待首次轮询..."} />
            <button className="w-8 h-8 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors" title="刷新">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors" title="通知">
              <Bell className="w-4 h-4" />
            </button>
          </>
        }
      />

      <section className="px-8 py-7 grid gap-6 flex-1">
        <InventoryMatrix rows={rows} stats={stats} popularIds={[...POPULAR_REGION_IDS]} />
      </section>

      <Footer />
    </AppShell>
  );
}
