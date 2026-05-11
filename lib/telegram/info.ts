type BotInfo = { username: string; firstName: string; id: number };

let cached: BotInfo | null = null;
let inflight: Promise<BotInfo | null> | null = null;

export async function getBotInfo(): Promise<BotInfo | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  inflight = (async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await res.json()) as { ok?: boolean; result?: { id: number; username: string; first_name: string } };
      if (!data.ok || !data.result?.username) return null;
      cached = { id: data.result.id, username: data.result.username, firstName: data.result.first_name };
      return cached;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
