import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar, StatusPill } from "@/components/shell/Topbar";
import { db } from "@/lib/db/client";
import { inventorySnapshots, orders, regions, tasks } from "@/lib/db/schema";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { fmtRelative } from "@/lib/util/format";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { InventoryMatrix, type InventoryRow, type InventoryStats } from "./_components/InventoryMatrix";
import { RefreshButton } from "./_components/RefreshButton";

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

async function getInventoryData(userId: string) {
  const allRegions = await db.select().from(regions).orderBy(regions.continent, regions.name);
  const allPlans = await db.select().from(inventorySnapshots);
  const tzOffsetMs = 8 * 3600 * 1000;
  const todayStart = new Date(Math.floor((Date.now() + tzOffsetMs) / 86400000) * 86400000 - tzOffsetMs);
  const [activeTaskRow] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.enabled, true), lt(tasks.currentCount, tasks.targetCount)));
  const [enabledTaskRow] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.enabled, true)));
  const [todayOrderRow] = await db
    .select({ value: count() })
    .from(orders)
    .where(and(eq(orders.userId, userId), gte(orders.createdAt, todayStart)));

  const byRegion = new Map<string, typeof allPlans>();
  for (const plan of allPlans) {
    const list = byRegion.get(plan.region) ?? [];
    list.push(plan);
    byRegion.set(plan.region, list);
  }

  return {
    allRegions,
    byRegion,
    activeTasks: activeTaskRow?.value ?? 0,
    enabledTasks: enabledTaskRow?.value ?? 0,
    todayOrders: todayOrderRow?.value ?? 0,
  };
}

function serializeDate(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { allRegions, byRegion, activeTasks, enabledTasks, todayOrders } = await getInventoryData(user.id);

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
    activeTasks,
    enabledTasks,
    todayOrders,
  };

  return (
    <AppShell user={{ name: user.username, role: user.role }}>
      <Topbar
        crumb="监控 /"
        title="库存矩阵"
        right={
          <>
            <StatusPill text={stats.lastUpdate ? `实时 · ${fmtRelative(stats.lastUpdate)}` : "等待首次轮询..."} />
            <RefreshButton />
            <Link href="/activity" className="w-8 h-8 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors" title="实时活动">
              <Bell className="w-4 h-4" />
            </Link>
          </>
        }
      />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1">
        <InventoryMatrix rows={rows} stats={stats} popularIds={[...POPULAR_REGION_IDS]} />
      </section>

      <Footer />
    </AppShell>
  );
}
