import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq, gte } from "drizzle-orm";

import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card, StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db/client";
import { applications, auditLogs, orders, tasks, users, workerHealth } from "@/lib/db/schema";
import { fmtRelative } from "@/lib/util/format";
import { ShieldCheck, Users, ListChecks, Receipt, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") redirect("/inventory");

  // 北京当日 0 点
  const tzOffsetMs = 8 * 3600 * 1000;
  const todayStart = new Date(
    Math.floor((Date.now() + tzOffsetMs) / 86400000) * 86400000 - tzOffsetMs,
  );

  const [usersTotal, pendingApps, activeTasksRow, todayOrdersRow] = await Promise.all([
    db.select({ v: count() }).from(users),
    db.select({ v: count() }).from(applications).where(eq(applications.status, "pending")),
    db.select({ v: count() }).from(tasks).where(eq(tasks.enabled, true)),
    db.select({ v: count() }).from(orders).where(gte(orders.createdAt, todayStart)),
  ]);

  const workers = await db.select().from(workerHealth);
  const recentAudit = await db.query.auditLogs.findMany({
    orderBy: desc(auditLogs.createdAt),
    limit: 8,
  });

  return (
    <AppShell user={me}>
      <Topbar crumb="管理 /" title="Admin Dashboard" />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 fade-up">
          <StatCard
            label="注册用户"
            value={usersTotal[0]?.v ?? 0}
            unit="个"
            delta="包含 admin"
            deltaTone="neutral"
          />
          <StatCard
            label="待审申请"
            value={pendingApps[0]?.v ?? 0}
            unit="个"
            delta={pendingApps[0]?.v ? "需要审批" : "无新申请"}
            deltaTone={pendingApps[0]?.v ? "up" : "neutral"}
          />
          <StatCard
            label="启用中任务"
            value={activeTasksRow[0]?.v ?? 0}
            unit="个"
            delta="全平台"
            deltaTone="neutral"
          />
          <StatCard
            label="今日下单"
            value={todayOrdersRow[0]?.v ?? 0}
            unit="单"
            delta="所有用户合计"
            deltaTone="neutral"
          />
        </div>

        <div className="grid gap-3 fade-up" style={{ animationDelay: "80ms" }}>
          <SectionHead title="快捷入口" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href="/admin/applications" className="block">
              <Card className="px-5 py-4 hover:border-[var(--misaka)] transition-colors">
                <ShieldCheck className="w-5 h-5 text-[var(--misaka)] mb-2" />
                <div className="font-serif-italic text-[18px]">申请审批</div>
                <div className="text-[11px] text-[var(--text-dim)] mt-1">
                  {pendingApps[0]?.v ? `${pendingApps[0].v} 个待审申请` : "暂无待审"}
                </div>
              </Card>
            </Link>
            <Link href="/admin/users" className="block">
              <Card className="px-5 py-4 hover:border-[var(--misaka)] transition-colors">
                <Users className="w-5 h-5 text-[var(--misaka)] mb-2" />
                <div className="font-serif-italic text-[18px]">用户 / 系统</div>
                <div className="text-[11px] text-[var(--text-dim)] mt-1">
                  {usersTotal[0]?.v ?? 0} 名注册用户
                </div>
              </Card>
            </Link>
            <Link href="/activity" className="block">
              <Card className="px-5 py-4 hover:border-[var(--misaka)] transition-colors">
                <Activity className="w-5 h-5 text-[var(--misaka)] mb-2" />
                <div className="font-serif-italic text-[18px]">活动时间线</div>
                <div className="text-[11px] text-[var(--text-dim)] mt-1">
                  全平台事件流
                </div>
              </Card>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 fade-up" style={{ animationDelay: "120ms" }}>
          <SectionHead title="Worker 健康" count={`${workers.length} 个监控对象`} />
          {workers.length === 0 ? (
            <Card>
              <div className="px-4 py-6 text-center text-[var(--text-faint)] text-[12px]">
                还没有 worker 心跳数据。inventory poller 启动后约 30 秒会出现。
              </div>
            </Card>
          ) : (
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_120px_140px] gap-2 sm:gap-0 sm:bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                <div className="hidden sm:block px-4 py-3">Worker</div>
                <div className="hidden sm:block px-4 py-3">最近错误</div>
                <div className="hidden sm:block px-4 py-3">连续失败</div>
                <div className="hidden sm:block px-4 py-3">最近 tick</div>
              </div>
              {workers.map((w) => {
                const ageSec = Math.floor((Date.now() - w.lastTickAt.getTime()) / 1000);
                const tone =
                  ageSec > 300 || w.consecutiveFailures >= 3 ? "err"
                  : ageSec >= 90 ? "warn"
                  : "ok";
                const label = ageSec > 300 || w.consecutiveFailures >= 3 ? "异常" : ageSec >= 90 ? "延迟" : "正常";
                return (
                  <div key={w.worker} className="flex flex-col sm:grid sm:grid-cols-[180px_1fr_120px_140px] gap-2 sm:gap-0 border-t border-[var(--border)] sm:items-center p-3 sm:p-0">
                    <div className="sm:px-4 sm:py-3 flex items-center justify-between sm:block gap-2">
                      <span className="font-mono text-[12.5px]">{w.worker}</span>
                      <StatusBadge tone={tone}>{label}</StatusBadge>
                    </div>
                    <div className="sm:px-4 sm:py-3 text-[11px] text-[var(--text-dim)] truncate">
                      {w.lastError ?? <span className="text-[var(--text-faint)]">—</span>}
                    </div>
                    <div className="sm:px-4 sm:py-3 text-[11px] font-mono">
                      <span className={w.consecutiveFailures > 0 ? "text-[var(--danger)]" : "text-[var(--text-dim)]"}>
                        {w.consecutiveFailures}
                      </span>
                    </div>
                    <div className="sm:px-4 sm:py-3 text-[11px] text-[var(--text-dim)] font-mono">
                      {fmtRelative(w.lastTickAt)}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <div className="grid gap-3 fade-up" style={{ animationDelay: "160ms" }}>
          <SectionHead title="最近活动" count={`最新 ${recentAudit.length} 条`} actions={<Link href="/activity" className="text-[11px] text-[var(--misaka)] hover:underline">查看全部</Link>} />
          {recentAudit.length === 0 ? (
            <Card>
              <div className="px-4 py-6 text-center text-[var(--text-faint)] text-[12px]">
                暂无活动事件。
              </div>
            </Card>
          ) : (
            <Card>
              {recentAudit.map((l) => (
                <div key={l.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 border-t border-[var(--border)] px-4 py-2.5">
                  <code className="font-mono text-[10.5px] text-[var(--text-faint)] shrink-0 sm:w-[110px]">{fmtRelative(l.createdAt)}</code>
                  <code className="font-mono text-[11px] text-[var(--misaka)] shrink-0 sm:w-[180px]">{l.action}</code>
                  <span className="text-[11.5px] text-[var(--text-dim)] truncate">{l.target}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </AppShell>
  );
}
