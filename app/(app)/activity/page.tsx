import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar, StatusPill } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { auditLogs, users } from "@/lib/db/schema";
import { and, count, desc, eq, gte, inArray, or, SQL } from "drizzle-orm";
import { fmtRelative, fmtPrice, flagOf } from "@/lib/util/format";
import { Activity } from "lucide-react";
import Link from "next/link";
import { ActivityFilters } from "@/components/activity/ActivityFilters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActionTone = "ok" | "warn" | "err" | "info" | "muted" | "primary";

type ActionMeta = {
  label: string;
  tone: ActionTone;
};

const ACTION_LABELS: Record<string, ActionMeta> = {
  "inventory.available": { label: "上架", tone: "ok" },
  "order.created": { label: "下单", tone: "primary" },
  "order.failed": { label: "失败", tone: "err" },
  "order.paid": { label: "已付", tone: "ok" },
  "application.submitted": { label: "申请", tone: "info" },
  "application.approved": { label: "通过", tone: "ok" },
  "application.rejected": { label: "拒绝", tone: "err" },
  "account.added": { label: "添加账号", tone: "info" },
  "account.removed": { label: "删除账号", tone: "muted" },
  "account.rate_limited": { label: "熔断", tone: "warn" },
  "account.recovered": { label: "恢复", tone: "ok" },
  "user.created": { label: "创建用户", tone: "info" },
  "user.banned": { label: "封禁", tone: "err" },
  "task.auto_paused": { label: "任务暂停", tone: "warn" },
};

const PAGE_SIZE = 50;
const ACTION_FILTERS = ["all", "inventory.available", "order.created", "order.failed", "task.auto_paused"] as const;
const SINCE_FILTERS = ["24h", "7d", "all"] as const;

type ActionFilter = typeof ACTION_FILTERS[number];
type SinceFilter = typeof SINCE_FILTERS[number];

function actionMeta(action: string): ActionMeta {
  return ACTION_LABELS[action] ?? { label: action.replace(".", " · "), tone: "muted" };
}

function detailString(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "";
  if (action === "inventory.available") {
    const region = String(details.regionName ?? details.region ?? "?");
    const flag = flagOf(typeof details.regionCountryCode === "string" ? details.regionCountryCode : "");
    const slug = String(details.planSlug ?? "?");
    const price = typeof details.price === "number" ? fmtPrice(details.price) : "—";
    return `${flag} ${region} · ${slug} · ${price}/mo`;
  }
  if (action === "order.created") {
    return `订单 #${details.orderId ?? "?"}  发票 #${details.invoiceId ?? "?"}`;
  }
  if (action === "order.failed") {
    return String(details.error ?? "未知错误");
  }
  if (action === "application.approved") {
    return `创建用户 ${details.username ?? ""}`;
  }
  if (action === "application.rejected") {
    return String(details.reason ?? "");
  }
  if (action === "account.rate_limited") {
    return `账号 ${details.label ?? details.email ?? "?"} 403 熔断 30 min`;
  }
  // generic
  try { return JSON.stringify(details).slice(0, 200); } catch { return ""; }
}

function validAction(value: string | string[] | undefined): ActionFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return ACTION_FILTERS.includes(raw as ActionFilter) ? raw as ActionFilter : "all";
}

function validSince(value: string | string[] | undefined): SinceFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return SINCE_FILTERS.includes(raw as SinceFilter) ? raw as SinceFilter : "24h";
}

function validPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function sinceDate(since: SinceFilter) {
  if (since === "all") return null;
  const hours = since === "7d" ? 24 * 7 : 24;
  return new Date(Date.now() - hours * 60 * 60_000);
}

function pageHref(page: number, action: ActionFilter, since: SinceFilter) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (action !== "all") params.set("action", action);
  if (since !== "24h") params.set("since", since);
  const query = params.toString();
  return query ? `/activity?${query}` : "/activity";
}

