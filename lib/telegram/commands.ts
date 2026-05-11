import type { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks, users } from "@/lib/db/schema";

export function registerCommands(bot: Bot) {
  bot.command("help", (ctx) => ctx.reply("命令：/start <bind_code> /status /tasks /help"));
  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim();
    if (!code) return ctx.reply("请使用 /start <bind_code> 绑定账号。");
    await ctx.reply("绑定码接口已预留，Web 端生成 bind_code 后启用。");
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
