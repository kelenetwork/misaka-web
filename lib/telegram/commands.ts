import type { Bot, Context } from "grammy";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bindCodes, misakaAccounts, orders, tasks, users } from "@/lib/db/schema";
import { MisakaClient } from "@/lib/misaka/client";
import { escHtml } from "./bot";

function normalizeBindCode(input: string) {
  const compact = input.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length !== 8) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

/** 拿当前 Telegram 用户绑定的 Web user，未绑定返回 null。 */
async function currentUser(ctx: Context) {
  const telegramUserId = String(ctx.from?.id ?? "");
  if (!telegramUserId) return null;
  return db.query.users.findFirst({ where: eq(users.telegramUserId, telegramUserId) });
}

const NOT_BOUND =
  "尚未绑定 Web 账号。请在 Web 端 → Telegram 绑定 页面生成绑定码后用 <code>/start &lt;绑定码&gt;</code>。";

async function replyHtml(ctx: Context, text: string, opts: { disablePreview?: boolean } = {}) {
  await ctx.reply(text, {
    parse_mode: "HTML",
    link_preview_options: opts.disablePreview ? { is_disabled: true } : undefined,
  });
}

/** 用 try/catch 包一层，让命令 handler 抛错时打 log 而不是被 grammy 吞掉。 */
function safeCommand(
  bot: Bot,
  cmd: string,
  handler: (ctx: Context) => Promise<unknown> | unknown,
) {
  bot.command(cmd, async (ctx) => {
    try {
      await handler(ctx);
    } catch (err) {
      console.error(`[telegram] /${cmd} handler failed:`, err instanceof Error ? err.stack ?? err.message : err);
      try {
        await ctx.reply("❌ 命令执行出错，详情请联系管理员查看 docker logs。");
      } catch {}
    }
  });
}

