import { and, eq, gte } from "drizzle-orm";
import { db, sqlite } from "@/lib/db/client";
import { misakaAccounts, orders, tasks } from "@/lib/db/schema";
import { MisakaClient } from "@/lib/misaka/client";
import type { InventoryPlan } from "@/lib/misaka/inventory";
import { logAudit } from "@/lib/audit";
import { notifyOrderFailed, notifyOrderSuccess, notifyTaskAutoPaused } from "@/lib/telegram/bot";

const AUTO_PAUSE_FAILURES = 5;
const MAX_RETRY_DELAY_MS = 60 * 60_000;

export async function runMatchingTasks(plan: InventoryPlan) {
  const matches = await db.query.tasks.findMany({ where: and(eq(tasks.enabled, true), eq(tasks.region, plan.region), eq(tasks.planId, plan.planId), gte(tasks.maxPrice, plan.priceMonthly)) });
  for (const task of matches) await runTask(task.id, plan);
}

export async function runTask(taskId: string, plan: InventoryPlan) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  const now = new Date();
  if (!task || !task.enabled || task.currentCount >= task.targetCount) return;
  if (task.nextRetryAt && task.nextRetryAt > now) return;
  const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, task.accountId) });
  if (!account) return;
  const client = new MisakaClient(account);
  try {
    const result = await client.createInstance({ region: task.region, plan: task.planId, image: task.image, count: 1, keys: task.sshKeys ?? [], billingCycle: task.billingCycle, coupon: task.coupon, name: `${task.region.toLowerCase()}-${task.planId}-${Date.now()}` });
    const primaryOrderId = result.orderIds[0];
    sqlite.transaction(() => {
      const fresh = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
      if (!fresh || fresh.currentCount >= fresh.targetCount) return;
      db.insert(orders).values({ taskId: task.id, userId: task.userId, accountId: task.accountId, region: task.region, planId: task.planId, planSlug: plan.planSlug, regionName: plan.region, price: plan.priceMonthly, misakaOrderId: primaryOrderId, invoiceId: result.invoiceId, stripeLink: result.invoiceUrl, status: "created" }).run();
      const nextCount = fresh.currentCount + 1;
      db.update(tasks).set({ currentCount: nextCount, enabled: fresh.stopAfterTarget && nextCount >= fresh.targetCount ? false : fresh.enabled, failureCount: 0, lastFailureAt: null, nextRetryAt: null, updatedAt: new Date() }).where(eq(tasks.id, taskId)).run();
    })();
    await logAudit(task.userId, "order.created", task.id, { orderIds: result.orderIds, invoiceId: result.invoiceId }, null);
    await notifyOrderSuccess(task.userId, task.name, plan.planSlug, primaryOrderId, result.invoiceId, result.invoiceUrl, task.region);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureAt = new Date();
    const failureCount = task.failureCount + 1;
    const retryDelayMs = Math.min(2 ** (failureCount - 1) * 60_000, MAX_RETRY_DELAY_MS);
    const autoPaused = failureCount >= AUTO_PAUSE_FAILURES;
    await db.insert(orders).values({ taskId: task.id, userId: task.userId, accountId: task.accountId, region: task.region, planId: task.planId, planSlug: plan.planSlug, regionName: plan.region, price: plan.priceMonthly, status: "failed", errorMessage: message });
    await db.update(tasks).set({ failureCount, lastFailureAt: failureAt, nextRetryAt: autoPaused ? null : new Date(failureAt.getTime() + retryDelayMs), enabled: autoPaused ? false : task.enabled, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await logAudit(task.userId, "order.failed", task.id, { error: message }, null);
    await notifyOrderFailed(task.userId, task.name, message);
    if (autoPaused) {
      await logAudit(task.userId, "task.auto_paused", task.id, { failureCount, error: message }, null);
      await notifyTaskAutoPaused(task.userId, task.name, failureCount, message);
    }
  }
}
