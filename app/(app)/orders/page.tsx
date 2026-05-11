import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Receipt, ExternalLink } from "lucide-react";
import { flagOf, fmtPrice, fmtRelative } from "@/lib/util/format";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const list = await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(200);

  const stats = {
    total: list.length,
    paid: list.filter((o) => o.status === "paid").length,
    created: list.filter((o) => o.status === "created").length,
    failed: list.filter((o) => o.status === "failed").length,
  };

  return (
    <AppShell user={user}>
      <Topbar crumb="自动化 /" title="订单历史" />

      <section className="px-8 py-7 grid gap-6 flex-1">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "总单数", v: stats.total },
            { label: "已付款", v: stats.paid, tone: "ok" },
            { label: "待付款", v: stats.created, tone: "warn" },
            { label: "失败", v: stats.failed, tone: "err" },
          ].map((s) => (
            <Card key={s.label} className="px-5 py-[18px]">
              <div className="text-[10px] tracking-[0.18em] text-[var(--text-faint)] uppercase mb-2.5">{s.label}</div>
              <div className="font-serif-italic text-[36px] leading-none">{s.v}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-3">
          <SectionHead title="近期订单" count={`显示最新 ${list.length} / 最多 200`} />

          {list.length === 0 ? (
            <Card>
              <EmptyState
                icon={Receipt}
                title="还没有订单"
                desc="当你的任务命中库存触发下单后，订单会出现在这里。"
              />
            </Card>
          ) : (
            <Card>
              <div className="grid grid-cols-[120px_1fr_140px_120px_110px_110px_60px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                <div className="px-4 py-3">时间</div>
                <div className="px-4 py-3">区域 / 机型</div>
                <div className="px-4 py-3">订单号</div>
                <div className="px-4 py-3">发票号</div>
                <div className="px-4 py-3">金额</div>
                <div className="px-4 py-3">状态</div>
                <div className="px-4 py-3 text-right">付款</div>
              </div>
              {list.map((o) => (
                <div key={o.id} className="grid grid-cols-[120px_1fr_140px_120px_110px_110px_60px] border-t border-[var(--border)] items-center hover:bg-[var(--bg-elev-2)] transition-colors">
                  <div className="px-4 py-3.5 text-[11px] text-[var(--text-dim)] font-mono">
                    {fmtRelative(o.createdAt)}
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[12.5px] font-medium">{o.regionName} · {o.planSlug}</div>
                    <div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">{o.region}/#{o.planId}</div>
                  </div>
                  <div className="px-4 py-3.5 font-mono text-[12px] text-[var(--text-dim)]">
                    {o.misakaOrderId ? `#${o.misakaOrderId}` : "—"}
                  </div>
                  <div className="px-4 py-3.5 font-mono text-[12px] text-[var(--text-dim)]">
                    {o.invoiceId ? `#${o.invoiceId}` : "—"}
                  </div>
                  <div className="px-4 py-3.5 text-[12px] font-medium">
                    {fmtPrice(o.price)}
                  </div>
                  <div className="px-4 py-3.5">
                    {o.status === "paid" && <StatusBadge tone="primary">已付</StatusBadge>}
                    {o.status === "created" && <StatusBadge tone="warn">待付</StatusBadge>}
                    {o.status === "pending" && <StatusBadge tone="info">处理中</StatusBadge>}
                    {o.status === "failed" && <StatusBadge tone="err">失败</StatusBadge>}
                  </div>
                  <div className="px-4 py-3.5 text-right">
                    {o.stripeLink ? (
                      <a href={o.stripeLink} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md text-[var(--misaka)] hover:bg-[var(--misaka-dim)] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : <span className="text-[var(--text-faint)] text-[11px]">—</span>}
                  </div>
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