function paginationWindow(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return Array.from(pages).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const action = validAction(params.action);
  const since = validSince(params.since);
  const page = validPage(params.page);
  const filters: SQL[] = [];
  const minDate = sinceDate(since);
  if (minDate) filters.push(gte(auditLogs.createdAt, minDate));
  if (action !== "all") filters.push(eq(auditLogs.action, action));
  if (user.role !== "admin") filters.push(or(eq(auditLogs.action, "inventory.available"), eq(auditLogs.actorId, user.id))!);
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [{ value: total }] = await db.select({ value: count() }).from(auditLogs).where(where);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(PAGE_SIZE).offset((currentPage - 1) * PAGE_SIZE);

  const actorIds = Array.from(new Set(visible.map((l) => l.actorId).filter((v): v is string => !!v)));
  const actorRows = actorIds.length > 0 ? await db.select().from(users).where(inArray(users.id, actorIds)) : [];
  const actorMap = new Map(actorRows.map((u) => [u.id, u.username ?? u.name ?? u.email]));

  const statWhere = user.role === "admin" ? (minDate ? gte(auditLogs.createdAt, minDate) : undefined) : and(minDate ? gte(auditLogs.createdAt, minDate) : undefined, or(eq(auditLogs.action, "inventory.available"), eq(auditLogs.actorId, user.id))!);
  const statLogs = await db.select({ action: auditLogs.action }).from(auditLogs).where(statWhere);
  const stats = {
    total,
    inventory: statLogs.filter((l) => l.action.startsWith("inventory.")).length,
    orders: statLogs.filter((l) => l.action.startsWith("order.")).length,
    incidents: statLogs.filter((l) => l.action.includes("failed") || l.action.includes("rate_limited") || l.action.includes("rejected") || l.action === "task.auto_paused").length,
  };

  const lastUpdate = visible[0]?.createdAt;

  return (
    <AppShell user={user}>
      <Topbar
        crumb="监控 /"
        title="实时活动"
        right={<StatusPill text={lastUpdate ? `最新 · ${fmtRelative(lastUpdate)}` : "暂无活动"} />}
      />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "近 24h 事件", v: stats.total },
            { label: "库存上架", v: stats.inventory, tone: "ok" },
            { label: "下单事件", v: stats.orders, tone: "primary" },
            { label: "异常 / 失败", v: stats.incidents, tone: "err" },
          ].map((s) => (
            <Card key={s.label} className="px-5 py-[18px]">
              <div className="text-[10px] tracking-[0.18em] text-[var(--text-faint)] uppercase mb-2.5">{s.label}</div>
              <div className="font-serif-italic text-[36px] leading-none">{s.v}</div>
            </Card>
          ))}
        </div>

        <SectionHead title="时间线" count={`第 ${currentPage} / ${totalPages} 页 · 共 ${total} 条`} actions={<ActivityFilters action={action} since={since} />} />

        {visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={Activity}
              title="近 24 小时还没有活动"
              desc="库存变化、下单结果、账号事件会出现在这里。等库存有变化（misaka.io 上架机器）或你触发任务即可看到事件流。"
            />
          </Card>
        ) : (
          <Card>
            <div className="hidden lg:grid grid-cols-[100px_88px_1fr_180px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
              <div className="px-4 py-3">时间</div>
              <div className="px-4 py-3">类型</div>
              <div className="px-4 py-3">事件</div>
              <div className="px-4 py-3">操作者</div>
            </div>
            {visible.map((l) => {
              const meta = actionMeta(l.action);
              const actor = l.actorId ? actorMap.get(l.actorId) ?? l.actorId.slice(0, 8) : "system";
              return (
                <div key={l.id} className="flex flex-col gap-2 lg:gap-0 lg:grid lg:grid-cols-[100px_88px_1fr_180px] border-t border-[var(--border)] lg:items-center hover:bg-[var(--bg-elev-2)] transition-colors p-3 lg:p-0">
                  <div className="lg:px-4 lg:py-3 text-[11px] text-[var(--text-dim)] font-mono flex items-center gap-2"><span className="lg:hidden">{fmtRelative(l.createdAt)} · {actor === "system" ? "system" : actor}</span><span className="hidden lg:inline">{fmtRelative(l.createdAt)}</span></div>
                  <div className="lg:px-4 lg:py-3"><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></div>
                  <div className="lg:px-4 lg:py-3 text-[12.5px]">
                    <div className="leading-snug">
                      <span className="text-[var(--text)]">{detailString(l.action, l.details) || l.target}</span>
                    </div>
                    {l.target && l.action !== "inventory.available" && (
                      <div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">{l.target}</div>
                    )}
                  </div>
                  <div className="hidden lg:block lg:px-4 lg:py-3 text-[11px] text-[var(--text-dim)] font-mono">
                    {actor === "system" ? (
                      <span className="text-[var(--text-faint)] italic">system</span>
                    ) : (
                      actor
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
            <Link href={pageHref(Math.max(1, currentPage - 1), action, since)} className={["px-3 py-2 rounded-md border border-[var(--border)]", currentPage === 1 ? "pointer-events-none opacity-40" : "hover:border-[var(--misaka)]"].join(" ")}>上一页</Link>
            {paginationWindow(currentPage, totalPages).map((item, index, arr) => (
              <span key={item} className="flex items-center gap-2">
                {index > 0 && item - arr[index - 1] > 1 && <span className="text-[var(--text-faint)]">...</span>}
                <Link href={pageHref(item, action, since)} className={["min-w-9 px-3 py-2 rounded-md border text-center", item === currentPage ? "border-[var(--misaka)] text-[var(--misaka)] bg-[var(--misaka-dim)]" : "border-[var(--border)] hover:border-[var(--misaka)]"].join(" ")}>{item}</Link>
              </span>
            ))}
            <Link href={pageHref(Math.min(totalPages, currentPage + 1), action, since)} className={["px-3 py-2 rounded-md border border-[var(--border)]", currentPage === totalPages ? "pointer-events-none opacity-40" : "hover:border-[var(--misaka)]"].join(" ")}>下一页</Link>
          </div>
        )}
      </section>
      <Footer />
    </AppShell>
  );
}
