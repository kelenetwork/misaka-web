import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { tasks, misakaAccounts, regions, inventorySnapshots, orders } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { TaskForm } from "@/components/forms/TaskForm";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { ExternalLink, Receipt } from "lucide-react";
import { fmtPrice, fmtRelative } from "@/lib/util/format";

export const dynamic = "force-dynamic";

function retryText(nextRetryAt: Date | null) {
  if (!nextRetryAt) return null;
  const seconds = Math.max(0, Math.ceil((nextRetryAt.getTime() - Date.now()) / 1000));
  if (seconds <= 0) return "即将重试";
  if (seconds < 60) return `${seconds} 秒后`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟后`;
  return `${Math.ceil(minutes / 60)} 小时后`;
}

function orderStatusBadge(status: string) {
  if (status === "paid") return <StatusBadge tone="primary">已付</StatusBadge>;
  if (status === "created") return <StatusBadge tone="warn">待付</StatusBadge>;
  if (status === "pending") return <StatusBadge tone="info">处理中</StatusBadge>;
  if (status === "failed") return <StatusBadge tone="err">失败</StatusBadge>;
  return null;
}

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) notFound();
  if (task.userId !== user.id && user.role !== "admin") redirect("/tasks");

  const accounts = await db.select().from(misakaAccounts).where(eq(misakaAccounts.userId, task.userId));
  const allRegions = await db.select().from(regions).orderBy(regions.continent, regions.name);
  const allPlans = await db.select().from(inventorySnapshots);
  const taskOrders = await db.select().from(orders).where(eq(orders.taskId, task.id)).orderBy(desc(orders.createdAt)).limit(200);
  const retry = retryText(task.nextRetryAt);

  return (
    <AppShell user={user}>
      <Topbar crumb={`自动化 / 任务 / ${task.name} /`} title="任务详情" />
      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1 max-w-5xl">
        {(task.failureCount > 0 || task.nextRetryAt) && (
          <Card className="px-5 py-4 border-yellow-500/40 bg-yellow-500/10">
            <div className="text-[13px] text-yellow-100">⚠ 连续失败 {task.failureCount} 次{retry ? `，下次重试 ${retry}` : ""}</div>
          </Card>
        )}

        <div className="grid gap-3">
          <SectionHead title="基本信息" count="编辑任务配置" />
          <TaskForm
            accounts={accounts}
            regions={allRegions}
            plans={allPlans}
            mode="edit"
            initial={{
              id: task.id,
              name: task.name,
              accountId: task.accountId,
              region: task.region,
              planId: task.planId,
              maxPrice: task.maxPrice,
              targetCount: task.targetCount,
              image: task.image,
              billingCycle: task.billingCycle,
              coupon: task.coupon,
              enabled: task.enabled,
              stopAfterTarget: task.stopAfterTarget,
            }}
          />
        </div>

        <div className="grid gap-3">
          <SectionHead title="订单历史" count={`显示 ${taskOrders.length} 条`} />
          {taskOrders.length === 0 ? (
            <Card>
              <EmptyState icon={Receipt} title="还没有订单" desc="该任务触发下单后，订单会出现在这里。" />
            </Card>
          ) : (
            <Card>
              <div className="hidden lg:grid grid-cols-[120px_1fr_140px_120px_110px_110px_60px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                <div className="px-4 py-3">时间</div>
                <div className="px-4 py-3">区域 / 机型</div>
                <div className="px-4 py-3">订单号</div>
                <div className="px-4 py-3">发票号</div>
                <div className="px-4 py-3">金额</div>
                <div className="px-4 py-3">状态</div>
                <div className="px-4 py-3 text-right">付款</div>
              </div>
              {taskOrders.map((order) => {
                const statusBadge = orderStatusBadge(order.status);
                return (
                  <div key={order.id} className="flex flex-col gap-2 lg:gap-0 lg:grid lg:grid-cols-[120px_1fr_140px_120px_110px_110px_60px] border-t border-[var(--border)] lg:items-center hover:bg-[var(--bg-elev-2)] transition-colors p-3 lg:p-0">
                    <div className="flex items-start justify-between gap-2 lg:hidden">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{order.regionName} · {order.planSlug}</div>
                        <div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">{order.region}/#{order.planId} · {fmtRelative(order.createdAt)}</div>
                      </div>
                      {statusBadge && <div className="shrink-0">{statusBadge}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] lg:hidden">
                      <span className="font-mono text-[var(--text-dim)]">订单 {order.misakaOrderId ? `#${order.misakaOrderId}` : "—"}</span>
                      <span className="font-mono text-[var(--text-dim)]">发票 {order.invoiceId ? `#${order.invoiceId}` : "—"}</span>
                      <span className="font-medium text-[var(--text)] ml-auto">{fmtPrice(order.price)}</span>
                      {order.stripeLink && <a href={order.stripeLink} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md text-[var(--misaka)] hover:bg-[var(--misaka-dim)] transition-colors" aria-label="付款"><ExternalLink className="w-3.5 h-3.5" /></a>}
                    </div>
                    <div className="hidden lg:block px-4 py-3.5 text-[11px] text-[var(--text-dim)] font-mono">{fmtRelative(order.createdAt)}</div>
                    <div className="hidden lg:block px-4 py-3.5"><div className="text-[12.5px] font-medium">{order.regionName} · {order.planSlug}</div><div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">{order.region}/#{order.planId}</div></div>
                    <div className="hidden lg:block px-4 py-3.5 font-mono text-[12px] text-[var(--text-dim)]">{order.misakaOrderId ? `#${order.misakaOrderId}` : "—"}</div>
                    <div className="hidden lg:block px-4 py-3.5 font-mono text-[12px] text-[var(--text-dim)]">{order.invoiceId ? `#${order.invoiceId}` : "—"}</div>
                    <div className="hidden lg:block px-4 py-3.5 text-[12px] font-medium">{fmtPrice(order.price)}</div>
                    <div className="hidden lg:block px-4 py-3.5">{statusBadge}</div>
                    <div className="hidden lg:block px-4 py-3.5 text-right">{order.stripeLink ? <a href={order.stripeLink} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md text-[var(--misaka)] hover:bg-[var(--misaka-dim)] transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a> : <span className="text-[var(--text-faint)] text-[11px]">—</span>}</div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <div className="grid gap-3">
          <SectionHead title="危险区" count="删除任务及其订单历史" />
          <Card className="px-5 py-5 border-[var(--danger)]/40">
            <div className="grid gap-2 mb-4">
              <div className="font-medium text-[14px]">删除任务</div>
              <div className="text-[12px] text-[var(--text-dim)] leading-[1.7]">删除后该任务无法恢复，并会同时删除该任务关联的订单记录。</div>
            </div>
            <DeleteTaskButton taskId={task.id} taskName={task.name} />
          </Card>
        </div>
      </section>
      <Footer />
    </AppShell>
  );
}
