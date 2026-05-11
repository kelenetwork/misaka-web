import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { inventoryEvents, type InventoryPlan } from "@/lib/misaka/inventory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InventoryStreamEvent = Pick<
  InventoryPlan,
  "region" | "planId" | "planSlug" | "available" | "priceMonthly"
> & {
  type: "change" | "available";
  updatedAt: string;
};

function formatInventoryEvent(type: "change" | "available", plan: InventoryPlan): InventoryStreamEvent {
  return {
    type,
    region: plan.region,
    planId: plan.planId,
    planSlug: plan.planSlug,
    available: plan.available,
    priceMonthly: plan.priceMonthly,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const send = (event: string, data: unknown) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const onChange = (plan: InventoryPlan) => send("change", formatInventoryEvent("change", plan));
      const onAvailable = (plan: InventoryPlan) => send("available", formatInventoryEvent("available", plan));

      send("ready", { ts: Date.now() });
      inventoryEvents.on("change", onChange);
      inventoryEvents.on("available", onAvailable);

      const ping = setInterval(() => enqueue(": ping\n\n"), 25_000);

      const abort = () => {
        clearInterval(ping);
        inventoryEvents.off("change", onChange);
        inventoryEvents.off("available", onAvailable);
        req.signal.removeEventListener("abort", abort);
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
