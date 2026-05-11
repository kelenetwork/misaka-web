"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertCircle, ArrowRight, Save, Trash2 } from "lucide-react";
import { flagOf, fmtPrice, fmtMb } from "@/lib/util/format";

type Account = { id: string; label: string; email: string };
type Region = { id: string; name: string; country: string; countryCode: string; continent: string | null };
type Plan = { region: string; planId: number; planName: string; planSlug: string; priceMonthly: number; vcores: number; memoryMb: number; diskMb: number; available: boolean };

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const planList = useMemo(
    () => plans.filter((p) => p.region === form.region).sort((a, b) => a.priceMonthly - b.priceMonthly),
    [plans, form.region]
  );
  const continents = useMemo(
    () => Array.from(new Set(regions.map((r) => r.continent ?? "其它"))),
    [regions]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.region || !form.planId) { setError("请选择区域和机型"); return; }
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

  async function destroy() {
    if (!initial?.id || !confirm("确认删除该任务？")) return;
    setBusy(true);
    const res = await fetch(`/api/tasks/${initial.id}`, { method: "DELETE" });
    if (res.ok) { router.push("/tasks"); router.refresh(); }
    else setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Card className="px-6 py-5">
        <div className="grid gap-5">
          {/* 名称 */}
          <Field label="任务名称" hint="例如：6 刀西雅图、亚洲低价随便抢">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="给这个任务起个好记的名字" />
          </Field>

          {/* 账号 */}
          <Field label="下单账号">
            <select
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="font-mono"
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label} ({a.email})</option>
              ))}
            </select>
          </Field>

          {/* 区域 */}
          <Field label="区域">
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value, planId: 0 })}
              className="font-mono"
              required
            >
              <option value="">— 选择区域 —</option>
              {continents.map((cont) => (
                <optgroup key={cont} label={cont}>
                  {regions.filter((r) => (r.continent ?? "其它") === cont).map((r) => (
                    <option key={r.id} value={r.id}>{flagOf(r.countryCode)} {r.country} · {r.id}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          {/* 机型 */}
          {form.region && (
            <Field label="机型" hint={`${planList.length} 个机型 · 标 ✓ 表示当前有货`}>
              <div className="grid grid-cols-2 gap-2 fade-up">
                {planList.map((p) => (
                  <label
                    key={p.planId}
                    className={[
                      "border rounded-md px-3 py-2.5 cursor-pointer transition-colors flex items-start gap-2.5",
                      form.planId === p.planId
                        ? "border-[var(--misaka)] bg-[var(--misaka-dim)]/40"
                        : "border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--bg-elev-2)]",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={p.planId}
                      checked={form.planId === p.planId}
                      onChange={() => setForm({ ...form, planId: p.planId, maxPrice: Math.max(form.maxPrice, p.priceMonthly) })}
                      className="mt-1 w-auto"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[12px]">{p.planName}</span>
                        {p.available && <span className="text-[10px] text-[var(--misaka)]">●</span>}
                      </div>
                      <div className="text-[10.5px] text-[var(--text-dim)] mt-0.5">
                        {p.vcores}C / {fmtMb(p.memoryMb)} / {fmtMb(p.diskMb)} · <span className="text-[var(--misaka)]">{fmtPrice(p.priceMonthly)}/mo</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {/* 价格上限 / 目标数量 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="价格上限 (USD/月)" hint="实际价超过此值不下单">
              <input type="number" min="0" step="0.01" required value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: Number(e.target.value) })} className="font-mono" />
            </Field>
            <Field label="目标数量" hint="达到后自动停止">
              <input type="number" min="1" step="1" required value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: Number(e.target.value) })} className="font-mono" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="镜像">
              <select value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="font-mono">
                <option value="debian-12">debian-12</option>
                <option value="debian-11">debian-11</option>
                <option value="ubuntu-24.04">ubuntu-24.04</option>
                <option value="ubuntu-22.04">ubuntu-22.04</option>
                <option value="centos-stream-9">centos-stream-9</option>
                <option value="rocky-9">rocky-9</option>
              </select>
            </Field>
            <Field label="计费周期">
              <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className="font-mono">
                <option value="monthly">月付</option>
                <option value="semiannual">半年付</option>
                <option value="annual">年付</option>
              </select>
            </Field>
          </div>

          <Field label="优惠码（可选）">
            <input value={form.coupon ?? ""} onChange={(e) => setForm({ ...form, coupon: e.target.value })} placeholder="留空则不使用" />
          </Field>

          <div className="flex items-center gap-6 text-[12px] pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-auto" />
              <span>立即启用</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.stopAfterTarget} onChange={(e) => setForm({ ...form, stopAfterTarget: e.target.checked })} className="w-auto" />
              <span>达成数量后自动停止</span>
            </label>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[12px]">
          <AlertCircle className="w-4 h-4 mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {mode === "edit" ? <><Save className="w-3.5 h-3.5" /> 保存修改</> : <><ArrowRight className="w-3.5 h-3.5" /> 创建任务</>}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="danger" disabled={busy} onClick={destroy}>
            <Trash2 className="w-3.5 h-3.5" /> 删除任务
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={busy} onClick={() => router.push("/tasks")}>取消</Button>
      </div>
    </form>
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
