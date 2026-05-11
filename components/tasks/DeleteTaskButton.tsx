"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function DeleteTaskButton({ taskId, taskName }: { taskId: string; taskName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    if (!confirm(`确认删除任务「${taskName}」？该任务触发的订单历史也会删除。`)) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/tasks");
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(data?.error ?? `删除失败 (${response.status})`);
    setBusy(false);
  }

  return (
    <div className="grid gap-3">
      <Button type="button" variant="danger" disabled={busy} onClick={destroy} className="w-fit">
        <Trash2 className="w-3.5 h-3.5" /> 删除任务
      </Button>
      {error && <div className="text-[12px] text-[var(--danger)]">{error}</div>}
    </div>
  );
}
