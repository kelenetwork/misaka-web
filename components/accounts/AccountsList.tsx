"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Trash2, ShieldCheck } from "lucide-react";
import { fmtRelative } from "@/lib/util/format";

type Account = {
  id: string; label: string; email: string;
  status: "active" | "invalid" | "rate_limited";
  lastLoginAt: string | null;
  rateLimitedUntil: string | null;
};

export function AccountsList({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function verify(id: string) {
    setBusy(id);
    const res = await fetch(`/api/accounts/${id}/verify`, { method: "POST" });
    if (res.ok) alert("登录测试成功");
    else { const data = await res.json().catch(() => ({})); alert(`登录失败: ${data?.error ?? res.status}`); }
    setBusy(null);
    router.refresh();
  }
  async function remove(id: string, label: string) {
    if (!confirm(`确认删除账号 "${label}"？关联任务会失效。`)) return;
    setBusy(id);
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setBusy(null);
  }

  return (
    <Card>
      <div className="grid grid-cols-[1fr_180px_110px_110px] bg-[var(--bg-elev-2)] text-[var(--text-faint)] text-[10px] tracking-[0.16em] uppercase">
        <div className="px-4 py-3">账号 / 邮箱</div>
        <div className="px-4 py-3">最后登录</div>
        <div className="px-4 py-3">状态</div>
        <div className="px-4 py-3 text-right">操作</div>
      </div>
      {accounts.map((a) => (
        <div key={a.id} className="grid grid-cols-[1fr_180px_110px_110px] border-t border-[var(--border)] items-center hover:bg-[var(--bg-elev-2)] transition-colors">
          <div className="px-4 py-3.5">
            <div className="font-serif-italic text-[17px]">{a.label}</div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5 font-mono">{a.email}</div>
          </div>
          <div className="px-4 py-3.5 text-[11px] text-[var(--text-dim)]">
            {a.lastLoginAt ? fmtRelative(a.lastLoginAt) : "从未登录"}
          </div>
          <div className="px-4 py-3.5">
            {a.status === "active" && <StatusBadge tone="ok">可用</StatusBadge>}
            {a.status === "invalid" && <StatusBadge tone="err">凭据失效</StatusBadge>}
            {a.status === "rate_limited" && <StatusBadge tone="warn">熔断中</StatusBadge>}
          </div>
          <div className="px-4 py-3.5 flex justify-end gap-1">
            <button
              onClick={() => verify(a.id)}
              disabled={busy === a.id}
              className="w-7 h-7 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--misaka)] hover:border-[var(--misaka)] transition-colors disabled:opacity-50"
              title="测试登录"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => remove(a.id, a.label)}
              disabled={busy === a.id}
              className="w-7 h-7 grid place-items-center border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors disabled:opacity-50"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </Card>
  );
}
