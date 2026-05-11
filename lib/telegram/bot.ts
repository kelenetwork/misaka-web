import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { registerCommands } from "./commands";

let bot: Bot | null = null;
export function getBot() {
  return bot;
}

/** 注册到 Telegram 输入框 `/` 菜单的命令列表。 */
const BOT_COMMANDS: Array<{ command: string; description: string }> = [
  { command: "start", description: "🔗 用 Web 端生成的绑定码绑定账号" },
  { command: "status", description: "🟢 检查 bot 是否在线" },
  { command: "tasks", description: "📋 查看我的下单任务" },
  { command: "orders", description: "🧾 查看最近 5 笔订单" },
  { command: "balance", description: "💰 查看 misaka.io 账号余额" },
  { command: "pause", description: "⏸ 暂停任务  /pause <任务 ID|名>" },
  { command: "resume", description: "▶️ 启用任务  /resume <任务 ID|名>" },
  { command: "unbind", description: "🔌 解除当前 Telegram 账号绑定" },
  { command: "help", description: "❓ 命令帮助" },
];

/** 给 setMyCommands 加重试（网络冷启动失败时再试 3 次）。 */
async function setCommandsWithRetry(b: Bot, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i += 1) {
    try {
      await b.api.setMyCommands(BOT_COMMANDS);
      console.log(`[telegram] setMyCommands ok (${BOT_COMMANDS.length} commands)`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[telegram] setMyCommands attempt ${i + 1}/${retries} failed:`, msg);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

export async function startTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN || bot) return;
  bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
  registerCommands(bot);

  // 先 init 拿到 me 信息，再注册命令菜单（确保 grammy 网络栈已就绪）
  await bot.init().catch((err) => {
    console.warn("[telegram] bot.init failed:", err instanceof Error ? err.message : err);
  });

  // fire-and-forget retry，避免阻塞 long-poll 启动
  setCommandsWithRetry(bot).catch(() => {});

  await bot.start({ drop_pending_updates: true });
}

export async function stopTelegramBot() {
  if (bot) await bot.stop();
  bot = null;
}

// ============ 通知工具 ============

/** Telegram HTML parse_mode 安全转义。https://core.telegram.org/bots/api#html-style */
export function escHtml(s: string | number | undefined | null): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendUserMessage(
  userId: string,
  text: string,
  opts: { html?: boolean; disablePreview?: boolean } = {},
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.telegramUserId || !bot) return;
  try {
    await bot.api.sendMessage(user.telegramUserId, text, {
      parse_mode: opts.html ? "HTML" : undefined,
      link_preview_options: opts.disablePreview ? { is_disabled: true } : undefined,
    });
  } catch (err) {
    console.warn(
      `[telegram] send to ${user.telegramUserId} failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** 直接发到一个 Telegram chat id（绕过 user 表查找，给申请审批之类无 user 的场景用）。 */
export async function sendDirectMessage(
  telegramUserId: string,
  text: string,
  opts: { html?: boolean; disablePreview?: boolean } = {},
) {
  if (!bot) return;
  try {
    await bot.api.sendMessage(telegramUserId, text, {
      parse_mode: opts.html ? "HTML" : undefined,
      link_preview_options: opts.disablePreview ? { is_disabled: true } : undefined,
    });
  } catch (err) {
    console.warn(
      `[telegram] direct send to ${telegramUserId} failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ============ 业务通知 ============

/** 下单成功——重点美化，要醒目易扫读。 */
export async function notifyOrderSuccess(
  userId: string,
  name: string,
  planSlug: string,
  orderId: number,
  invoiceId: number,
  invoiceUrl: string,
  region: string,
) {
  const lines = [
    "🎉 <b>下单成功</b>",
    "",
    `<b>任务</b>    ${escHtml(name)}`,
    `<b>区域</b>    <code>${escHtml(region)}</code>`,
    `<b>机型</b>    <code>${escHtml(planSlug)}</code>`,
    "",
    `<b>订单</b>    <code>#${escHtml(orderId)}</code>`,
    `<b>发票</b>    <code>#${escHtml(invoiceId)}</code>`,
    "",
    `💳 <a href="${escHtml(invoiceUrl)}">点击付款</a>  ·  未付款发票将自动过期`,
  ];
  await sendUserMessage(userId, lines.join("\n"), { html: true, disablePreview: true });
}

/** 下单失败 */
export async function notifyOrderFailed(userId: string, name: string, error: string) {
  const lines = [
    "❌ <b>下单失败</b>",
    "",
    `<b>任务</b>    ${escHtml(name)}`,
    `<b>错误</b>    <code>${escHtml(error).slice(0, 300)}</code>`,
    "",
    "将自动进入指数退避重试。如连续失败 5 次会暂停任务。",
  ];
  await sendUserMessage(userId, lines.join("\n"), { html: true });
}

/** 任务被自动暂停（连续失败上限触发） */
export async function notifyTaskAutoPaused(
  userId: string,
  taskName: string,
  failureCount: number,
  lastError: string,
) {
  const lines = [
    "⏸ <b>任务已自动暂停</b>",
    "",
    `<b>任务</b>          ${escHtml(taskName)}`,
    `<b>连续失败</b>    ${escHtml(failureCount)} 次`,
    `<b>最近错误</b>    <code>${escHtml(lastError).slice(0, 300)}</code>`,
    "",
    "请检查 misaka 账号 或 task 配置，确认后到 Web 端手动启用。",
  ];
  await sendUserMessage(userId, lines.join("\n"), { html: true });
}

/** misaka 账号熔断 */
export async function notifyAccountCircuitBreaker(userId: string, label: string) {
  const lines = [
    "🚨 <b>misaka 账号已熔断</b>",
    "",
    `<b>账号</b>    ${escHtml(label)}`,
    `<b>冷却</b>    30 分钟`,
    "",
    "连续 3 次 403，账号可能已被 misaka.io 限流。30 分钟后自动恢复尝试。",
  ];
  await sendUserMessage(userId, lines.join("\n"), { html: true });
}
