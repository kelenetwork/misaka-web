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
import { TelegramBindClient } from "@/components/telegram/TelegramBindClient";
import { TelegramUnbindButton } from "@/components/telegram/TelegramUnbindButton";
import { getBotInfo } from "@/lib/telegram/info";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  const telegramUserId = row?.telegramUserId;
  const bot = await getBotInfo();
  const botUsername = bot?.username ?? "misaka_web_bot";
  const botFirstName = bot?.firstName ?? "misaka-web";

  return (
    <AppShell user={user}>
      <Topbar crumb="账户 /" title="Telegram 绑定" />

      <section className="px-4 sm:px-8 py-5 sm:py-7 grid gap-6 max-w-3xl">
        <SectionHead title="状态" />
        <Card className="px-6 py-5">
          <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[120px_1fr] gap-y-3 gap-x-3 text-[12px] sm:text-[13px] items-center">
            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">当前状态</div>
            <div>
              {telegramUserId ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="ok">已绑定</StatusBadge>
                    <span className="font-mono text-[12px] text-[var(--text-dim)]">TG ID: {telegramUserId}</span>
                  </div>
                  <TelegramUnbindButton />
                </div>
              ) : (
                <StatusBadge tone="muted">未绑定</StatusBadge>
              )}
            </div>
            <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-faint)]">Bot</div>
            <div className="font-mono text-[12px] text-[var(--text-dim)]">
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener" className="text-[var(--misaka)] hover:underline">@{botUsername}</a>{" "}
              <span className="text-[var(--text-faint)] ml-2">{botFirstName}</span>
            </div>
          </div>
        </Card>

        <SectionHead title="绑定步骤" />
        <Card className="px-6 py-5">
          <ol className="grid gap-4 text-[13px] leading-[1.7] font-sans">
            <li className="grid grid-cols-[28px_1fr] gap-3">
              <span className="font-serif-italic text-[24px] leading-none text-[var(--misaka)]">1</span>
              <div>
                <div className="font-medium mb-1">点开 Telegram bot</div>
                <div className="text-[var(--text-dim)] text-[12px]">访问 <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener" className="text-[var(--misaka)] hover:underline">@{botUsername}</a> 开始对话。</div>
              </div>
            </li>
            <li className="grid grid-cols-[28px_1fr] gap-3">
              <span className="font-serif-italic text-[24px] leading-none text-[var(--misaka)]">2</span>
              <div>
                <div className="font-medium mb-1">生成绑定码</div>
                <div className="text-[var(--text-dim)] text-[12px] mb-2.5">点下面按钮，生成一次性绑定码（5 分钟有效）。</div>
                <TelegramBindClient />
              </div>
            </li>
            <li className="grid grid-cols-[28px_1fr] gap-3">
              <span className="font-serif-italic text-[24px] leading-none text-[var(--misaka)]">3</span>
              <div>
                <div className="font-medium mb-1">发送 /start &lt;绑定码&gt;</div>
                <div className="text-[var(--text-dim)] text-[12px]">在 Telegram bot 对话框里发送 <code className="font-mono px-1 py-0.5 bg-[var(--bg-elev-3)] rounded">/start &lt;绑定码&gt;</code>，绑定完成。</div>
              </div>
            </li>
          </ol>
        </Card>

        <SectionHead title="绑定后将自动收到" />
        <Card className="px-6 py-5">
          <ul className="grid gap-2 text-[12.5px] text-[var(--text-dim)] leading-[1.7] font-sans">
            <li className="flex items-start gap-2">
              <span className="text-[var(--misaka)] shrink-0">✓</span>
              <span><b className="text-[var(--text)]">下单成功</b> — 含订单号、发票号、付款链接</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--misaka)] shrink-0">✓</span>
              <span><b className="text-[var(--text)]">下单失败</b> — 错误原因 + 是否会重试</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--misaka)] shrink-0">✓</span>
              <span><b className="text-[var(--text)]">账号熔断</b> — 当 misaka 账号被限流（403）时</span>
            </li>
          </ul>
        </Card>
      </section>
      <Footer />
    </AppShell>
  );
}
