"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  workers: Array<{ worker: string; lastTickAt: string; healthy: boolean; lastError: string | null; ageSec: number }>;
  overall: "healthy" | "degraded" | "down";
};

function label(worker: string) {
  return worker.replace(/_/g, " ");
}

export function HealthBanner() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as HealthResponse;
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth({ workers: [], overall: "down" });
      }
    }
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  if (!health || health.overall === "healthy") return null;
  const worker = health.workers.find((item) => !item.healthy) ?? health.workers[0];
  const text = health.overall === "degraded" ? `⚠ ${label(worker?.worker ?? "inventory_poller")} 延迟（最近 tick ${worker?.ageSec ?? "?"} 秒前）` : `✕ ${label(worker?.worker ?? "inventory_poller")} 已停止`;
  return <div className={["sticky top-[57px] lg:top-0 z-20 px-4 sm:px-8 py-2 text-[12px] border-b", health.overall === "degraded" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-100" : "bg-red-500/15 border-red-500/30 text-red-100"].join(" ")}>{text}</div>;
}
