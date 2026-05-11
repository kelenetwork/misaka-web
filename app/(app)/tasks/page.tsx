import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { db } from "@/lib/db/client";
import { tasks, misakaAccounts, regions, inventorySnapshots } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { Plus, Edit3, Pause, Play, Trash2, Target } from "lucide-react";
import { flagOf, fmtPrice } from "@/lib/util/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userTasks = await db.select().from(tasks).where(eq(tasks.userId, user.id)).orderBy(tasks.createdAt);
  const userAccounts = await db.select().from(misakaAccounts).where(eq(misakaAccounts.userId, user.id));

  // Resolve region + plan metadata for display
  const regionIds = Array.from(new Set(userTasks.map((t) => t.region)));
  const planIds = Array.from(new Set(userTasks.map((t) => t.planId)));
  const regionRows = regionIds.length > 0 ? await db.select().from(regions).where(inArray(regions.id, regionIds)) : [];
  const planRows = userTasks.length > 0
    ? await Promise.all(userTasks.map((t) =>
        db.select().from(inventorySnapshots).where(and(eq(inventorySnapshots.region, t.region), eq(inventorySnapshots.planId, t.planId))).then(r => r[0])
      ))
    : [];

  const regionMap = new Map(regionRows.map((r) => [r.id, r]));
  const planMap = new Map(planRows.filter(Boolean).map((p) => [`${p!.region}/${p!.planId}`, p!]));
  const accountMap = new Map(userAccounts.map((a) => [a.id, a]));

  const stats = {
    total: userTasks.length,
    running: userTasks.filter((t) => t.enabled).length,
    paused: userTasks.filter((t) => !t.enabled).length,
    completed: userTasks.filter((t) => t.currentCount >= t.targetCount).length,
  };

  return (
    <AppShell user={user}>
      <Topbar
        crumb="自动化 /"
        title="下单任务"
        right={
          <Link href="/tasks/new">
            <Button variant="primary"><Plus className="w-3.5 h-3.5" /> 新建任务</Button>
          </Link>
        }
      />

      <section className="px-8 py-7 grid gap-6 flex-1">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "全部任务", value: stats.total },
            { label: "运行中", value: stats.running, tone: "ok" as const },
            { label: "暂停", value: stats.paused, tone: "muted" as const },
            { label: "已完成", value: stats.completed, tone: "primary" as const },
          ].map((s) => (
            <Card key={s.label} className="px-5 py-[18px]">
              <div className="text-[10px] tracking-[0.18em] text-[var(--text-faint)] uppercase mb-2.5">{s.label}</div>
              <div className="font-serif-italic text-[36px] leading-none">{s.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-3">
          <SectionHead
            title="任务列表"
            count={`${userTasks.length} 个 · 你的`}
          />

          {userTasks.length === 0 ? (
            <Card>
              <EmptyState
                icon={Target}
                title="还没有任务"
                desc={
                  userAccounts.length === 0
                    ? "新建任务前，先去 misaka 账号 页面添加至少一个账号。"
                    : "新建任务后，系统会在你订阅的机型上架时自动下单。"
                }
                action={
                  userAccounts.length === 0 ? (
                    <Link href="/accounts">
                      <Button variant="primary">前往 misaka 账号</Button>
                    </Link>
                  ) : (
                    <Link href="/tasks/new">
                      <Button variant="primary"><Plus className="w-3.5 h-3.5" /> 新建第一个任务</Button>
                    </Link>
                  )
                }
              />
            </Card>
          ) : (
            <Card>
              {/* Header */}
              <div className="grid grid-cols-[1fr_180px_160px_120px_100px_120px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                <div className="px-4 py-3">任务</div>
                <div className="px-4 py-3">区域 / 机型</div>
                <div className="px-4 py-3">账号</div>
                <div className="px-4 py-3">上限 / 进度</div>
                <div className="px-4 py-3">状态</div>
                <div className="px-4 py-3 text-right">操作</div>
              </div>

              {userTasks.map((t) => {
                const region = regionMap.get(t.region);
                const plan = planMap.get(`${t.region}/${t.planId}`);
                const account = accountMap.get(t.accountId);
                const progress = Math.min(100, Math.round((t.currentCount / Math.max(t.targetCount, 1)) * 100));
                const done = t.currentCount >= t.targetCount;
                return (
                  <div key={t.id} className="grid grid-cols-[1fr_180px_160px_120px_100px_120px] border-t border-[var(--border)] items-center hover:bg-[var(--bg-elev-2)] transition-colors">
                    <div className="px-4 py-3.5">
                      <Link href={`/tasks/${t.id}`} className="font-serif-italic text-[18px] hover:text-[var(--misaka)] transition-colors">
                        {t.name}
                      </Link>
                      <div className="text-[10px] text-[var(--text-faint)] tracking-[0.08em] mt-0.5">{t.image} · {t.billingCycle}</div>
                    </div>
                    <div className="px-4 py-3.5 text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px]">{flagOf(region?.countryCode)}</span>
                        <span className="font-medium">{region?.country ?? t.region}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-faint)] tracking-[0.05em] mt-0.5">
                        {plan?.planName ?? `#${t.planId}`}
                      </div>
                    </div>
                    <div className="px-4 py-3.5 text-[12px]">
                      <div className="font-medium truncate">{account?.label ?? "—"}</div>
                      <div className="text-[10px] text-[var(--text-faint)] truncate">{account?.email}</div>
                    </div>
                    <div className="px-4 py-3.5 text-[12px]">
                      <div className="font-medium">≤ {fmtPrice(t.maxPrice)}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1 bg-[var(--bg-elev-3)] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[var(--misaka-dim)] to-[var(--misaka)] rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono shrink-0">{t.currentCount}/{t.targetCount}</span>
                      </div>
                    </div>
                    <div className="px-4 py-3.5">
                      {done ? <StatusBadge tone="primary">已完成</StatusBadge>
                        : t.enabled ? <StatusBadge tone="ok">运行中</StatusBadge>
                        : <StatusBadge tone="muted">暂停</StatusBadge>}
                    </div>
                    <div className="px-4 py-3.5 flex justify-end gap-1">
                      <form action={`/api/tasks/${t.id}/toggle`} method="POST">
                        <button type="submit" className="w-7 h-7 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors" title={t.enabled ? "暂停" : "启动"}>
                          {t.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      </form>
                      <Link href={`/tasks/${t.id}`} className="w-7 h-7 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors" title="编辑">
                        <Edit3 className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </AppShell>
  );
}
