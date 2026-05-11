import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { misakaAccounts, regions, inventorySnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TaskForm } from "@/components/forms/TaskForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const accounts = await db.select().from(misakaAccounts).where(eq(misakaAccounts.userId, user.id));
  const allRegions = await db.select().from(regions).orderBy(regions.continent, regions.name);
  const allPlans = await db.select().from(inventorySnapshots);

  if (accounts.length === 0) {
    return (
      <AppShell user={user}>
        <Topbar crumb="自动化 / 任务 /" title="新建" />
        <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 max-w-2xl">
          <Card className="px-7 py-7">
            <div className="font-serif-italic text-[22px] mb-2">先添加 misaka 账号</div>
            <div className="text-[12px] text-[var(--text-dim)] mb-4 leading-[1.7]">
              新建任务前必须至少有一个 misaka.io 账号绑定。前往{" "}
              <Link href="/accounts" className="text-[var(--misaka)] hover:underline">misaka 账号</Link> 页面添加。
            </div>
          </Card>
        </section>
        <Footer />
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <Topbar crumb="自动化 / 任务 /" title="新建任务" />
      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 max-w-3xl">
        <TaskForm accounts={accounts} regions={allRegions} plans={allPlans} />
      </section>
      <Footer />
    </AppShell>
  );
}
