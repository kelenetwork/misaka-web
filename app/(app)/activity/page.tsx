import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar, StatusPill } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { auditLogs, users, orders } from "@/lib/db/schema";
import { desc, eq, inArray, gte } from "drizzle-orm";
import { fmtRelative, fmtPrice, flagOf } from "@/lib/util/format";
import { Activity, ExternalLink } from "lucide-react";
import Link from "next/link";

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
};

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

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Pull last 24h of audit logs (system + own actor)
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const logs = await db
    .select()
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, since))
    .orderBy(desc(auditLogs.createdAt))
    .limit(300);

  // Resolve actor display names
  const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter((v): v is string => !!v)));
  const actorRows = actorIds.length > 0 ? await db.select().from(users).where(inArray(users.id, actorIds)) : [];
  const actorMap = new Map(actorRows.map((u) => [u.id, u.username ?? u.name ?? u.email]));

  // For user view, scope to:
  // - inventory.* + application.submitted/approved (global)
  // - own actor events (orders, account, telegram, etc.)
  // Admins see everything.
  const visible = logs.filter((l) => {
    if (user.role === "admin") return true;
    if (l.action.startsWith("inventory.")) return true;
    if (l.actorId === user.id) return true;
    return false;
  });

  const stats = {
    total: visible.length,
    inventory: visible.filter((l) => l.action.startsWith("inventory.")).length,
    orders: visible.filter((l) => l.action.startsWith("order.")).length,
    incidents: visible.filter((l) => l.action.includes("failed") || l.action.includes("rate_limited") || l.action.includes("rejected")).length,
  };

  const lastUpdate = visible[0]?.createdAt;

  return (
    <AppShell user={user}>
      <Topbar
        crumb="监控 /"
        title="实时活动"
        right={<StatusPill text={lastUpdate ? `最新 · ${fmtRelative(lastUpdate)}` : "暂无活动"} />}
      />

      <section className="px-8 py-7 grid gap-6 flex-1">
        <div className="grid grid-cols-4 gap-4">
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

        <SectionHead title="时间线" count={`最近 24 小时 · ${visible.length} 条`} />

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
            <div className="grid grid-cols-[100px_88px_1fr_180px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
              <div className="px-4 py-3">时间</div>
              <div className="px-4 py-3">类型</div>
              <div className="px-4 py-3">事件</div>
              <div className="px-4 py-3">操作者</div>
            </div>
            {visible.map((l) => {
              const meta = actionMeta(l.action);
              const actor = l.actorId ? actorMap.get(l.actorId) ?? l.actorId.slice(0, 8) : "system";
              return (
                <div key={l.id} className="grid grid-cols-[100px_88px_1fr_180px] border-t border-[var(--border)] items-center hover:bg-[var(--bg-elev-2)] transition-colors">
                  <div className="px-4 py-3 text-[11px] text-[var(--text-dim)] font-mono">{fmtRelative(l.createdAt)}</div>
                  <div className="px-4 py-3"><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></div>
                  <div className="px-4 py-3 text-[12.5px]">
                    <div className="leading-snug">
                      <span className="text-[var(--text)]">{detailString(l.action, l.details) || l.target}</span>
                    </div>
                    {l.target && l.action !== "inventory.available" && (
                      <div className="text-[10px] text-[var(--text-faint)] mt-0.5 font-mono">{l.target}</div>
                    )}
                  </div>
                  <div className="px-4 py-3 text-[11px] text-[var(--text-dim)] font-mono">
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
      </section>
      <Footer />
    </AppShell>
  );
}
