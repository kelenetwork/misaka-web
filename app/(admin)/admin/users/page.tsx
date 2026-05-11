import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { fmtRelative } from "@/lib/util/format";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") redirect("/inventory");

  const all = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <AppShell user={me}>
      <Topbar crumb="管理 /" title="用户 / 系统" />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1">
        <SectionHead title="所有用户" count={`${all.length} 个`} actions={<CreateUserDialog />} />

        <Card>
          <div className="hidden lg:grid grid-cols-[1fr_180px_120px_110px_110px_120px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
            <div className="px-4 py-3">用户 / 邮箱</div>
            <div className="px-4 py-3">注册时间</div>
            <div className="px-4 py-3">Telegram</div>
            <div className="px-4 py-3">角色</div>
            <div className="px-4 py-3">状态</div>
            <div className="px-4 py-3 text-right">ID</div>
          </div>
          {all.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 lg:gap-0 lg:grid lg:grid-cols-[1fr_180px_120px_110px_110px_120px] border-t border-[var(--border)] lg:items-center hover:bg-[var(--bg-elev-2)] transition-colors p-3 lg:p-0">
              <div className="lg:px-4 lg:py-3.5">
                <div className="font-serif-italic text-[17px]">{u.username ?? u.name ?? u.email}</div>
                <div className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5">{u.email}</div>
              </div>
              <div className="lg:px-4 lg:py-3.5 text-[11px] text-[var(--text-dim)] font-mono">{fmtRelative(u.createdAt)}</div>
              <div className="lg:px-4 lg:py-3.5 text-[11px] font-mono text-[var(--text-dim)]">{u.telegramUserId ?? "—"}</div>
              <div className="lg:px-4 lg:py-3.5">
                {u.role === "admin" ? <StatusBadge tone="primary">ADMIN</StatusBadge> : <StatusBadge tone="muted">USER</StatusBadge>}
              </div>
              <div className="lg:px-4 lg:py-3.5">
                {u.status === "active" ? <StatusBadge tone="ok">活跃</StatusBadge> : <StatusBadge tone="err">封禁</StatusBadge>}
              </div>
              <div className="lg:px-4 lg:py-3.5 text-[10px] text-[var(--text-faint)] font-mono text-right truncate">{u.id.slice(0, 8)}…</div>
            </div>
          ))}
        </Card>
      </section>
      <Footer />
    </AppShell>
  );
}
