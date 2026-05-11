import type { Bot } from "grammy";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bindCodes, tasks, users } from "@/lib/db/schema";

function normalizeBindCode(input: string) {
  const compact = input.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length !== 8) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function registerCommands(bot: Bot) {
  bot.command("help", (ctx) => ctx.reply("命令：/start <bind_code> /status /tasks /unbind /help"));
  bot.command("start", async (ctx) => {
    const code = normalizeBindCode(ctx.match?.trim() ?? "");
    if (!code) return ctx.reply("请使用 /start <bind_code> 绑定账号。");

    const bindCode = await db.query.bindCodes.findFirst({
      where: and(isNull(bindCodes.usedAt), gt(bindCodes.expiresAt, new Date()), eq(bindCodes.code, code)),
      with: { user: true },
    });
    if (!bindCode) return ctx.reply("❌ 绑定码无效或已过期，请回 Web 端重新生成");

    const telegramUserId = String(ctx.from?.id ?? "");
    if (!telegramUserId) return ctx.reply("❌ 无法读取 Telegram 用户 ID，请稍后重试");

    await db.transaction((tx) => {
      tx.update(bindCodes).set({ usedAt: new Date() }).where(eq(bindCodes.code, bindCode.code)).run();
      tx.update(users)
        .set({ telegramUserId: null })
        .where(and(eq(users.telegramUserId, telegramUserId), ne(users.id, bindCode.userId)))
        .run();
      tx.update(users).set({ telegramUserId }).where(eq(users.id, bindCode.userId)).run();
    });

    const username = bindCode.user.username ?? bindCode.user.email;
    return ctx.reply(`✅ 已绑定 misaka-web 账号：${username}\n你将自动收到下单结果通知。`);
  });
  bot.command("unbind", async (ctx) => {
    const telegramUserId = String(ctx.from?.id ?? "");
    const user = await db.query.users.findFirst({ where: eq(users.telegramUserId, telegramUserId) });
    if (!user) return ctx.reply("未绑定任何账号");

    await db.update(users).set({ telegramUserId: null }).where(eq(users.id, user.id));
    return ctx.reply("✅ 已解绑");
  });
  bot.command("status", async (ctx) => ctx.reply("misaka-web bot online"));
  bot.command("tasks", async (ctx) => {
    const telegramUserId = String(ctx.from?.id ?? "");
    const user = await db.query.users.findFirst({ where: eq(users.telegramUserId, telegramUserId) });
    if (!user) return ctx.reply("尚未绑定 Web 账号。");
    const list = await db.query.tasks.findMany({ where: eq(tasks.userId, user.id), limit: 5 });
    if (list.length === 0) return ctx.reply("暂无任务。");
    return ctx.reply(list.map((task) => `${task.enabled ? "✅" : "⏸"} ${task.name} ${task.region}/${task.planId} ${task.currentCount}/${task.targetCount}`).join("\n"));
  });
}
