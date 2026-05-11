import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { getBot } from "@/lib/telegram/bot";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const guard = await requireUser(req); if (!guard.ok) return guard.response; return json({ userId: guard.user.id, enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN), running: Boolean(getBot()) }); }
