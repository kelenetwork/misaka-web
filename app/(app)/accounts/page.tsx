import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { SectionHead } from "@/components/ui/SectionHead";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import { fmtRelative } from "@/lib/util/format";
import { AccountsList } from "@/components/accounts/AccountsList";
import { AddAccountForm } from "@/components/accounts/AddAccountForm";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const accounts = await db.select().from(misakaAccounts).where(eq(misakaAccounts.userId, user.id));

  return (
    <AppShell user={user}>
      <Topbar crumb="账户 /" title="misaka 账号" />

      <section className="px-8 py-7 grid gap-6 flex-1">
        <SectionHead
          title="账号管理"
          count={`${accounts.length} 个 · 密码 AES-256-GCM 加密存储`}
        />

        <div className="grid grid-cols-[1fr_400px] gap-6">
          {/* 左：账号列表 */}
          <div className="grid gap-3">
            {accounts.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Users}
                  title="还没有 misaka 账号"
                  desc="添加你的 misaka.io 账号后才能创建下单任务。账号密码使用 AES-256-GCM 加密保存，仅在下单时解密用于登录 misaka.io。"
                />
              </Card>
            ) : (
              <AccountsList accounts={accounts.map((a) => ({
                id: a.id,
                label: a.label,
                email: a.email,
                status: a.status,
                lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
                rateLimitedUntil: a.rateLimitedUntil ? a.rateLimitedUntil.toISOString() : null,
              }))} />
            )}
          </div>

          {/* 右：新增表单 */}
          <div>
            <Card className="px-5 py-5 sticky top-24">
              <div className="font-serif-italic text-[20px] mb-1">添加账号</div>
              <div className="text-[11.5px] text-[var(--text-dim)] mb-4 leading-[1.7]">
                填入你 misaka.io 的登录凭据。提交后密码会立即加密，原文不入库。
              </div>
              <AddAccountForm />
            </Card>
          </div>
        </div>
      </section>
      <Footer />
    </AppShell>
  );
}