export function registerCommands(bot: Bot) {
  // /help
  safeCommand(bot, "help", (ctx) =>
    replyHtml(
      ctx,
      [
        "<b>misaka-web bot 命令</b>",
        "",
        "<code>/start &lt;绑定码&gt;</code>   绑定 Web 账号",
        "<code>/status</code>                 检查 bot 在线",
        "<code>/tasks</code>                  查看我的下单任务",
        "<code>/orders</code>                 查看最近 5 笔订单",
        "<code>/balance</code>                查看 misaka.io 账号余额",
        "<code>/pause &lt;任务&gt;</code>     暂停指定任务",
        "<code>/resume &lt;任务&gt;</code>    启用指定任务",
        "<code>/unbind</code>                 解除当前 Telegram 绑定",
        "",
        "任务参数支持任务 ID 前缀或任务名。",
      ].join("\n"),
    ),
  );

  // /start
  safeCommand(bot, "start", async (ctx) => {
    const code = normalizeBindCode((typeof ctx.match === "string" ? ctx.match : "").trim() ?? "");
    if (!code) {
      return replyHtml(
        ctx,
        "请使用 <code>/start &lt;绑定码&gt;</code> 绑定账号。\n绑定码格式 <code>XXXX-XXXX</code>，在 Web 端 → Telegram 绑定 页面生成。",
      );
    }

    const bindCode = await db.query.bindCodes.findFirst({
      where: and(isNull(bindCodes.usedAt), gt(bindCodes.expiresAt, new Date()), eq(bindCodes.code, code)),
      with: { user: true },
    });
    if (!bindCode) return replyHtml(ctx, "❌ <b>绑定码无效或已过期</b>\n请回 Web 端重新生成。");

    const telegramUserId = String(ctx.from?.id ?? "");
    if (!telegramUserId) return ctx.reply("❌ 无法读取 Telegram 用户 ID，请稍后重试。");

    await db.transaction((tx) => {
      tx.update(bindCodes).set({ usedAt: new Date() }).where(eq(bindCodes.code, bindCode.code)).run();
      tx.update(users)
        .set({ telegramUserId: null })
        .where(and(eq(users.telegramUserId, telegramUserId), ne(users.id, bindCode.userId)))
        .run();
      tx.update(users).set({ telegramUserId }).where(eq(users.id, bindCode.userId)).run();
    });

    const username = bindCode.user.username ?? bindCode.user.email;
    return replyHtml(
      ctx,
      [
        "✅ <b>已绑定 misaka-web 账号</b>",
        "",
        `<b>账号</b>    ${escHtml(username)}`,
        "",
        "你将自动收到下单结果通知。",
      ].join("\n"),
    );
  });

  // /unbind
  safeCommand(bot, "unbind", async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return replyHtml(ctx, "未绑定任何账号。");
    await db.update(users).set({ telegramUserId: null }).where(eq(users.id, user.id));
    return replyHtml(ctx, "✅ <b>已解绑</b>");
  });

  // /status
  safeCommand(bot, "status", (ctx) => replyHtml(ctx, "🟢 <b>misaka-web bot online</b>"));

  // /tasks
  safeCommand(bot, "tasks", async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return replyHtml(ctx, NOT_BOUND);
    const list = await db.query.tasks.findMany({
      where: eq(tasks.userId, user.id),
      orderBy: desc(tasks.createdAt),
      limit: 10,
    });
    if (list.length === 0) {
      return replyHtml(ctx, "📋 暂无任务。\n请到 Web 端 <b>下单任务 → 新建任务</b>。");
    }
    const rows = list.map((t) => {
      const icon = t.enabled ? "✅" : "⏸";
      const progress = `${t.currentCount}/${t.targetCount}`;
      return `${icon}  <b>${escHtml(t.name)}</b>  <code>${escHtml(t.region)}/${escHtml(t.planId)}</code>  ${escHtml(progress)}  <code>${escHtml(t.id.slice(0, 8))}</code>`;
    });
    return replyHtml(ctx, ["📋 <b>我的任务</b>", "", ...rows].join("\n"));
  });

  // /orders
  safeCommand(bot, "orders", async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return replyHtml(ctx, NOT_BOUND);
    const list = await db.query.orders.findMany({
      where: eq(orders.userId, user.id),
      orderBy: desc(orders.createdAt),
      limit: 5,
    });
    if (list.length === 0) {
      return replyHtml(ctx, "🧾 暂无订单。\n任务命中库存触发下单后会出现在这里。");
    }
    const rows = list.map((o) => {
      const statusIcon =
        o.status === "paid" ? "💚"
          : o.status === "created" ? "🟡"
          : o.status === "pending" ? "🟦"
          : o.status === "failed" ? "🔴"
          : "⚪";
      const order = o.misakaOrderId ? `#${o.misakaOrderId}` : "—";
      const invoice = o.invoiceId ? `#${o.invoiceId}` : "—";
      return `${statusIcon}  <code>${escHtml(o.region)}</code> · ${escHtml(o.planSlug)}  订单 <code>${escHtml(order)}</code>  发票 <code>${escHtml(invoice)}</code>`;
    });
    return replyHtml(ctx, ["🧾 <b>最近 5 笔订单</b>", "", ...rows].join("\n"));
  });

  // /balance
  safeCommand(bot, "balance", async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return replyHtml(ctx, NOT_BOUND);
    const accounts = await db.query.misakaAccounts.findMany({ where: eq(misakaAccounts.userId, user.id) });
    if (accounts.length === 0) {
      return replyHtml(ctx, "💰 你还没有 misaka 账号。\n请到 Web 端 <b>misaka 账号</b> 页面添加。");
    }
    const lines: string[] = ["💰 <b>misaka.io 余额</b>", ""];
    for (const account of accounts) {
      try {
        const client = new MisakaClient(account);
        const balance = (await client.getBalance()) as {
          balance?: number | string;
          unbilled_charges?: number | string;
          promotional_credits?: number | string;
        };
        const fmt = (v: unknown) =>
          typeof v === "number" ? `$${v.toFixed(2)}` : `$${escHtml(String(v ?? 0))}`;
        lines.push(
          `<b>${escHtml(account.label)}</b>  <code>${escHtml(account.email)}</code>`,
          `  余额            ${fmt(balance.balance)}`,
          `  未结算        ${fmt(balance.unbilled_charges)}`,
          `  优惠抵扣    ${fmt(balance.promotional_credits)}`,
          "",
        );
      } catch (err) {
        lines.push(
          `<b>${escHtml(account.label)}</b>  <code>${escHtml(account.email)}</code>`,
          `  ⚠ 查询失败：${escHtml(err instanceof Error ? err.message : String(err))}`,
          "",
        );
      }
    }
    return replyHtml(ctx, lines.join("\n"));
  });

  // /pause / /resume
  for (const cmd of ["pause", "resume"] as const) {
    safeCommand(bot, cmd, async (ctx) => {
      const user = await currentUser(ctx);
      if (!user) return replyHtml(ctx, NOT_BOUND);
      const arg = (typeof ctx.match === "string" ? ctx.match : "").trim();
      if (!arg) {
        return replyHtml(ctx, `请提供任务名或任务 ID 前缀，例如 <code>/${cmd} my-task</code>`);
      }
      const candidates = await db.query.tasks.findMany({ where: eq(tasks.userId, user.id) });
      const matched =
        candidates.find((t) => t.id.startsWith(arg)) ??
        candidates.find((t) => t.name === arg) ??
        candidates.find((t) => t.name.toLowerCase().includes(arg.toLowerCase()));
      if (!matched) return replyHtml(ctx, `❌ 未找到任务：<code>${escHtml(arg)}</code>`);

      const nextEnabled = cmd === "resume";
      if (matched.enabled === nextEnabled) {
        return replyHtml(
          ctx,
          `任务 <b>${escHtml(matched.name)}</b> 已经处于 ${nextEnabled ? "启用" : "暂停"} 状态。`,
        );
      }
      await db
        .update(tasks)
        .set({ enabled: nextEnabled, updatedAt: new Date() })
        .where(eq(tasks.id, matched.id));
      return replyHtml(
        ctx,
        [
          cmd === "resume" ? "▶️ <b>已启用</b>" : "⏸ <b>已暂停</b>",
          "",
          `<b>任务</b>      ${escHtml(matched.name)}`,
          `<b>区域</b>      <code>${escHtml(matched.region)}/${escHtml(matched.planId)}</code>`,
          `<b>进度</b>      ${escHtml(matched.currentCount)}/${escHtml(matched.targetCount)}`,
        ].join("\n"),
      );
    });
  }

  // 全局错误兜底
  bot.catch((err) => {
    console.error("[telegram] uncaught bot error:", err.error instanceof Error ? err.error.stack ?? err.error.message : err.error);
  });
}
