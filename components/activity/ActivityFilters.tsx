"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const actions = [
  { value: "all", label: "全部类型" },
  { value: "inventory.available", label: "库存上架" },
  { value: "order.created", label: "下单成功" },
  { value: "order.failed", label: "下单失败" },
  { value: "task.auto_paused", label: "任务暂停" },
];

const sinceOptions = [
  { value: "24h", label: "24 小时" },
  { value: "7d", label: "7 天" },
  { value: "all", label: "全部" },
];

export function ActivityFilters({ action, since }: { action: string; since: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: "action" | "since", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <select value={action} onChange={(event) => update("action", event.target.value)} className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] text-[12px] text-[var(--text)] outline-none">
        {actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <select value={since} onChange={(event) => update("since", event.target.value)} className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] text-[12px] text-[var(--text)] outline-none">
        {sinceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
  );
}
