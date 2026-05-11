import { getBot } from "@/lib/telegram/bot";
import { json } from "@/lib/http";
export async function GET() { return json({ enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN), running: Boolean(getBot()) }); }
