import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { registerCommands } from "./commands";

let bot: Bot | null = null;
export function getBot() { return bot; }
export async function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN || bot) return;
  bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
  registerCommands(bot);
  await bot.start({ drop_pending_updates: true });
}
export async function stopTelegramBot() { if (bot) await bot.stop(); bot = null; }

async function sendUserMessage(userId: string, text: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.telegramUserId && bot) await bot.api.sendMessage(user.telegramUserId, text);
}
export async function notifyOrderSuccess(userId: string, name: string, planSlug: string, orderId: number, stripeLink: string, region: string) { await sendUserMessage(userId, `✅ 下单成功 任务=${name} 区域=${region} 机型=${planSlug} 订单=#${orderId} 付款链接：${stripeLink}`); }
export async function notifyOrderFailed(userId: string, name: string, error: string) { await sendUserMessage(userId, `❌ 下单失败 任务=${name} 错误=${error}`); }
export async function notifyAccountCircuitBreaker(userId: string, label: string) { await sendUserMessage(userId, `⚠️ 账号 ${label} 已熔断 30 分钟`); }
