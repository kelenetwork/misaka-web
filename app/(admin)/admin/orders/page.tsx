import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";

import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card, StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db/client";
import { orders, users } from "@/lib/db/schema";
import { fmtRelative, fmtPrice } from "@/lib/util/format";
import { ExternalLink, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<{ page?: string; status?: string; user?: string }>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") redirect("/inventory");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;
  const STATUS_ENUM = ["pending", "created", "paid", "failed"] as const;
  type OrderStatus = (typeof STATUS_ENUM)[number];
  const statusFilter: OrderStatus | null = params.status && params.status !== "all" && (STATUS_ENUM as readonly string[]).includes(params.status)
    ? (params.status as OrderStatus)
    : null;
  const userFilter = params.user && params.user !== "all" ? params.user : null;

  // 用 dynamic where 拼条件
  const whereParts: ReturnType<typeof eq>[] = [];
  if (statusFilter) whereParts.push(eq(orders.status, statusFilter));
  if (userFilter) whereParts.push(eq(orders.userId, userFilter));

  const whereExpr = whereParts.length > 0
    ? whereParts.reduce((acc, e) => sql`${acc} AND ${e}`)
    : undefined;

  const baseQuery = db.select().from(orders);
  const allMatching = whereExpr
    ? await baseQuery.where(whereExpr).orderBy(desc(orders.createdAt)).limit(PAGE_SIZE).offset(offset)
    : await baseQuery.orderBy(desc(orders.createdAt)).limit(PAGE_SIZE).offset(offset);

  const [totalRow] = whereExpr
    ? await db.select({ v: sql<number>`count(*)` }).from(orders).where(whereExpr)
    : await db.select({ v: sql<number>`count(*)` }).from(orders);
  const total = Number(totalRow?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // user 列表（用于映射 userId -> username）
  const allUsers = await db.select({ id: users.id, username: users.username, email: users.email }).from(users);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // 总 stats（不带 filter）
  const [statsRow] = await db.select({
    total: sql<number>`count(*)`,
    paid: sql<number>`sum(case when status='paid' then 1 else 0 end)`,
    created: sql<number>`sum(case when status='created' then 1 else 0 end)`,
    failed: sql<number>`sum(case when status='failed' then 1 else 0 end)`,
  }).from(orders);

  // 过滤选项：所有出现过的 status / user
  const statuses = ["all", "paid", "created", "pending", "failed"] as const;

  return (
    <AppShell user={me}>
      <Topbar crumb="管理 /" title="全平台订单" />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 fade-up">
          <StatCard label="总订单" value={Number(statsRow?.total ?? 0)} unit="单" delta="全平台" deltaTone="neutral" />
          <StatCard label="已付" value={Number(statsRow?.paid ?? 0)} unit="单" delta="paid" deltaTone="up" />
          <StatCard label="待付" value={Number(statsRow?.created ?? 0)} unit="单" delta="created" deltaTone="neutral" />
          <StatCard label="失败" value={Number(statsRow?.failed ?? 0)} unit="单" delta="failed" deltaTone="down" />
        </div>

        <div className="grid gap-3 fade-up" style={{ animationDelay: "80ms" }}>
          <SectionHead
            title="订单列表"
            count={`${total} 单 · 第 ${page}/${totalPages} 页`}
            actions={
              <form className="flex gap-2" method="GET">
                <select name="status" defaultValue={statusFilter ?? "all"} className="font-mono text-[11px] h-8">
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s === "all" ? "全部状态" : s}</option>
                  ))}
                </select>
                <select name="user" defaultValue={userFilter ?? "all"} className="font-mono text-[11px] h-8 max-w-[180px]">
                  <option value="all">全部用户</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.username ?? u.email}</option>
                  ))}
                </select>
                <button type="submit" className="text-[11px] px-3 h-8 border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)]">
                  筛选
                </button>
              </form>
            }
          />

          {allMatching.length === 0 ? (
            <Card>
              <EmptyState icon={Receipt} title="没有匹配的订单" desc="试试调整筛选条件。" />
            </Card>
          ) : (
            <Card>
              <div className="hidden lg:grid grid-cols-[120px_140px_1fr_120px_110px_100px_60px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
                <div className="px-4 py-3">时间</div>
                <div className="px-4 py-3">用户</div>
                <div className="px-4 py-3">区域 / 机型 · 订单</div>
                <div className="px-4 py-3">发票号</div>
                <div className="px-4 py-3">金额</div>
                <div className="px-4 py-3">状态</div>
                <div className="px-4 py-3 text-right">付款</div>
              </div>

              {allMatching.map((o) => {
                const owner = userMap.get(o.userId);
                const statusBadge =
                  o.status === "paid" ? <StatusBadge tone="primary">已付</StatusBadge>
                  : o.status === "created" ? <StatusBadge tone="warn">待付</StatusBadge>
                  : o.status === "pending" ? <StatusBadge tone="info">处理中</StatusBadge>
                  : o.status === "failed" ? <StatusBadge tone="err">失败</StatusBadge>
                  : null;

                return (
                  <div
                    key={o.id}
                    className="flex flex-col gap-2 lg:gap-0 lg:grid lg:grid-cols-[120px_140px_1fr_120px_110px_100px_60px] border-t border-[var(--border)] lg:items-center hover:bg-[var(--bg-elev-2)] transition-colors p-3 lg:p-0"
                  >
                    <div className="flex items-start justify-between gap-2 lg:hidden">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{o.regionName} · {o.planSlug}</div>
                        <div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">
                          {owner?.username ?? owner?.email ?? "(已删除)"} · {fmtRelative(o.createdAt)}
                        </div>
                      </div>
                      {statusBadge && <div className="shrink-0">{statusBadge}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] lg:hidden">
                      <span className="font-mono text-[var(--text-dim)]">订单 {o.misakaOrderId ? `#${o.misakaOrderId}` : "—"}</span>
                      <span className="font-mono text-[var(--text-dim)]">发票 {o.invoiceId ? `#${o.invoiceId}` : "—"}</span>
                      <span className="font-medium text-[var(--text)] ml-auto">{fmtPrice(o.price)}</span>
                      {o.stripeLink && (
                        <a href={o.stripeLink} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md text-[var(--misaka)] hover:bg-[var(--misaka-dim)] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* 桌面列 */}
                    <div className="hidden lg:block px-4 py-3.5 text-[11px] text-[var(--text-dim)] font-mono">{fmtRelative(o.createdAt)}</div>
                    <div className="hidden lg:block px-4 py-3.5 text-[11.5px]">
                      <div className="font-medium truncate">{owner?.username ?? owner?.email ?? "(已删除)"}</div>
                      <div className="text-[10px] text-[var(--text-faint)] truncate">{owner?.email}</div>
                    </div>
                    <div className="hidden lg:block px-4 py-3.5">
                      <div className="text-[12.5px] font-medium">{o.regionName} · {o.planSlug}</div>
                      <div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">{o.region}/#{o.planId} · 订单 {o.misakaOrderId ? `#${o.misakaOrderId}` : "—"}</div>
                    </div>
                    <div className="hidden lg:block px-4 py-3.5 font-mono text-[12px] text-[var(--text-dim)]">{o.invoiceId ? `#${o.invoiceId}` : "—"}</div>
                    <div className="hidden lg:block px-4 py-3.5 text-[12px] font-medium">{fmtPrice(o.price)}</div>
                    <div className="hidden lg:block px-4 py-3.5">{statusBadge}</div>
                    <div className="hidden lg:block px-4 py-3.5 text-right">
                      {o.stripeLink ? (
                        <a href={o.stripeLink} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-7 h-7 border border-[var(--border)] rounded-md text-[var(--misaka)] hover:bg-[var(--misaka-dim)] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : <span className="text-[var(--text-faint)] text-[11px]">—</span>}
                    </div>
                  </div>
                );
              })}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between text-[11px]">
                  <div className="text-[var(--text-dim)]">第 {page} / {totalPages} 页 · 共 {total} 单</div>
                  <div className="flex items-center gap-2">
                    {page > 1 && (
                      <Link
                        href={{ pathname: "/admin/orders", query: { ...params, page: String(page - 1) } }}
                        className="px-3 h-7 border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:border-[var(--misaka)] hover:text-[var(--misaka)] inline-flex items-center"
                      >
                        ← 上一页
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href={{ pathname: "/admin/orders", query: { ...params, page: String(page + 1) } }}
                        className="px-3 h-7 border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:border-[var(--misaka)] hover:text-[var(--misaka)] inline-flex items-center"
                      >
                        下一页 →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </AppShell>
  );
}
