import { startInventoryPoller } from "@/lib/workers/inventory-poller";
import { startTelegramBot } from "@/lib/telegram/bot";
export async function initWorkers() { await startInventoryPoller(); await startTelegramBot(); }
