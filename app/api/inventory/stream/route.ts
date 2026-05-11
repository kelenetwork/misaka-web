import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { inventoryEvents, type InventoryPlan } from "@/lib/misaka/inventory";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (plan: InventoryPlan) => controller.enqueue(encoder.encode(`event: inventory\ndata: ${JSON.stringify(plan)}\n\n`));
      inventoryEvents.on("change", send);
      controller.enqueue(encoder.encode(`event: ready\ndata: {}\n\n`));
      return () => inventoryEvents.off("change", send);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
