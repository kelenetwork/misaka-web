"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { SectionHead } from "@/components/ui/SectionHead";
import { flagOf, fmtMb, fmtPrice, fmtRelative } from "@/lib/util/format";

export type InventoryPlan = {
  region: string;
  planId: number;
  available: boolean;
  planSlug: string;
  planName: string;
  priceMonthly: number;
  priceSemiannual: number | null;
  priceAnnual: number | null;
  vcores: number;
  memoryMb: number;
  diskMb: number;
  transferMb: number;
  networkBillingModel: string | null;
  routingProfile: string | null;
  nvme: boolean;
  tags: string[] | null;
  unavailableReason: string | null;
  updatedAt: string | null;
};

export type InventoryRegion = {
  id: string;
  name: string;
  slug: string;
  facility: string | null;
  countryCode: string;
  country: string;
  continent: string | null;
  type: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[] | null;
  available: boolean;
  unavailableReason: string | null;
  certificates: string[] | null;
  speedtests: Array<{ url: string; label: string }> | null;
  description: string | null;
  updatedAt: string | null;
};

export type InventoryRow = {
  region: InventoryRegion;
  plans: InventoryPlan[];
  inStock: InventoryPlan[];
  minPrice: number;
  updatedAt: string | null;
};

export type InventoryStats = {
  regionsTotal: number;
  regionsAvailable: number;
  plansTotal: number;
  plansInStock: number;
  lastUpdate: string | null;
};

type ContinentTab = {
  label: string;
  value: string | null;
};

const CONTINENT_TABS: ContinentTab[] = [
  { label: "全部", value: null },
  { label: "亚洲", value: "Asia" },
  { label: "欧洲", value: "Europe" },
  { label: "北美", value: "North America" },
  { label: "南美", value: "South America" },
  { label: "大洋洲", value: "Oceania" },
  { label: "非洲", value: "Africa" },
];

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "zh-Hans", { sensitivity: "base" });
}

function compareAllRegions(a: InventoryRow, b: InventoryRow) {
  return compareText(a.region.continent, b.region.continent) || compareText(a.region.name, b.region.name);
}

function compareFeatured(a: InventoryRow, b: InventoryRow) {
  return b.inStock.length - a.inStock.length || a.minPrice - b.minPrice || compareAllRegions(a, b);
}

function matchesKeyword(row: InventoryRow, keyword: string) {
  if (!keyword) return true;
  const haystack = [row.region.country, row.region.id, row.region.name, row.region.facility]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword);
}

function InventoryTable({ rows, emptyText }: { rows: InventoryRow[]; emptyText: string }) {
  return (
    <Card>
      <div className="grid grid-cols-[200px_1fr_100px_90px_100px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
        <div className="px-4 py-3">区域</div>
        <div className="px-4 py-3">机型库存</div>
        <div className="px-4 py-3">最低价</div>
        <div className="px-4 py-3">有货数</div>
        <div className="px-4 py-3">更新</div>
      </div>

      {rows.length === 0 && (
        <div className="px-8 py-12 text-center text-[var(--text-faint)] text-[13px]">
          {emptyText}
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
              <div className="text-[10px] tracking-[0.08em] text-[var(--text-faint)]">
                {region.id} · {region.facility ?? region.name}
              </div>
            </div>
          </div>
          <div className="px-0 py-3.5 flex gap-1.5 flex-wrap">
            {plans.map((plan) => (
              <span
                key={plan.planId}
                className={[
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] font-semibold cursor-default",
                  "transition-transform hover:-translate-y-px",
                  plan.available
                    ? "bg-[var(--misaka-dim)] text-[var(--misaka)] border border-[var(--misaka)]"
                    : "bg-transparent text-[var(--text-faint)] border border-[var(--border)]",
                ].join(" ")}
                title={`${plan.vcores}C / ${fmtMb(plan.memoryMb)} RAM / ${fmtMb(plan.diskMb)} disk / ${fmtMb(plan.transferMb)} transfer · ${plan.routingProfile ?? ""}`}
              >
                <span
                  className={[
                    "w-1.5 h-1.5 rounded-full",
                    plan.available ? "bg-[var(--misaka)] shadow-[0_0_6px_var(--misaka)]" : "bg-[var(--text-faint)] opacity-40",
                  ].join(" ")}
                />
                {plan.planName} · {fmtPrice(plan.priceMonthly)}
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
  );
}

export function InventoryMatrix({
  rows,
  stats,
  popularIds,
}: {
  rows: InventoryRow[];
  stats: InventoryStats;
  popularIds: string[];
}) {
  const [keyword, setKeyword] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [continent, setContinent] = useState<string | null>(null);

  const popularIdSet = useMemo(() => new Set(popularIds), [popularIds]);
  const normalizedKeyword = keyword.trim().toLowerCase();

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!matchesKeyword(row, normalizedKeyword)) return false;
        if (onlyInStock && row.inStock.length === 0) return false;
        if (continent && row.region.continent !== continent) return false;
        return true;
      }),
    [continent, normalizedKeyword, onlyInStock, rows]
  );

  const featuredRows = useMemo(
    () => filteredRows.filter((row) => popularIdSet.has(row.region.id)).sort(compareFeatured),
    [filteredRows, popularIdSet]
  );
  const allRegionRows = useMemo(
    () => filteredRows.filter((row) => !popularIdSet.has(row.region.id)).sort(compareAllRegions),
    [filteredRows, popularIdSet]
  );

  const emptyText = rows.length === 0 ? "等待 inventory poller 首次轮询完成...通常 30 秒内出现数据" : "没有匹配的区域";

  return (
    <>
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
        <StatCard label="活跃任务" value={0} unit="个" delta="0 等待 · 0 暂停" deltaTone="neutral" />
        <StatCard label="今日下单" value={0} unit="单" delta="尚无订单" deltaTone="neutral" />
      </div>

      <div className="fade-up" style={{ animationDelay: "80ms" }}>
        <Card className="px-4 py-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_auto] xl:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索国家 / 区域 ID / 城市 / 机房"
              className="h-9 min-w-[280px] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 font-mono text-[12px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--misaka)]"
            />
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)]">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(event) => setOnlyInStock(event.target.checked)}
                className="h-4 w-4 accent-[var(--misaka)]"
              />
              仅显示有货
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CONTINENT_TABS.map((tab) => {
              const active = continent === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setContinent(tab.value)}
                  className={[
                    "h-8 rounded-md border px-3 font-mono text-[11px] transition-colors",
                    active
                      ? "border-[var(--misaka)] bg-[var(--misaka-dim)] text-[var(--misaka)]"
                      : "border-[var(--border)] bg-transparent text-[var(--text-faint)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        </Card>
      </div>

      <div className="grid gap-4 fade-up" style={{ animationDelay: "120ms" }}>
        <SectionHead
          title="库存"
          count={`${filteredRows.length} 区域 · ${stats.plansTotal} 机型`}
          actions={
            <>
              <Button variant="ghost"><Download className="w-3.5 h-3.5" /> 导出 CSV</Button>
              <Button variant="primary">+ 新建任务</Button>
            </>
          }
        />

        <section className="grid gap-3">
          <SectionHead title="热门区域 · Featured" count={`${featuredRows.length} 区域`} />
          <InventoryTable rows={featuredRows} emptyText={emptyText} />
        </section>

        <section className="grid gap-3">
          <SectionHead title="其他区域 · All Regions" count={`${allRegionRows.length} 区域`} />
          <InventoryTable rows={allRegionRows} emptyText={emptyText} />
        </section>
      </div>
    </>
  );
}
