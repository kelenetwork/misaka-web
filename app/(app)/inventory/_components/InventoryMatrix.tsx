"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  activeTasks: number;
  enabledTasks: number;
  todayOrders: number;
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
  // misaka.io 库存暂无 Oceania 节点
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

function formatCsvValue(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatInventoryFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `inventory-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.csv`;
}

function normalizeContinent(value: string | null) {
  return CONTINENT_TABS.some((tab) => tab.value === value) ? value : null;
}

function InventoryTable({ rows, emptyText }: { rows: InventoryRow[]; emptyText: string }) {
  return (
    <Card>
      {/* 桌面表头 */}
      <div className="hidden lg:grid grid-cols-[200px_1fr_100px_90px_100px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
        <div className="px-4 py-3">区域</div>
        <div className="px-4 py-3">机型库存</div>
        <div className="px-4 py-3">最低价</div>
        <div className="px-4 py-3">有货数</div>
        <div className="px-4 py-3">更新</div>
      </div>

      {rows.length === 0 && (
        <div className="px-4 sm:px-8 py-10 sm:py-12 text-center text-[var(--text-faint)] text-[13px]">
          {emptyText}
        </div>
      )}

      {rows.map(({ region, plans, inStock, minPrice, updatedAt }) => (
        <div
          key={region.id}
          className="flex flex-col gap-3 lg:gap-0 lg:grid lg:grid-cols-[200px_1fr_100px_90px_100px] border-t border-[var(--border)] lg:items-center hover:bg-[var(--bg-elev-2)] transition-colors px-4 py-3 lg:px-0 lg:py-0"
        >
          <div className="px-0 lg:px-4 py-0 lg:py-3.5 flex items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[22px] leading-none drop-shadow-md">{flagOf(region.countryCode)}</span>
              <div className="leading-tight min-w-0">
                <div className="font-semibold text-[var(--text)] truncate">{region.country}</div>
                <div className="text-[10px] tracking-[0.08em] text-[var(--text-faint)] truncate">
                  {region.id} · {region.facility ?? region.name}
                </div>
              </div>
            </div>
            {/* 移动端：摘要数字行内 */}
            <div className="lg:hidden flex items-center gap-3 text-[11px] shrink-0">
              <span className="text-[var(--misaka)] font-semibold">{inStock.length}</span>
              <span className="text-[var(--text-faint)]">/{plans.length}</span>
              <span className="text-[var(--text)] font-medium">${minPrice.toFixed(2)}</span>
            </div>
          </div>
          <div className="px-0 lg:px-0 py-0 lg:py-3.5 flex gap-1.5 flex-wrap">
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
          {/* 桌面端列：最低价 / 有货数 / 更新 */}
          <div className="hidden lg:block px-4 py-3.5 text-[12px] text-[var(--text)] font-medium">
            <span className="text-[var(--text-faint)] text-[10px] mr-0.5">$</span>
            {minPrice.toFixed(2)}
          </div>
          <div className="hidden lg:block px-4 py-3.5 text-[12px]">
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [onlyInStock, setOnlyInStock] = useState(() => searchParams.get("stock") === "1");
  const [continent, setContinent] = useState<string | null>(() => normalizeContinent(searchParams.get("continent")));

  const replaceQuery = (next: { keyword?: string; onlyInStock?: boolean; continent?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextKeyword = next.keyword ?? keyword;
    const nextOnlyInStock = next.onlyInStock ?? onlyInStock;
    const nextContinent = next.continent !== undefined ? next.continent : continent;

    if (nextKeyword.trim()) params.set("q", nextKeyword.trim());
    else params.delete("q");

    if (nextOnlyInStock) params.set("stock", "1");
    else params.delete("stock");

    if (nextContinent) params.set("continent", nextContinent);
    else params.delete("continent");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => replaceQuery({ keyword }), 300);
    return () => window.clearTimeout(timeout);
  }, [keyword]);

  useEffect(() => {
    const source = new EventSource("/api/inventory/stream");
    let lastRefreshAt = 0;
    let refreshTimer: number | null = null;

    const refresh = () => {
      const now = Date.now();
      const elapsed = now - lastRefreshAt;
      if (elapsed >= 1_500) {
        lastRefreshAt = now;
        router.refresh();
        return;
      }
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        lastRefreshAt = Date.now();
        router.refresh();
      }, 1_500 - elapsed);
    };

    source.addEventListener("change", refresh);
    source.addEventListener("available", refresh);
    source.onerror = (event) => console.warn("[inventory] SSE connection error", event);

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [router]);

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

  const exportCsv = () => {
    const header = [
      "region_id",
      "country",
      "continent",
      "plan_name",
      "plan_id",
      "price_monthly",
      "vcores",
      "memory_mb",
      "disk_mb",
      "transfer_mb",
      "available",
      "updated_at",
    ];
    const body = filteredRows.flatMap((row) =>
      row.plans.map((plan) =>
        [
          row.region.id,
          row.region.country,
          row.region.continent ?? "",
          plan.planName,
          plan.planId,
          plan.priceMonthly,
          plan.vcores,
          plan.memoryMb,
          plan.diskMb,
          plan.transferMb,
          plan.available,
          plan.updatedAt,
        ]
          .map(formatCsvValue)
          .join(",")
      )
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = formatInventoryFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (

    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 fade-up">
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
        <StatCard label="活跃任务" value={stats.activeTasks} unit="个" delta={`${stats.enabledTasks} 启用中`} deltaTone="neutral" />
        <StatCard label="今日下单" value={stats.todayOrders} unit="单" delta={stats.todayOrders > 0 ? `今日已下 ${stats.todayOrders} 单` : "今日尚无订单"} deltaTone="neutral" />
      </div>

      <div className="fade-up" style={{ animationDelay: "80ms" }}>
        <Card className="px-4 py-4">
        <div className="flex flex-col xl:grid xl:grid-cols-[minmax(220px,1fr)_auto] xl:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索国家 / 区域 ID / 城市 / 机房"
              className="h-9 w-full sm:min-w-[280px] sm:w-auto flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 font-mono text-[12px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--misaka)]"
            />
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)]">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(event) => {
                  setOnlyInStock(event.target.checked);
                  replaceQuery({ onlyInStock: event.target.checked });
                }}
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
                  onClick={() => {
                    setContinent(tab.value);
                    replaceQuery({ continent: tab.value });
                  }}
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
              <Button variant="ghost" onClick={exportCsv}><Download className="w-3.5 h-3.5" /> 导出 CSV</Button>
              <Link href="/tasks/new"><Button variant="primary">+ 新建任务</Button></Link>
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
