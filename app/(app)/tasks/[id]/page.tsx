import { AppShell, Footer } from "@/components/shell/AppShell";
import { Topbar } from "@/components/shell/Topbar";
import { getCurrentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { tasks, misakaAccounts, regions, inventorySnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TaskForm } from "@/components/forms/TaskForm";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) notFound();
  if (task.userId !== user.id && user.role !== "admin") redirect("/tasks");

  const accounts = await db.select().from(misakaAccounts).where(eq(misakaAccounts.userId, user.id));
  const allRegions = await db.select().from(regions).orderBy(regions.continent, regions.name);
  const allPlans = await db.select().from(inventorySnapshots);

  return (
    <AppShell user={user}>
      <Topbar crumb={`自动化 / 任务 / ${task.name} /`} title="编辑" />
      <section className="px-8 py-7 grid gap-6 max-w-3xl">
        <TaskForm
          accounts={accounts}
          regions={allRegions}
          plans={allPlans}
          mode="edit"
          initial={{
            id: task.id,
            name: task.name,
            accountId: task.accountId,
            region: task.region,
            planId: task.planId,
            maxPrice: task.maxPrice,
            targetCount: task.targetCount,
            image: task.image,
            billingCycle: task.billingCycle,
            coupon: task.coupon,
            enabled: task.enabled,
            stopAfterTarget: task.stopAfterTarget,
          }}
        />
      </section>
      <Footer />
    </AppShell>
  );
}
