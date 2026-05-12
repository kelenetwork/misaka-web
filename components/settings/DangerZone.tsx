"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, LogOut, Trash2 } from "lucide-react";

export function DangerZone() {
  const router = useRouter();
  const [busy, setBusy] = useState<"signout" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signOutAll() {
    if (!window.confirm("将吊销当前账号所有设备上的会话（包括此浏览器）。确认？")) return;
    setBusy("signout");
    try {
      const res = await fetch("/api/auth/revoke-sessions", { method: "POST" });
      if (res.ok) {
        // 也撤销自己当前 session
        await fetch("/api/auth/sign-out", { method: "POST" });
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.message || `失败 (${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    const confirm1 = window.prompt('删除账号会清除所有 misaka 账号 / 任务 / 订单 / Telegram 绑定，且不可恢复。\n请输入 "DELETE" 确认：');
    if (confirm1 !== "DELETE") {
      if (confirm1 !== null) alert("输入不匹配，已取消。");
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch("/api/me", { method: "DELETE" });
      if (res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || data?.message || `失败 (${res.status})`);
      setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3 text-[12.5px]">
      <div>
        <div className="font-medium mb-1">退出所有设备</div>
        <div className="text-[11px] text-[var(--text-dim)] mb-2 leading-[1.7]">
          吊销当前账号在所有设备上的会话。撤销后所有浏览器/手机端都需要重新登录。
        </div>
        <Button variant="default" onClick={signOutAll} disabled={busy !== null}>
          <LogOut className="w-3.5 h-3.5" />
          {busy === "signout" ? "正在吊销..." : "退出所有设备"}
        </Button>
      </div>

      <div className="border-t border-[var(--border)] pt-3 mt-1">
        <div className="font-medium mb-1 text-[var(--danger)]">删除账号</div>
        <div className="text-[11px] text-[var(--text-dim)] mb-2 leading-[1.7]">
          会清除你所有的 misaka 账号、任务、订单、Telegram 绑定。不可恢复。
        </div>
        <Button variant="danger" onClick={deleteAccount} disabled={busy !== null}>
          <Trash2 className="w-3.5 h-3.5" />
          {busy === "delete" ? "删除中..." : "永久删除账号"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-2.5 py-2 bg-[var(--danger-dim)] border border-[var(--danger)] text-[var(--danger)] rounded-md text-[11px] mt-2">
          <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
