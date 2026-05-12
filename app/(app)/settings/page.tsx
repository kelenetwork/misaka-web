import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fmtRelative } from "@/lib/util/format";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { UpdateProfileForm } from "@/components/settings/UpdateProfileForm";
import { DangerZone } from "@/components/settings/DangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const row = await db.query.users.findFirst({ where: eq(users.id, me.id) });
  if (!row) redirect("/login");

  return (
    <AppShell user={me}>
      <Topbar crumb="账户 /" title="个人设置" />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 flex-1 max-w-3xl">
        <SectionHead title="账户信息" />
        <Card className="px-5 py-5">
          <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-y-3 gap-x-3 text-[12.5px] items-center">
            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">用户名</div>
            <div className="font-mono">{row.username ?? "—"}</div>

            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">邮箱</div>
            <div className="font-mono text-[var(--text-dim)]">{row.email}</div>

            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">角色</div>
            <div>
              {row.role === "admin" ? <StatusBadge tone="primary">ADMIN</StatusBadge> : <StatusBadge tone="muted">USER</StatusBadge>}
            </div>

            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">注册时间</div>
            <div className="text-[var(--text-dim)]">{fmtRelative(row.createdAt)}</div>

            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">Telegram</div>
            <div className="font-mono text-[var(--text-dim)]">{row.telegramUserId ?? "未绑定"}</div>
          </div>
        </Card>

        <SectionHead title="修改资料" />
        <Card className="px-5 py-5">
          <UpdateProfileForm initialUsername={row.username ?? ""} />
        </Card>

        <SectionHead title="修改密码" />
        <Card className="px-5 py-5">
          <ChangePasswordForm />
        </Card>

        <SectionHead title="危险区" />
        <Card className="px-5 py-5 border-[var(--danger)]/30">
          <DangerZone />
        </Card>
      </section>
      <Footer />
    </AppShell>
  );
}
