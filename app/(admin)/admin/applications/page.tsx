import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { fmtRelative } from "@/lib/util/format";
import { ShieldCheck } from "lucide-react";
import { ApplicationRow } from "@/components/admin/ApplicationRow";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/inventory");

  const pending = await db.select().from(applications).where(eq(applications.status, "pending")).orderBy(desc(applications.createdAt));
  const recentDone = await db.select().from(applications).where(eq(applications.status, "approved")).orderBy(desc(applications.createdAt)).limit(10);
  const recentRejected = await db.select().from(applications).where(eq(applications.status, "rejected")).orderBy(desc(applications.createdAt)).limit(10);

  return (
    <AppShell user={user}>
      <Topbar crumb="管理 /" title="申请审批" />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-7 flex-1">
        <div>
          <SectionHead title="待审核" count={`${pending.length} 个`} />
          <div className="mt-3">
            {pending.length === 0 ? (
              <Card>
                <EmptyState icon={ShieldCheck} title="暂无待审核申请" desc="新用户提交注册申请后会出现在这里。" />
              </Card>
            ) : (
              <Card>
                <div className="hidden lg:grid grid-cols-[160px_1fr_120px_130px_180px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                  <div className="px-4 py-3">提交时间</div>
                  <div className="px-4 py-3">申请人 / 理由</div>
                  <div className="px-4 py-3">来源 IP</div>
                  <div className="px-4 py-3">状态</div>
                  <div className="px-4 py-3 text-right">操作</div>
                </div>
                {pending.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    application={{
                      id: app.id,
                      username: app.username,
                      email: app.email,
                      reason: app.reason,
                      ip: app.ip,
                      createdAt: app.createdAt.toISOString(),
                    }}
                  />
                ))}
              </Card>
            )}
          </div>
        </div>

        {(recentDone.length > 0 || recentRejected.length > 0) && (
          <div>
            <SectionHead title="近期审批记录" count={`通过 ${recentDone.length} · 拒绝 ${recentRejected.length}`} />
            <Card className="mt-3">
              <div className="hidden lg:grid grid-cols-[160px_1fr_120px_120px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                <div className="px-4 py-3">时间</div>
                <div className="px-4 py-3">申请人</div>
                <div className="px-4 py-3">邮箱</div>
                <div className="px-4 py-3">结果</div>
              </div>
              {[...recentDone, ...recentRejected].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 15).map((app) => (
                <div key={app.id} className="grid grid-cols-[160px_1fr_120px_120px] border-t border-[var(--border)] items-center">
                  <div className="px-4 py-3 text-[11px] text-[var(--text-dim)] font-mono">{fmtRelative(app.reviewedAt ?? app.createdAt)}</div>
                  <div className="px-4 py-3 text-[12px] font-medium">{app.username}</div>
                  <div className="px-4 py-3 text-[11px] text-[var(--text-dim)] font-mono">{app.email}</div>
                  <div className="px-4 py-3">
                    {app.status === "approved" && <StatusBadge tone="ok">已通过</StatusBadge>}
                    {app.status === "rejected" && <StatusBadge tone="err">已拒绝</StatusBadge>}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </section>
      <Footer />
    </AppShell>
  );
}
