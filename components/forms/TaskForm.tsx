"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowRight, Save, Search, Check } from "lucide-react";
import { flagOf, fmtPrice, fmtMb } from "@/lib/util/format";

type Account = { id: string; label: string; email: string };
type Region = { id: string; name: string; country: string; countryCode: string; continent: string | null };
type Plan = { region: string; planId: number; planName: string; planSlug: string; priceMonthly: number; vcores: number; memoryMb: number; diskMb: number; transferMb?: number; available: boolean; routingProfile?: string | null };

export type TaskFormInitial = {
  id?: string;
  name?: string;
  accountId?: string;
  region?: string;
  planId?: number;
  maxPrice?: number;
  targetCount?: number;
  image?: string;
  billingCycle?: string;
  coupon?: string | null;
  enabled?: boolean;
  stopAfterTarget?: boolean;
};

export function TaskForm({
  accounts, regions, plans, initial, mode = "create",
}: {
  accounts: Account[];
  regions: Region[];
  plans: Plan[];
  initial?: TaskFormInitial;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    accountId: initial?.accountId ?? accounts[0]?.id ?? "",
    region: initial?.region ?? "",
    planId: initial?.planId ?? 0,
    maxPrice: initial?.maxPrice ?? 10,
    targetCount: initial?.targetCount ?? 1,
    image: initial?.image ?? "debian-12",
    billingCycle: initial?.billingCycle ?? "monthly",
    coupon: initial?.coupon ?? "",
    enabled: initial?.enabled ?? true,
    stopAfterTarget: initial?.stopAfterTarget ?? true,
  });
  const [regionSearch, setRegionSearch] = useState("");
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Region -> plan count + min price + in-stock count for hint badges
  const regionStats = useMemo(() => {
    const map = new Map<string, { total: number; inStock: number; minPrice: number }>();
    for (const p of plans) {
      const r = map.get(p.region) ?? { total: 0, inStock: 0, minPrice: Infinity };
      r.total++;
      if (p.available) r.inStock++;
      if (p.priceMonthly < r.minPrice) r.minPrice = p.priceMonthly;
      map.set(p.region, r);
    }
    return map;
  }, [plans]);

  // Filtered + grouped regions for picker
  const filteredRegions = useMemo(() => {
    const q = regionSearch.trim().toLowerCase();
    let list = regions.filter((r) => regionStats.has(r.id));
    if (q) {
      list = list.filter((r) =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.countryCode.toLowerCase().includes(q)
      );
    }
    // 默认先显示有库存的
    list.sort((a, b) => {
      const sa = regionStats.get(a.id)!;
      const sb = regionStats.get(b.id)!;
      if (!!sb.inStock !== !!sa.inStock) return sb.inStock - sa.inStock;
      return sa.minPrice - sb.minPrice;
    });
    return list;
  }, [regions, regionStats, regionSearch]);

  const planList = useMemo(
    () => plans.filter((p) => p.region === form.region).sort((a, b) => a.priceMonthly - b.priceMonthly),
    [plans, form.region]
  );

  const selectedRegion = regions.find((r) => r.id === form.region);
  const selectedPlan = planList.find((p) => p.planId === form.planId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.region) { setError("请选择区域"); return; }
    if (!form.planId) { setError("请选择机型"); return; }
    setBusy(true);
    try {
      const body = {
        ...form,
        planId: Number(form.planId),
        maxPrice: Number(form.maxPrice),
        targetCount: Number(form.targetCount),
        coupon: form.coupon || null,
      };
      const url = mode === "edit" ? `/api/tasks/${initial!.id}` : "/api/tasks";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? data?.message ?? `失败 (${res.status})`);
        setBusy(false);
        return;
      }
      router.push("/tasks");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {/* === Section 1: Basics === */}
      <Card className="px-5 py-5 sm:px-6">
        <Title>1. 基础</Title>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="任务名称" hint="给这个任务起个好记的名字">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="6 刀西雅图" />
          </Field>
          <Field label="下单账号">
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="font-mono w-full" required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label} — {a.email}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {/* === Section 2: Region === */}
      <Card className="px-5 py-5 sm:px-6">
        <Title>
          2. 区域
          {selectedRegion && (
            <span className="ml-3 text-[12px] font-mono font-normal text-[var(--text-dim)]">
              已选 · <span className="text-[var(--text)]">{flagOf(selectedRegion.countryCode)} {selectedRegion.country} ({selectedRegion.id})</span>
            </span>
          )}
        </Title>

        {/* Search box */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
          <input
            type="text"
            value={regionSearch}
            onChange={(e) => setRegionSearch(e.target.value)}
            placeholder="搜索国家 / 城市 / 区域代码（如 HKG / 香港 / Japan）"
            className="!pl-9"
          />
        </div>

        {/* Region cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {(showAllRegions ? filteredRegions : filteredRegions.slice(0, 12)).map((r) => {
            const stats = regionStats.get(r.id)!;
            const isSelected = form.region === r.id;
            const hasStock = stats.inStock > 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setForm({ ...form, region: r.id, planId: 0 })}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 border rounded-md text-left transition-colors",
                  isSelected
                    ? "border-[var(--misaka)] bg-[var(--misaka-dim)]/40"
                    : "border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--bg-elev-2)]",
                ].join(" ")}
              >
                <span className="text-[24px] leading-none shrink-0">{flagOf(r.countryCode)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-medium text-[12.5px] truncate">{r.country}</span>
                    <span className="text-[10px] text-[var(--text-faint)] font-mono shrink-0">{r.id}</span>
                  </div>
                  <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1.5">
                    {hasStock ? (
                      <span className="text-[var(--misaka)]">● {stats.inStock}/{stats.total} 在售</span>
                    ) : (
                      <span className="text-[var(--text-faint)]">○ 全部缺货</span>
                    )}
                    <span className="text-[var(--text-faint)]">·</span>
                    <span className="text-[var(--text-dim)]">从 {fmtPrice(stats.minPrice)}/mo</span>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[var(--misaka)] shrink-0" />}
              </button>
            );
          })}
        </div>

        {!showAllRegions && filteredRegions.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAllRegions(true)}
            className="text-[11px] text-[var(--text-dim)] hover:text-[var(--misaka)] mt-3 tracking-[0.04em]"
          >
            ↓ 展开剩余 {filteredRegions.length - 12} 个区域
          </button>
        )}

        {filteredRegions.length === 0 && (
          <div className="px-4 py-8 text-center text-[12px] text-[var(--text-faint)]">
            没匹配到。试试 "HK" / "JP" / "us" / "香港" / "japan"
          </div>
        )}
      </Card>

      {/* === Section 3: Plan === */}
      {form.region && (
        <Card className="px-5 py-5 sm:px-6 fade-up">
          <Title>
            3. 机型
            <span className="ml-3 text-[12px] font-mono font-normal text-[var(--text-dim)]">
              {planList.length} 个 · 标 <span className="text-[var(--misaka)]">●</span> = 当前有货
              {selectedPlan && <span className="ml-3">已选 · <span className="text-[var(--text)]">{selectedPlan.planName}</span></span>}
            </span>
          </Title>

          <div className="rounded-md overflow-hidden border border-[var(--border)]">
            {planList.map((p, idx) => {
              const isSelected = form.planId === p.planId;
              return (
                <button
                  key={p.planId}
                  type="button"
                  onClick={() => setForm({ ...form, planId: p.planId, maxPrice: Math.max(form.maxPrice, p.priceMonthly) })}
                  className={[
                    "w-full grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_2fr_1.6fr_auto] gap-3 sm:gap-4 items-center px-3 py-2.5 text-left transition-colors",
                    idx > 0 ? "border-t border-[var(--border)]" : "",
                    isSelected
                      ? "bg-[var(--misaka-dim)]/40"
                      : "bg-[var(--bg-elev-2)] hover:bg-[var(--bg-elev-3)]",
                  ].join(" ")}
                >
                  {/* radio dot */}
                  <span
                    className={[
                      "w-3.5 h-3.5 rounded-full border-2 shrink-0",
                      isSelected ? "border-[var(--misaka)] bg-[var(--misaka)]" : "border-[var(--border-strong)]",
                    ].join(" ")}
                  />
                  {/* name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[13px]">{p.planName}</span>
                      {p.available && <span className="text-[9px] text-[var(--misaka)]">●</span>}
                      {!p.available && <span className="text-[9px] text-[var(--text-faint)]">○ 缺货</span>}
                    </div>
                    <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5 font-mono">
                      {p.routingProfile ?? "—"} · {p.planSlug}
                    </div>
                  </div>
                  {/* specs */}
                  <div className="hidden sm:flex items-center gap-3 text-[11px] text-[var(--text-dim)] font-mono">
                    <Spec label="vCPU" value={`${p.vcores}C`} />
                    <Spec label="RAM" value={fmtMb(p.memoryMb)} />
                    <Spec label="Disk" value={fmtMb(p.diskMb)} />
                    {p.transferMb && <Spec label="Transfer" value={fmtMb(p.transferMb)} />}
                  </div>
                  {/* price */}
                  <div className="text-right shrink-0">
                    <div className="text-[var(--misaka)] font-semibold text-[14px]">{fmtPrice(p.priceMonthly)}</div>
                    <div className="text-[9.5px] text-[var(--text-faint)] tracking-[0.06em]">/ 月</div>
                  </div>
                </button>
              );
            })}
            {planList.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-[var(--text-faint)]">该区域暂无 plans 数据，请稍后再来或换区域。</div>
            )}
          </div>
        </Card>
      )}

      {/* === Section 4: Strategy === */}
      <Card className="px-5 py-5 sm:px-6">
        <Title>4. 策略</Title>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="价格上限 (USD/月)" hint="实际价高于此值不下单">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-faint)]">$</span>
              <input type="number" min="0" step="0.01" required value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: Number(e.target.value) })} className="font-mono !pl-7" />
            </div>
          </Field>
          <Field label="目标数量" hint="达到后自动停止">
            <input type="number" min="1" step="1" required value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: Number(e.target.value) })} className="font-mono" />
          </Field>
          <Field label="镜像">
            <select value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="font-mono w-full">
              <option value="debian-12">debian-12</option>
              <option value="debian-11">debian-11</option>
              <option value="ubuntu-24.04">ubuntu-24.04</option>
              <option value="ubuntu-22.04">ubuntu-22.04</option>
              <option value="centos-stream-9">centos-stream-9</option>
              <option value="rocky-9">rocky-9</option>
            </select>
          </Field>
          <Field label="计费周期">
            <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className="font-mono w-full">
              <option value="monthly">月付</option>
              <option value="semiannual">半年付</option>
              <option value="annual">年付</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="优惠码（可选）">
              <input value={form.coupon ?? ""} onChange={(e) => setForm({ ...form, coupon: e.target.value })} placeholder="留空则不使用" />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] pt-4 mt-4 border-t border-[var(--border)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-auto" />
            <span>立即启用</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.stopAfterTarget} onChange={(e) => setForm({ ...form, stopAfterTarget: e.target.checked })} className="w-auto" />
            <span>达成数量后自动停止</span>
          </label>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[12px]">
          <AlertCircle className="w-4 h-4 mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sticky bottom-0 bg-[rgba(10,10,10,0.85)] backdrop-blur py-3 -mx-5 sm:-mx-6 px-5 sm:px-6 border-t border-[var(--border)]">
        <Button type="submit" variant="primary" disabled={busy}>
          {mode === "edit" ? <><Save className="w-3.5 h-3.5" /> 保存修改</> : <><ArrowRight className="w-3.5 h-3.5" /> 创建任务</>}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => router.push("/tasks")}>取消</Button>
      </div>
    </form>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-serif-italic text-[20px] mb-4 flex items-baseline">
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)] mb-1.5">
        {label}
        {hint && <span className="ml-2 text-[10px] tracking-normal normal-case text-[var(--text-faint)]">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] tracking-[0.12em] uppercase text-[var(--text-faint)]">{label}</div>
      <div className="text-[var(--text)] font-medium">{value}</div>
    </div>
  );
}
