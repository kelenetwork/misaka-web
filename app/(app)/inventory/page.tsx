import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar, StatusPill } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db/client";
import { regions, inventorySnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { flagOf, fmtPrice, fmtRelative, fmtMb } from "@/lib/util/format";
import { RefreshCw, Bell, Download } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function getInventoryData() {
  const allRegions = await db.select().from(regions).orderBy(regions.continent, regions.name);
  const allPlans = await db.select().from(inventorySnapshots);

  const byRegion = new Map<string, typeof allPlans>();
  for (const p of allPlans) {
    const list = byRegion.get(p.region) ?? [];
    list.push(p);
    byRegion.set(p.region, list);
  }

  return { allRegions, byRegion };
}

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { allRegions, byRegion } = await getInventoryData();

  // Build matrix rows
  const rows = allRegions
    .map((region) => {
      const plans = (byRegion.get(region.id) ?? []).sort((a, b) => a.priceMonthly - b.priceMonthly);
      const inStock = plans.filter((p) => p.available);
      const minPrice = inStock[0]?.priceMonthly ?? plans[0]?.priceMonthly ?? 0;
      const updatedAt = plans[0]?.updatedAt;
      return { region, plans, inStock, minPrice, updatedAt };
    })
    .filter((r) => r.plans.length > 0); // 只显示有 plan 数据的

  const stats = {
    regionsTotal: allRegions.length,
    regionsAvailable: rows.filter((r) => r.inStock.length > 0).length,
    plansTotal: rows.reduce((acc, r) => acc + r.plans.length, 0),
    plansInStock: rows.reduce((acc, r) => acc + r.inStock.length, 0),
    lastUpdate: rows.reduce<Date | null>(
      (acc, r) => (r.updatedAt && (!acc || r.updatedAt > acc) ? r.updatedAt : acc),
      null
    ),
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
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 fade-up">
          <StatCard
            label="在监控区域"
            value={stats.regionsAvailable}
            unit={`/ ${stats.regionsTotal}`}
            delta={`↗ ${stats.regionsAvailable} 个有货`}
          />
          <StatCard
            label="可下单机型"
            value={stats.plansInStock}
            unit={`/ ${stats.plansTotal}`}
            delta={stats.plansInStock > 0 ? `${Math.round((stats.plansInStock / Math.max(stats.plansTotal, 1)) * 100)}% 上架` : "全部缺货"}
          />
          <StatCard
            label="活跃任务"
            value={0}
            unit="个"
            delta="0 等待 · 0 暂停"
            deltaTone="neutral"
          />
          <StatCard
            label="今日下单"
            value={0}
            unit="单"
            delta="尚无订单"
            deltaTone="neutral"
          />
        </div>

        {/* Inventory matrix */}
        <div className="grid gap-4 fade-up" style={{ animationDelay: "120ms" }}>
          <SectionHead
            title="库存"
            count={`${rows.length} 区域 · ${stats.plansTotal} 机型`}
            actions={
              <>
                <Button variant="ghost"><Download className="w-3.5 h-3.5" /> 导出 CSV</Button>
                <Button variant="primary">+ 新建任务</Button>
              </>
            }
          />

          <Card>
            {/* Header */}
            <div className="grid grid-cols-[200px_1fr_100px_90px_100px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
              <div className="px-4 py-3">区域</div>
              <div className="px-4 py-3">机型库存</div>
              <div className="px-4 py-3">最低价</div>
              <div className="px-4 py-3">有货数</div>
              <div className="px-4 py-3">更新</div>
            </div>

            {rows.length === 0 && (
              <div className="px-8 py-12 text-center text-[var(--text-faint)] text-[13px]">
                等待 inventory poller 首次轮询完成...通常 30 秒内出现数据
              </div>
            )}

            {rows.map(({ region, plans, inStock, minPrice, updatedAt }) => (
              <div
                key={region.id}
                className="grid grid-cols-[200px_1fr_100px_90px_100px] border-t border-[var(--border)] items-center hover:bg-[var(--bg-elev-2)] transition-colors"
              >
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <span className="text-[22px] leading-none drop-shadow-md">{flagOf(region.countryCode)}</span>
                  <div className="leading-tight">
                    <div className="font-semibold text-[var(--text)]">{region.country}</div>
                    <div className="text-[10px] tracking-[0.08em] text-[var(--text-faint)]">{region.id} · {region.facility ?? region.name}</div>
                  </div>
                </div>
                <div className="px-0 py-3.5 flex gap-1.5 flex-wrap">
                  {plans.map((p) => (
                    <span
                      key={p.planId}
                      className={[
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] font-semibold cursor-default",
                        "transition-transform hover:-translate-y-px",
                        p.available
                          ? "bg-[var(--misaka-dim)] text-[var(--misaka)] border border-[var(--misaka)]"
                          : "bg-transparent text-[var(--text-faint)] border border-[var(--border)]",
                      ].join(" ")}
                      title={`${p.vcores}C / ${fmtMb(p.memoryMb)} RAM / ${fmtMb(p.diskMb)} disk / ${fmtMb(p.transferMb)} transfer · ${p.routingProfile ?? ""}`}
                    >
                      <span
                        className={[
                          "w-1.5 h-1.5 rounded-full",
                          p.available ? "bg-[var(--misaka)] shadow-[0_0_6px_var(--misaka)]" : "bg-[var(--text-faint)] opacity-40",
                        ].join(" ")}
                      />
                      {p.planName} · {fmtPrice(p.priceMonthly)}
                    </span>
                  ))}
                </div>
                <div className="px-4 py-3.5 text-[12px] text-[var(--text)] font-medium">
                  <span className="text-[var(--text-faint)] text-[10px] mr-0.5">$</span>
                  {minPrice.toFixed(2)}
                </div>
                <div className="px-4 py-3.5 text-[12px]">
                  <span className="text-[var(--misaka)] font-semibold text-[13px]">{inStock.length}</span>
                  <span className="text-[var(--text-faint)]">/{plans.length}</span>
                </div>
                <div className="px-4 py-3.5 text-[11px] text-[var(--text-faint)]">
                  {updatedAt ? fmtRelative(updatedAt) : "—"}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </section>

      <Footer />
    </AppShell>
  );
}
